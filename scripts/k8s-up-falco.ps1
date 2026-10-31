Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Confirm-FalcoCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Step
    )

    if ($LASTEXITCODE -ne 0) {
        throw "Fallo el paso: $Step. Codigo: $LASTEXITCODE"
    }
}

if (-not (Get-Command helm -ErrorAction SilentlyContinue)) {
    throw "Falta Helm. Ejecuta: winget install --id Helm.Helm -e. Abri otra terminal y repeti el inicio."
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$reportsPath = Join-Path $projectRoot "reports"
$logPath = Join-Path $reportsPath "falco-event.log"
$logEncoding = New-Object System.Text.UTF8Encoding $false

# Registrar el repositorio oficial.
helm repo add falcosecurity https://falcosecurity.github.io/charts --force-update
Confirm-FalcoCommand -Step "registrar el repositorio de Falco"

helm repo update
Confirm-FalcoCommand -Step "actualizar los repositorios"

# Instalar en la primera ejecucion o actualizar la instalacion existente.
helm upgrade --install falco falcosecurity/falco `
    --version 9.2.2 `
    --kube-context minikube `
    --namespace falco `
    --create-namespace `
    --set driver.kind=modern_ebpf `
    --set tty=true `
    --set falco.json_output=true `
    --set falco.priority=notice `
    --set falco.buffered_outputs=false `
    --set falco.stdout_output.enabled=true `
    --values (Join-Path $projectRoot "k8s/falco-values.yaml") `
    --wait `
    --timeout 5m

Confirm-FalcoCommand -Step "instalar o actualizar Falco"

minikube kubectl -- get pods -n falco
Confirm-FalcoCommand -Step "consultar los pods de Falco"

# Preparar la carpeta y el archivo de evidencia.
New-Item -ItemType Directory -Force -Path $reportsPath | Out-Null

if (-not (Test-Path -LiteralPath $logPath)) {
    [System.IO.File]::WriteAllText($logPath, "", $logEncoding)
}

# Evitar guardar dos veces la misma alerta al reiniciar la captura.
$seen = New-Object 'System.Collections.Generic.HashSet[string]'

foreach ($savedLine in (Get-Content -LiteralPath $logPath -Encoding UTF8)) {
    [void]$seen.Add([string]$savedLine)
}

Write-Host ""
Write-Host "Guardado automatico activo: $logPath"
Write-Host "Se guardan todas las alertas JSON de Falco."
Write-Host "En pantalla se muestra la alerta de shell del backend."
Write-Host "Deja esta terminal abierta y ejecuta la prueba en otra terminal."
Write-Host "Ctrl+C detiene esta captura local; los pods siguen ejecutandose."
Write-Host ""

# Leer continuamente las alertas y agregarlas al archivo.
minikube kubectl -- logs -n falco -l app.kubernetes.io/name=falco -c falco --since=1m --tail=-1 --follow |
    ForEach-Object {
        $line = [string]$_

        if ($line -match '"rule"\s*:' -and $seen.Add($line)) {
            [System.IO.File]::AppendAllText(
                $logPath,
                $line + [Environment]::NewLine,
                $logEncoding
            )

            # Mostrar la prueba del backend sin llenar la pantalla
            # con alertas repetitivas de otros componentes.
            if (
                $line -match '"rule"\s*:\s*"Terminal shell in container"' -and
                $line -match 'api-monitoring-' -and
                $line -match 'clinica-veterinaria'
            ) {
                Write-Host $line -ForegroundColor Yellow
            }
        }
    }

Confirm-FalcoCommand -Step "capturar los logs de Falco"

Write-Host "La captura termino. Volve a ejecutar este script para continuar guardando."