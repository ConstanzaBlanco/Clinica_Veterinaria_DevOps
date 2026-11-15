// Pipeline de CI/CD del Laboratorio 4. Consolida en un solo archivo lo que
// estaba repartido en dos ramas sueltas (jenkins-practica-tuyo,
// jenkins-multibranch), agregando las etapas que faltaban: Semgrep, Snyk,
// publicacion de imagen y despliegue con Helm.
//
// Credenciales que hay que cargar en Jenkins antes de correr esto (Manage
// Jenkins > Credentials), ninguna va en texto plano en este archivo:
//   - SNYK_TOKEN              (Secret text): token de la cuenta de Snyk.
//   - DOCKER_REGISTRY_CREDS   (Username/password): credenciales del registry
//                             donde se publican las imagenes.
//
// DOCKER_REGISTRY abajo es un valor pendiente: lo reemplaza el equipo por el
// registry real (Docker Hub, GHCR, uno propio) antes de la primera corrida.

pipeline {
    agent any

    environment {
        IMAGE_BACKEND    = "clinica-veterinaria"
        IMAGE_FRONTEND   = "clinica-frontend"
        IMAGE_TAG        = "build-${BUILD_NUMBER}"
        DOCKER_REGISTRY  = "manuelney67" // Docker Hub
        // Jenkins corre "Docker fuera de Docker": el socket es del Docker
        // del host, asi que un "docker run -v $WORKSPACE:..." NO ve esa ruta
        // (solo existe dentro de este contenedor). La forma correcta de que
        // un contenedor hermano vea el workspace es montar el MISMO volumen
        // con nombre (no una ruta) y pararse en $WORKSPACE adentro, que
        // coincide porque el volumen entero queda montado en el mismo punto.
        JENKINS_VOLUME   = "petcore-jenkins-home"
    }

    stages {

        stage('Clonacion del repositorio') {
            steps {
                checkout scm
            }
        }

        // No usa --error: reporta los hallazgos pero no corta el pipeline.
        // Las 2 reglas propias (.semgrep.yml) estan en severidad ERROR, y hoy
        // quedan 4 hallazgos de SQL ya revisados y justificados a proposito
        // (ver ENTREGABLE_3_DEVSECOPS.md, 2.3) - no son vulnerabilidades
        // reales. El corte obligatorio de la letra (punto 3.e) es ante
        // "vulnerabilidades criticas", y eso lo gatilla la etapa de Snyk.
        stage('Analisis estatico - Semgrep') {
            steps {
                sh '''
                    mkdir -p reports
                    docker run --rm -v "$JENKINS_VOLUME:/var/jenkins_home" semgrep/semgrep \
                        semgrep --config "$WORKSPACE/.semgrep.yml" --metrics=off \
                        --output "$WORKSPACE/reports/semgrep-report.txt" "$WORKSPACE/app" || true
                '''
                archiveArtifacts artifacts: 'reports/semgrep-report.txt', allowEmptyArchive: true
            }
        }

        // snyk test devuelve codigo de error si encuentra algo al nivel del
        // umbral o por encima: eso es lo que corta el pipeline (requisito
        // 3.e de la letra) y evita que se construya o despliegue una imagen
        // con una vulnerabilidad critica conocida.
        stage('Escaneo de dependencias - Snyk') {
            steps {
                // Mismo criterio que scripts/snyk.ps1: Snyk se instala con
                // npm (no hay imagen oficial propia que el equipo haya
                // verificado), asi que se corre dentro de un contenedor Node
                // efimero para no depender de tenerlo instalado en el agente.
                withCredentials([string(credentialsId: 'SNYK_TOKEN', variable: 'SNYK_TOKEN')]) {
                    sh '''
                        docker run --rm -e SNYK_TOKEN="$SNYK_TOKEN" \
                            -v "$JENKINS_VOLUME:/var/jenkins_home" -w "$WORKSPACE" \
                            node:22-alpine sh -c "
                                apk add --no-cache python3 py3-pip >/dev/null &&
                                pip install --no-cache-dir --break-system-packages uv >/dev/null &&
                                uv export --format requirements-txt --no-dev > requirements.txt &&
                                pip install --no-cache-dir --break-system-packages -r requirements.txt >/dev/null &&
                                npm install -g snyk >/dev/null &&
                                snyk test --file=requirements.txt --severity-threshold=critical
                            "
                    '''
                    sh '''
                        docker run --rm -e SNYK_TOKEN="$SNYK_TOKEN" \
                            -v "$JENKINS_VOLUME:/var/jenkins_home" -w "$WORKSPACE/frontend" \
                            node:22-alpine sh -c "
                                npm install -g snyk >/dev/null &&
                                npm ci >/dev/null &&
                                snyk test --severity-threshold=critical
                            "
                    '''
                }
            }
        }

        stage('Construccion y test') {
            steps {
                sh '''
                    docker run --rm \
                        -v "$JENKINS_VOLUME:/var/jenkins_home" -w "$WORKSPACE" \
                        python:3.13-slim \
                        sh -c "pip install --no-cache-dir uv && uv sync --locked && uv run pytest -v"
                '''
            }
        }

        stage('Construccion y publicacion de imagen') {
            steps {
                sh '''
                    docker build -t ${DOCKER_REGISTRY}/${IMAGE_BACKEND}:${IMAGE_TAG} .
                    docker build -f frontend/Dockerfile.k8s \
                        -t ${DOCKER_REGISTRY}/${IMAGE_FRONTEND}:${IMAGE_TAG} frontend
                '''
                withCredentials([usernamePassword(
                    credentialsId: 'DOCKER_REGISTRY_CREDS',
                    usernameVariable: 'REG_USER',
                    passwordVariable: 'REG_PASS'
                )]) {
                    sh '''
                        echo "$REG_PASS" | docker login -u "$REG_USER" --password-stdin
                        docker push ${DOCKER_REGISTRY}/${IMAGE_BACKEND}:${IMAGE_TAG}
                        docker push ${DOCKER_REGISTRY}/${IMAGE_FRONTEND}:${IMAGE_TAG}
                    '''
                }
            }
        }

        // Nunca "latest": la politica de Kyverno disallow-latest-tag lo
        // rechazaria.
        //
        // Despliega contra minikube local (namespace "petcore"), no contra
        // el cluster de la UCU: ese destino ya lo cubre Jenkinsfile.ucu,
        // corriendo dentro del cluster con Kaniko. Tener las dos cosas en
        // este mismo pipeline era redundante y ademas no cumplia con que
        // el pipeline del laboratorio despliegue en el entorno local.
        //
        // El archivo /var/jenkins_home/kubeconfig-minikube-interno.yaml NO
        // es el kubeconfig que genera "minikube start" (ese apunta a un
        // puerto del host, no alcanzable desde un contenedor hermano de
        // Jenkins): tiene el "server" reescrito a "https://minikube:8443",
        // la direccion del contenedor de minikube dentro de la red docker
        // "minikube". jenkins-up.sh lo genera de nuevo cada vez que levanta
        // Jenkins, usando el minikube/kubectl que ya estan instalados en esa
        // maquina - por eso no es una credencial de Jenkins cargada a mano:
        // cada persona del equipo tiene su propio minikube (con sus propios
        // certificados), asi que este archivo tiene que generarse en cada
        // maquina, no compartirse entre compañeros.
        //
        // Se usa "--kubeconfig" como parametro explicito, no la variable de
        // entorno KUBECONFIG: en este Jenkins, el binario de helm ignora la
        // variable de entorno y sigue resolviendo contra el Jenkins local
        // (se repitio el problema a mano antes de este fix) - con el flag
        // explicito funciona bien.
        //
        // Este stage asume que el Secret (postgres-secret, jwt-secret) y el
        // ConfigMap (postgres-init) ya existen en el namespace "petcore" -
        // la chart no los crea, eso lo hace
        // scripts/4to_entregable/preparar-chart.sh (o inicializar-todo.sh,
        // que lo llama). Hay que haber corrido uno de los dos antes de
        // correr este pipeline por primera vez.
        stage('Despliegue automatico con Helm') {
            steps {
                sh '''
                    helm --kubeconfig /var/jenkins_home/kubeconfig-minikube-interno.yaml \
                        upgrade --install petcore ./helm-chart -n petcore \
                        --set api.image.repository=${DOCKER_REGISTRY}/${IMAGE_BACKEND} \
                        --set api.image.tag=${IMAGE_TAG} \
                        --set api.image.pullPolicy=IfNotPresent \
                        --set frontend.image.repository=${DOCKER_REGISTRY}/${IMAGE_FRONTEND} \
                        --set frontend.image.tag=${IMAGE_TAG} \
                        --set frontend.image.pullPolicy=IfNotPresent
                '''
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: 'reports/*.txt', allowEmptyArchive: true
        }
        failure {
            echo 'Pipeline detenido. Si corto en "Escaneo de dependencias - Snyk", hay una vulnerabilidad critica sin resolver: revisar el log de esa etapa antes de reintentar.'
        }
    }
}
