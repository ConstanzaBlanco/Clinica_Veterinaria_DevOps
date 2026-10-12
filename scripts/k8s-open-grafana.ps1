Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$namespace = "clinica-veterinaria"

Write-Host "Abriendo un tunel hacia Grafana (dejar esta terminal abierta)..."
Write-Host "Usuario/contrasenia por defecto: admin / admin (pide cambiarla en el primer login)."
Write-Host ""

minikube service grafana --namespace=$namespace --url

if ($LASTEXITCODE -ne 0) {
    throw "No se pudo abrir el tunel hacia Grafana. Comprobar que el Deployment 'grafana' este desplegado y disponible."
}
