$ErrorActionPreference = "Stop"

Write-Host "Construyendo y levantando la aplicacion con dos replicas..."

docker compose up --build -d --scale server=2

if ($LASTEXITCODE -ne 0) {
    throw "No se pudo levantar la aplicacion."
}

Write-Host "Actualizando el balanceador..."

docker compose up -d --no-deps --force-recreate balanceador

if ($LASTEXITCODE -ne 0) {
    throw "No se pudo iniciar el balanceador."
}

Write-Host ""
Write-Host "Aplicación iniciada."
Write-Host "Frontend: http://localhost:5173"
Write-Host "API: http://localhost:8000"
Write-Host "Documentación: http://localhost:8000/docs"
Write-Host ""
Write-Host "Contenedores:"
docker compose ps