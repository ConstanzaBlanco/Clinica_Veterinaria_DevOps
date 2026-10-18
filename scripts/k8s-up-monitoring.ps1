Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# UTF8Encoding "a secas" antepone un BOM a todo lo que se manda por pipeline a
# un programa externo (ej. psql), que lo interpreta como caracter invalido y
# rompe el SQL. $false = sin BOM; sigue evitando que se corrompan las tildes.
$OutputEncoding = New-Object System.Text.UTF8Encoding $false

# A diferencia de k8s-up.ps1 / k8s-up-green.ps1, este script NO exige ninguna
# rama de git ni que Blue/Green esten desplegados: levanta una API simple
# (api-monitoring) + Postgres + Prometheus + Grafana, pensado para probar el
# entregable de monitoreo de forma aislada.

function Confirm-NativeCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Step
    )

    if ($LASTEXITCODE -ne 0) {
        throw "Fallo el paso: $Step. Codigo de salida: $LASTEXITCODE"
    }
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$passwordFile = Join-Path $projectRoot "db\password.txt"
$jwtSecretFile = Join-Path $projectRoot "db\jwt-secret.txt"

$requiredFiles = @(
    "k8s\namespace.yaml",
    "k8s\postgres-service.yaml",
    "k8s\postgres-statefulset.yaml",
    "k8s\api-monitoring-deployment.yaml",
    "k8s\api-monitoring-service.yaml",
    "k8s\prometheus-configmap.yaml",
    "k8s\prometheus-rbac.yaml",
    "k8s\prometheus-deployment.yaml",
    "k8s\prometheus-service.yaml",
    "k8s\grafana-datasource-configmap.yaml",
    "k8s\grafana-dashboard-configmap.yaml",
    "k8s\grafana-alerting-configmap.yaml",
    "k8s\grafana-deployment.yaml",
    "k8s\grafana-service.yaml",
    "k8s\frontend-monitoring-deployment.yaml",
    "k8s\frontend-monitoring-service.yaml",
    "frontend\Dockerfile.k8s",
    "frontend\nginx-monitoring.conf",
    "frontend\package.json",
    "frontend\package-lock.json",
    "db\init\01_schema.sql",
    "db\init\02_permisos.sql",
    "db\init\03_excepcion_disponibilidad.sql",
    "db\init\04_datos_prueba.sql"
    "db\migrations\01_catalogo_especies.sql"
)

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker no esta instalado o no esta disponible en PATH."
}

if (-not (Get-Command minikube -ErrorAction SilentlyContinue)) {
    throw "Minikube no esta instalado o no esta disponible en PATH."
}

if (-not (Test-Path -LiteralPath $passwordFile -PathType Leaf)) {
    throw "No existe db\password.txt. Crealo antes de ejecutar este script."
}

if (-not (Test-Path -LiteralPath $jwtSecretFile -PathType Leaf)) {
    throw "No existe db\jwt-secret.txt. Crealo antes de ejecutar este script."
}

foreach ($relativePath in $requiredFiles) {
    $fullPath = Join-Path $projectRoot $relativePath

    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        throw "Falta el archivo requerido: $relativePath"
    }
}

Push-Location -LiteralPath $projectRoot

try {
    Write-Host "[1/8] Comprobando Docker Desktop..."
    docker info --format "{{.ServerVersion}}" | Out-Null
    Confirm-NativeCommand -Step "comprobar Docker Desktop"

    Write-Host "[2/8] Iniciando Minikube..."
    minikube start --driver=docker
    Confirm-NativeCommand -Step "iniciar Minikube"

    Write-Host "[3/9] Construyendo la imagen de la API (clinica-veterinaria:monitoring)..."
    minikube image build -t clinica-veterinaria:monitoring .
    Confirm-NativeCommand -Step "construir la imagen de la API"

    Write-Host "[4/9] Construyendo la imagen del frontend de monitoreo (clinica-frontend:monitoring)..."
    # Mismo Dockerfile.k8s que Blue/Green, pero con nginx-monitoring.conf
    # (apunta a "api-monitoring" en vez de a "api").
    minikube image build --build-opt=build-arg=NGINX_CONF=nginx-monitoring.conf -t clinica-frontend:monitoring -f Dockerfile.k8s frontend
    Confirm-NativeCommand -Step "construir la imagen del frontend de monitoreo"

    Write-Host "[5/9] Creando el namespace..."
    minikube kubectl -- apply -f k8s\namespace.yaml
    Confirm-NativeCommand -Step "crear el namespace"

    Write-Host "[6/9] Creando o actualizando los Secrets..."
    $secretManifest = minikube kubectl -- create secret generic postgres-secret --from-file=db-password=db/password.txt --namespace=clinica-veterinaria --dry-run=client -o yaml
    Confirm-NativeCommand -Step "generar el Secret de PostgreSQL"
    $secretManifest | minikube kubectl -- apply -f -
    Confirm-NativeCommand -Step "aplicar el Secret de PostgreSQL"

    $jwtSecretManifest = minikube kubectl -- create secret generic jwt-secret --from-file=jwt-secret=db/jwt-secret.txt --namespace=clinica-veterinaria --dry-run=client -o yaml
    Confirm-NativeCommand -Step "generar el Secret JWT"
    $jwtSecretManifest | minikube kubectl -- apply -f -
    Confirm-NativeCommand -Step "aplicar el Secret JWT"

    Write-Host "[7/9] Creando o actualizando el ConfigMap con los SQL..."
    $configMapManifest = minikube kubectl -- create configmap postgres-init --from-file=db/init --namespace=clinica-veterinaria --dry-run=client -o yaml
    Confirm-NativeCommand -Step "generar el ConfigMap de PostgreSQL"
    $configMapManifest | minikube kubectl -- apply -f -
    Confirm-NativeCommand -Step "aplicar el ConfigMap de PostgreSQL"

    Write-Host "[8/9] Aplicando Postgres, api-monitoring, Prometheus, Grafana y el frontend de monitoreo..."
    minikube kubectl -- apply `
        -f k8s\postgres-statefulset.yaml `
        -f k8s\postgres-service.yaml `
        -f k8s\api-monitoring-deployment.yaml `
        -f k8s\api-monitoring-service.yaml `
        -f k8s\prometheus-configmap.yaml `
        -f k8s\prometheus-rbac.yaml `
        -f k8s\prometheus-deployment.yaml `
        -f k8s\prometheus-service.yaml `
        -f k8s\grafana-datasource-configmap.yaml `
        -f k8s\grafana-dashboard-configmap.yaml `
        -f k8s\grafana-alerting-configmap.yaml `
        -f k8s\grafana-deployment.yaml `
        -f k8s\grafana-service.yaml `
        -f k8s\frontend-monitoring-deployment.yaml `
        -f k8s\frontend-monitoring-service.yaml
    Confirm-NativeCommand -Step "aplicar los manifiestos de monitoreo"

    minikube kubectl -- rollout restart deployment/api-monitoring --namespace=clinica-veterinaria
    Confirm-NativeCommand -Step "reiniciar api-monitoring con la imagen recien construida"

    # "kubectl apply" sobre un ConfigMap no reinicia solo los Pods que lo montan
    # (Kubernetes no recarga el archivo en caliente). Sin este restart, si
    # alguien ya tenia Prometheus/Grafana corriendo de una corrida anterior y
    # volvio a correr este script despues de cambiar prometheus-config o
    # grafana-datasources, quedarian corriendo con la config vieja en memoria.
    minikube kubectl -- rollout restart deployment/prometheus --namespace=clinica-veterinaria
    Confirm-NativeCommand -Step "reiniciar Prometheus para que relea su ConfigMap"

    minikube kubectl -- rollout restart deployment/grafana --namespace=clinica-veterinaria
    Confirm-NativeCommand -Step "reiniciar Grafana para que relea su ConfigMap"

    minikube kubectl -- rollout restart deployment/frontend-monitoring --namespace=clinica-veterinaria
    Confirm-NativeCommand -Step "reiniciar el frontend de monitoreo con la imagen recien construida"

    Write-Host "Esperando a PostgreSQL..."
    minikube kubectl -- rollout status statefulset/postgres --namespace=clinica-veterinaria --timeout=180s
    Confirm-NativeCommand -Step "esperar a PostgreSQL"

    Write-Host "Actualizando el catalogo de especies en la base existente..."
    # No se usa Confirm-NativeCommand a proposito: este paso corrige un permiso
    # puntual sobre "especie" y no tiene que frenar el despliegue de
    # api-monitoring/Prometheus/Grafana si falla por algo transitorio (por
    # ejemplo, Postgres todavia terminando de levantar).
    Get-Content -LiteralPath (Join-Path $projectRoot "db\migrations\01_catalogo_especies.sql") -Raw |
        minikube kubectl -- exec -i postgres-0 --namespace=clinica-veterinaria -- psql -U postgres -d postgres -v ON_ERROR_STOP=1

    if ($LASTEXITCODE -ne 0) {
        Write-Warning "No se pudo aplicar db\migrations\01_catalogo_especies.sql (codigo $LASTEXITCODE). Continuando: el resto del monitoreo no depende de este fix. Si el panel/endpoint de especies falla mas adelante, correr este paso a mano."
    }

    Write-Host "Esperando a api-monitoring..."
    minikube kubectl -- rollout status deployment/api-monitoring --namespace=clinica-veterinaria --timeout=180s
    Confirm-NativeCommand -Step "esperar a api-monitoring"

    Write-Host "Esperando a Prometheus..."
    minikube kubectl -- rollout status deployment/prometheus --namespace=clinica-veterinaria --timeout=180s
    Confirm-NativeCommand -Step "esperar a Prometheus"

    Write-Host "Esperando a Grafana..."
    minikube kubectl -- rollout status deployment/grafana --namespace=clinica-veterinaria --timeout=180s
    Confirm-NativeCommand -Step "esperar a Grafana"

    Write-Host "Esperando al frontend de monitoreo..."
    minikube kubectl -- rollout status deployment/frontend-monitoring --namespace=clinica-veterinaria --timeout=180s
    Confirm-NativeCommand -Step "esperar al frontend de monitoreo"

    Write-Host "[9/9] Estado final de los recursos:"
    # Por nombre, no por label: los Deployments de este script no tienen
    # labels propios a nivel de metadata (solo en la plantilla del Pod), asi
    # que un "-l" sobre el recurso Deployment/Service no encuentra nada.
    minikube kubectl -- get deployment/api-monitoring deployment/prometheus deployment/grafana deployment/frontend-monitoring service/api-monitoring service/prometheus service/grafana service/frontend-monitoring --namespace=clinica-veterinaria
    Confirm-NativeCommand -Step "consultar el estado final"

    Write-Host ""
    Write-Host "Listo. Para ver el dashboard de Grafana:"
    Write-Host "powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\k8s-open-grafana.ps1"
    Write-Host ""
    Write-Host "Para usar la app y generar actividad real (turnos, logins, etc.) que se vea en el dashboard:"
    Write-Host "minikube service frontend-monitoring --namespace=clinica-veterinaria --url"
    Write-Host ""
    Write-Host "Para probar la API de monitoreo directamente (Swagger), sin pasar por el frontend:"
    Write-Host "minikube service api-monitoring --namespace=clinica-veterinaria --url"
}
finally {
    Pop-Location
}
