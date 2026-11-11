#!/usr/bin/env bash
#
# Levanta Jenkins localmente con Docker, listo para correr el Jenkinsfile de
# la raiz del repo. Monta el socket de Docker del host para que los stages
# del pipeline puedan construir imagenes (docker build/push) y necesita que
# Docker Desktop este abierto.
#
# Uso (desde la raiz del repo, en Git Bash):
#   bash scripts/4to_entregable/jenkins-up.sh
#
# Se puede correr las veces que haga falta: si el contenedor ya existe, lo
# reutiliza en vez de crear uno nuevo.

set -euo pipefail

# Git Bash en Windows (MSYS) traduce rutas estilo Linux ("/var/...") a rutas
# de Windows antes de pasarlas a Docker, lo que rompe los "-v" y cualquier
# ruta absoluta que se le pase a "docker exec". Esto lo desactiva para todo
# el script.
export MSYS_NO_PATHCONV=1

CONTENEDOR="petcore-jenkins"
VOLUMEN="petcore-jenkins-home"
PUERTO="8080"

paso() { printf '\n==> %s\n' "$*"; }
error() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

command -v docker >/dev/null || error "No se encuentra docker. ¿Esta instalado Docker Desktop?"
docker info >/dev/null 2>&1 || error "Docker Desktop no esta corriendo."

if docker ps -a --format '{{.Names}}' | grep -qx "$CONTENEDOR"; then
    paso "El contenedor $CONTENEDOR ya existe, lo inicio si estaba detenido"
    docker start "$CONTENEDOR" >/dev/null
else
    paso "Creando el volumen persistente de Jenkins ($VOLUMEN)"
    docker volume create "$VOLUMEN" >/dev/null

    paso "Levantando Jenkins ($CONTENEDOR) en el puerto $PUERTO"
    # -v /var/run/docker.sock: permite que los stages del pipeline construyan
    # imagenes usando el Docker del host (docker-outside-of-docker), sin
    # instalar un segundo motor de Docker dentro del contenedor de Jenkins.
    docker run -d \
        --name "$CONTENEDOR" \
        -p "${PUERTO}:8080" \
        -v "$VOLUMEN:/var/jenkins_home" \
        -v /var/run/docker.sock:/var/run/docker.sock \
        jenkins/jenkins:lts
fi

# El usuario "jenkins" dentro del contenedor no queda en el grupo dueno del
# socket montado, asi que sin esto los stages que llaman a "docker run"
# fallan con "permission denied". No siempre sobrevive a un reinicio de
# Docker Desktop (recrea el socket); si vuelve a fallar, se repite solo.
paso "Dando permiso al socket de Docker para el usuario de Jenkins"
docker exec -u root "$CONTENEDOR" chmod 666 /var/run/docker.sock

paso "Esperando a que Jenkins termine de arrancar"
for i in $(seq 1 30); do
    if docker exec "$CONTENEDOR" test -f /var/jenkins_home/secrets/initialAdminPassword 2>/dev/null; then
        break
    fi
    sleep 2
done

echo
echo "==> Jenkins disponible en: http://localhost:${PUERTO}"
if docker exec "$CONTENEDOR" test -f /var/jenkins_home/secrets/initialAdminPassword 2>/dev/null; then
    echo "==> Contraseña inicial de administrador (solo hace falta la primera vez):"
    docker exec "$CONTENEDOR" cat /var/jenkins_home/secrets/initialAdminPassword
else
    echo "==> Ya estaba inicializado antes (no hay contraseña inicial nueva para mostrar)."
fi

cat <<'EOF'

Pasos manuales que siguen (una sola vez, desde la interfaz web):
  1. Instalar los plugins sugeridos + "Docker Pipeline".
  2. Manage Jenkins > Credentials > agregar:
       - SNYK_TOKEN            (Secret text)
       - DOCKER_REGISTRY_CREDS (Username and password, del registry de imagenes)
  3. Crear un Pipeline job apuntando a este repositorio (rama con el
     Jenkinsfile) o usar "Pipeline script from SCM".
  4. Dentro del contenedor de Jenkins, instalar el cliente de Docker si el
     job lo necesita y no esta ya disponible (la imagen base no trae el
     binario "docker", solo el acceso al socket):
       docker exec -u root petcore-jenkins sh -c \
         "apt-get update && apt-get install -y docker.io"
EOF
