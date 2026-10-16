Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

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
    "k8s\prometheus-deployment.yaml",
    "k8s\prometheus-service.yaml",
    "k8s\grafana-datasource-configmap.yaml",
    "k8s\grafana-dashboard-configmap.yaml",
    "k8s\grafana-alerting-configmap.yaml",
    "k8s\grafana-deployment.yaml",
    "k8s\grafana-service.yaml",
    "db\init\01_schema.sql",
    "db\init\02_permisos.sql",
    "db\init\03_excepcion_disponibilidad.sql",
    "db\init\04_datos_prueba.sql"
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

    Write-Host "[3/8] Construyendo la imagen de la API (clinica-veterinaria:monitoring)..."
    minikube image build -t clinica-veterinaria:monitoring .
    Confirm-NativeCommand -Step "construir la imagen de la API"

    Write-Host "[4/8] Creando el namespace..."
    minikube kubectl -- apply -f k8s\namespace.yaml
    Confirm-NativeCommand -Step "crear el namespace"

    Write-Host "[5/8] Creando o actualizando los Secrets..."
    $secretManifest = minikube kubectl -- create secret generic postgres-secret --from-file=db-password=db/password.txt --namespace=clinica-veterinaria --dry-run=client -o yaml
    Confirm-NativeCommand -Step "generar el Secret de PostgreSQL"
    $secretManifest | minikube kubectl -- apply -f -
    Confirm-NativeCommand -Step "aplicar el Secret de PostgreSQL"

    $jwtSecretManifest = minikube kubectl -- create secret generic jwt-secret --from-file=jwt-secret=db/jwt-secret.txt --namespace=clinica-veterinaria --dry-run=client -o yaml
    Confirm-NativeCommand -Step "generar el Secret JWT"
    $jwtSecretManifest | minikube kubectl -- apply -f -
    Confirm-NativeCommand -Step "aplicar el Secret JWT"

    Write-Host "[6/8] Creando o actualizando el ConfigMap con los SQL..."
    $configMapManifest = minikube kubectl -- create configmap postgres-init --from-file=db/init --namespace=clinica-veterinaria --dry-run=client -o yaml
    Confirm-NativeCommand -Step "generar el ConfigMap de PostgreSQL"
    $configMapManifest | minikube kubectl -- apply -f -
    Confirm-NativeCommand -Step "aplicar el ConfigMap de PostgreSQL"

    Write-Host "[7/8] Aplicando Postgres, api-monitoring, Prometheus y Grafana..."
    minikube kubectl -- apply `
        -f k8s\postgres-statefulset.yaml `
        -f k8s\postgres-service.yaml `
        -f k8s\api-monitoring-deployment.yaml `
        -f k8s\api-monitoring-service.yaml `
        -f k8s\prometheus-configmap.yaml `
        -f k8s\prometheus-deployment.yaml `
        -f k8s\prometheus-service.yaml `
        -f k8s\grafana-datasource-configmap.yaml `
        -f k8s\grafana-dashboard-configmap.yaml `
        -f k8s\grafana-alerting-configmap.yaml `
        -f k8s\grafana-deployment.yaml `
        -f k8s\grafana-service.yaml
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

    Write-Host "Esperando a PostgreSQL..."
    minikube kubectl -- rollout status statefulset/postgres --namespace=clinica-veterinaria --timeout=180s
    Confirm-NativeCommand -Step "esperar a PostgreSQL"

    Write-Host "Esperando a api-monitoring..."
    minikube kubectl -- rollout status deployment/api-monitoring --namespace=clinica-veterinaria --timeout=180s
    Confirm-NativeCommand -Step "esperar a api-monitoring"

    Write-Host "Esperando a Prometheus..."
    minikube kubectl -- rollout status deployment/prometheus --namespace=clinica-veterinaria --timeout=180s
    Confirm-NativeCommand -Step "esperar a Prometheus"

    Write-Host "Esperando a Grafana..."
    minikube kubectl -- rollout status deployment/grafana --namespace=clinica-veterinaria --timeout=180s
    Confirm-NativeCommand -Step "esperar a Grafana"

    Write-Host "[8/8] Estado final de los recursos:"
    # Por nombre, no por label: los Deployments de este script no tienen
    # labels propios a nivel de metadata (solo en la plantilla del Pod), asi
    # que un "-l" sobre el recurso Deployment/Service no encuentra nada.
    minikube kubectl -- get deployment/api-monitoring deployment/prometheus deployment/grafana service/api-monitoring service/prometheus service/grafana --namespace=clinica-veterinaria
    Confirm-NativeCommand -Step "consultar el estado final"

    Write-Host ""
    Write-Host "Listo. Para ver el dashboard de Grafana:"
    Write-Host "powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\k8s-open-grafana.ps1"
    Write-Host ""
    Write-Host "Para probar la API de monitoreo directamente (Swagger):"
    Write-Host "minikube service api-monitoring --namespace=clinica-veterinaria --url"
}
finally {
    Pop-Location
}
