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
                    docker run --rm -v "$WORKSPACE:/src" semgrep/semgrep \
                        semgrep --config /src/.semgrep.yml --metrics=off \
                        --output /src/reports/semgrep-report.txt /src/app || true
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
                            -v "$WORKSPACE:/project" -w /project \
                            node:22-alpine sh -c "
                                apk add --no-cache python3 py3-pip >/dev/null &&
                                pip install --no-cache-dir --break-system-packages uv >/dev/null &&
                                uv export --format requirements-txt --no-dev > requirements.txt &&
                                npm install -g snyk >/dev/null &&
                                snyk test --file=requirements.txt --severity-threshold=critical
                            "
                    '''
                    sh '''
                        docker run --rm -e SNYK_TOKEN="$SNYK_TOKEN" \
                            -v "$WORKSPACE/frontend:/project" -w /project \
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
                        -v "$WORKSPACE:/app" -w /app \
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
                        echo "$REG_PASS" | docker login ${DOCKER_REGISTRY} -u "$REG_USER" --password-stdin
                        docker push ${DOCKER_REGISTRY}/${IMAGE_BACKEND}:${IMAGE_TAG}
                        docker push ${DOCKER_REGISTRY}/${IMAGE_FRONTEND}:${IMAGE_TAG}
                    '''
                }
            }
        }

        // Nunca "latest": la politica de Kyverno disallow-latest-tag lo
        // rechazaria. Usa values-dev.yaml por defecto; para produccion, pisar
        // con --set-string helmValuesFile=values-prod.yaml al lanzar el job.
        stage('Despliegue automatico con Helm') {
            steps {
                sh '''
                    helm upgrade --install petcore ./helm-chart -n petcore \
                        -f helm-chart/values-dev.yaml \
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
