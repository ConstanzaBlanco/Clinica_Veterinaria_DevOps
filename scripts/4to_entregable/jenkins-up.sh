#!/usr/bin/env bash
#
# Levanta Jenkins localmente con Docker, listo para correr el Jenkinsfile de
# la raiz del repo. La primera vez que se corre (contenedor nuevo) queda
# totalmente configurado solo: plugins instalados, seguridad desactivada
# (ambiente local, igual criterio que Grafana con admin/admin) y el Job
# "petcore-pipeline" ya creado apuntando a este repositorio. Lo unico que
# sigue siendo manual, porque son secretos reales que no se pueden generar
# ni guardar en el repo, es cargar las credenciales SNYK_TOKEN y
# DOCKER_REGISTRY_CREDS desde la interfaz web.
#
# Monta el socket de Docker del host para que los stages del pipeline
# puedan construir imagenes (docker build/push) y necesita que Docker
# Desktop este abierto.
#
# Uso (desde la raiz del repo, en Git Bash):
#   bash scripts/4to_entregable/jenkins-up.sh
#
# Se puede correr las veces que haga falta: si el contenedor ya existe, lo
# reutiliza en vez de crear uno nuevo (y no le toca nada de lo ya
# configurado: plugins, credenciales, Jobs).

set -euo pipefail

# Git Bash en Windows (MSYS) traduce rutas estilo Linux ("/var/...") a rutas
# de Windows antes de pasarlas a Docker, lo que rompe los "-v" y cualquier
# ruta absoluta que se le pase a "docker exec". Esto lo desactiva para todo
# el script.
export MSYS_NO_PATHCONV=1

CONTENEDOR="petcore-jenkins"
VOLUMEN="petcore-jenkins-home"
PUERTO="8080"
JOB_NOMBRE="petcore-pipeline"
PLUGINS="workflow-aggregator git docker-workflow credentials-binding"

paso() { printf '\n==> %s\n' "$*"; }
error() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

command -v docker >/dev/null || error "No se encuentra docker. ¿Esta instalado Docker Desktop?"
docker info >/dev/null 2>&1 || error "Docker Desktop no esta corriendo."

# Repo remoto real, para que el Job apunte siempre al origen correcto (sirve
# igual si alguien corre esto desde un fork).
REPO_URL="$(git -C "$(dirname "${BASH_SOURCE[0]}")" remote get-url origin 2>/dev/null || true)"

ES_CONTENEDOR_NUEVO=0
if docker ps -a --format '{{.Names}}' | grep -qx "$CONTENEDOR"; then
    paso "El contenedor $CONTENEDOR ya existe, lo inicio si estaba detenido"
    docker start "$CONTENEDOR" >/dev/null
else
    ES_CONTENEDOR_NUEVO=1
    paso "Creando el volumen persistente de Jenkins ($VOLUMEN)"
    docker volume create "$VOLUMEN" >/dev/null

    # "jenkins-plugin-cli" por defecto descarga a un directorio de
    # referencia que el entrypoint normal de Jenkins despues copia al home -
    # pero corriendolo asi, suelto, en un contenedor efimero, ese directorio
    # de referencia se pierde al terminar el contenedor (--rm). Apuntando
    # "--plugin-download-directory" directo a la carpeta de plugins del
    # volumen montado, quedan ahi para siempre.
    paso "Instalando los plugins de Jenkins en el volumen (puede tardar un par de minutos)"
    docker run --rm -v "$VOLUMEN:/var/jenkins_home" jenkins/jenkins:lts \
        jenkins-plugin-cli --plugin-download-directory /var/jenkins_home/plugins \
        --plugins $PLUGINS

    paso "Dejando creado el Job '$JOB_NOMBRE' y la seguridad desactivada (ambiente local)"
    docker run --rm -v "$VOLUMEN:/var/jenkins_home" alpine \
        sh -c "mkdir -p /var/jenkins_home/init.groovy.d /var/jenkins_home/jobs/$JOB_NOMBRE"

    # Se ejecuta en cada arranque de Jenkins (init.groovy.d), pero deja el
    # mismo resultado todas las veces, asi que no hace falta volver a
    # escribirlo en corridas futuras sobre este mismo contenedor.
    cat <<'GROOVY' | docker run --rm -i -v "$VOLUMEN:/var/jenkins_home" alpine \
        sh -c "cat > /var/jenkins_home/init.groovy.d/000-security.groovy"
import jenkins.model.*
import hudson.security.*

def jenkins = Jenkins.get()
jenkins.setSecurityRealm(SecurityRealm.NO_AUTHENTICATION)
jenkins.setAuthorizationStrategy(AuthorizationStrategy.UNSECURED)
jenkins.save()
GROOVY

    if [[ -n "$REPO_URL" ]]; then
        cat <<XMLEOF | docker run --rm -i -v "$VOLUMEN:/var/jenkins_home" alpine \
            sh -c "cat > /var/jenkins_home/jobs/$JOB_NOMBRE/config.xml"
<?xml version='1.1' encoding='UTF-8'?>
<flow-definition plugin="workflow-job">
  <description></description>
  <keepDependencies>false</keepDependencies>
  <properties/>
  <definition class="org.jenkinsci.plugins.workflow.cps.CpsScmFlowDefinition" plugin="workflow-cps">
    <scm class="hudson.plugins.git.GitSCM" plugin="git">
      <configVersion>2</configVersion>
      <userRemoteConfigs>
        <hudson.plugins.git.UserRemoteConfig>
          <url>${REPO_URL}</url>
        </hudson.plugins.git.UserRemoteConfig>
      </userRemoteConfigs>
      <branches>
        <hudson.plugins.git.BranchSpec>
          <name>*/main</name>
        </hudson.plugins.git.BranchSpec>
      </branches>
      <doGenerateSubmoduleConfigurations>false</doGenerateSubmoduleConfigurations>
      <submoduleCfg class="empty-list"/>
      <extensions/>
    </scm>
    <scriptPath>Jenkinsfile</scriptPath>
    <lightweight>true</lightweight>
  </definition>
  <triggers/>
  <disabled>false</disabled>
</flow-definition>
XMLEOF
    else
        echo "Aviso: no pude leer la URL del remoto 'origin' (¿esta carpeta es un git clone?). El Job '$JOB_NOMBRE' no se va a crear solo - hay que armarlo a mano desde la interfaz."
        rm -rf "/tmp/job-vacio-$$" 2>/dev/null || true
    fi

    docker run --rm -v "$VOLUMEN:/var/jenkins_home" alpine \
        chown -R 1000:1000 /var/jenkins_home/init.groovy.d /var/jenkins_home/jobs

    paso "Levantando Jenkins ($CONTENEDOR) en el puerto $PUERTO"
    # -v /var/run/docker.sock: permite que los stages del pipeline construyan
    # imagenes usando el Docker del host (docker-outside-of-docker), sin
    # instalar un segundo motor de Docker dentro del contenedor de Jenkins.
    # JAVA_OPTS salta el asistente inicial: ya quedo todo listo arriba.
    docker run -d \
        --name "$CONTENEDOR" \
        -p "${PUERTO}:8080" \
        -e JAVA_OPTS="-Djenkins.install.runSetupWizard=false" \
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

# La etapa de despliegue del Jenkinsfile le habla directo al contenedor de
# minikube por su nombre ("minikube:8443"), asi que el contenedor de Jenkins
# tiene que estar en la misma red docker que minikube (la red se llama
# "minikube" y ya existe porque "minikube start" la crea). Sin esto, ese
# nombre no se resuelve desde adentro de Jenkins. Es idempotente: si ya
# estaba conectado, docker devuelve error y se ignora con "|| true".
if docker network inspect minikube >/dev/null 2>&1; then
    paso "Conectando Jenkins a la red docker de minikube"
    docker network connect minikube "$CONTENEDOR" 2>/dev/null || true
else
    echo "Aviso: todavia no existe la red docker 'minikube' (¿minikube no arranco con --driver=docker?). La etapa de despliegue del Jenkinsfile no va a poder conectarse hasta que exista."
fi

# El Jenkinsfile necesita un kubeconfig que apunte a minikube por el nombre
# del contenedor ("minikube:8443"), no por el puerto que "minikube start"
# publica en el host (127.0.0.1:PUERTO) - ese puerto no es alcanzable desde
# un contenedor hermano de Jenkins. Cada persona del equipo tiene su propio
# minikube (con sus propios certificados), asi que este archivo NO se puede
# compartir entre maquinas ni subir a Jenkins a mano una sola vez: se genera
# aca, en cada maquina, cada vez que se levanta Jenkins, usando el minikube y
# kubectl que ya estan instalados localmente. Queda dentro del volumen de
# Jenkins (nunca en el repo, trae la clave privada de administrador del
# cluster local).
if command -v minikube >/dev/null && minikube status >/dev/null 2>&1; then
    paso "Generando el kubeconfig de minikube para el pipeline"
    KUBECONFIG="$HOME/.kube/config" minikube update-context >/dev/null
    # "docker cp" con una ruta de /tmp pisa mal en Git Bash/Windows (MSYS la
    # traduce a una ruta de Windows que no existe). En vez de eso, el
    # contenido se manda por stdin de "docker exec" directamente.
    KUBECONFIG="$HOME/.kube/config" minikube kubectl -- config view \
        --flatten --minify --context=minikube \
        | sed -E 's#server: https://127\.0\.0\.1:[0-9]+#server: https://minikube:8443#' \
        | docker exec -i -u root "$CONTENEDOR" sh -c \
            "cat > /var/jenkins_home/kubeconfig-minikube-interno.yaml && chown jenkins:jenkins /var/jenkins_home/kubeconfig-minikube-interno.yaml && chmod 600 /var/jenkins_home/kubeconfig-minikube-interno.yaml"
else
    echo "Aviso: no encuentro minikube corriendo. La etapa de despliegue del Jenkinsfile va a fallar hasta que minikube este levantado y se vuelva a correr este script."
fi

paso "Esperando a que Jenkins termine de arrancar"
for i in $(seq 1 40); do
    code="$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:${PUERTO}/" 2>/dev/null || true)"
    if [[ "$code" == "200" || "$code" == "403" ]]; then
        break
    fi
    sleep 3
done

# "helm" y el cliente de "docker" no vienen en la imagen base de Jenkins.
# Se instalan dentro del contenedor cada vez que se corre este script, pero
# de forma idempotente (si ya estan, no hacen nada) - asi no hace falta que
# nadie los instale a mano para poder correr la etapa de build/push ni la de
# despliegue con Helm.
if ! docker exec "$CONTENEDOR" sh -c "command -v helm" >/dev/null 2>&1; then
    paso "Instalando helm dentro del contenedor de Jenkins"
    docker exec -u root "$CONTENEDOR" sh -c \
        "curl -fsSL https://get.helm.sh/helm-v3.15.4-linux-amd64.tar.gz | tar xz -C /tmp && mv /tmp/linux-amd64/helm /usr/local/bin/helm && rm -rf /tmp/linux-amd64"
fi

if ! docker exec "$CONTENEDOR" sh -c "command -v docker" >/dev/null 2>&1; then
    paso "Instalando el cliente de Docker dentro del contenedor de Jenkins"
    docker exec -u root "$CONTENEDOR" sh -c "apt-get update -qq && apt-get install -y -qq docker.io >/dev/null"
fi

echo
echo "==> Jenkins disponible en: http://localhost:${PUERTO}"
if (( ES_CONTENEDOR_NUEVO )); then
    echo "==> Primer arranque: seguridad desactivada (ambiente local, sin login) y Job '$JOB_NOMBRE' ya creado."
else
    echo "==> Ya estaba configurado de antes (plugins, Job y credenciales que hayas cargado se mantienen)."
fi

cat <<'EOF'

Lo unico que sigue siendo manual (una sola vez, porque son secretos reales
que no se pueden generar ni guardar en el repositorio): cargar en
Manage Jenkins > Credentials:
  - SNYK_TOKEN            (Secret text): el token de la cuenta de Snyk.
  - DOCKER_REGISTRY_CREDS (Username and password): usuario/contraseña del
                          registry donde se publican las imagenes.
EOF
