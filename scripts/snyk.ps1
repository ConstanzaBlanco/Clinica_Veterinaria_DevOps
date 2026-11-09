# Ejecuta Snyk sobre las dependencias del backend (uv.lock) y del frontend
# (frontend/package.json) y guarda el resultado en reports/snyk-report.txt.
# Requisitos: snyk (npm i -g snyk) con la sesion iniciada (snyk auth) y uv instalado.
# Uso, desde cualquier carpeta: .\scripts\snyk.ps1
param(
    [string]$Salida = ""
)

# Para que los acentos y simbolos de la salida de Snyk se guarden bien.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$raiz = Split-Path -Parent $PSScriptRoot
if ($Salida -eq "") { $Salida = Join-Path $raiz "reports\snyk-report.txt" }
$tmp = Join-Path $env:TEMP "snyk-backend"

# Snyk de esta cuenta no soporta uv.lock directamente, asi que se exporta a
# requirements.txt (mismas versiones) y se instala en un entorno temporal.
if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
New-Item -ItemType Directory -Force $tmp | Out-Null

Push-Location $raiz
uv export --frozen --no-hashes --no-dev --no-emit-project --format requirements-txt -o "$tmp\requirements.txt" | Out-Null
uv venv --seed --python 3.13 "$tmp\venv" | Out-Null
uv pip install --python "$tmp\venv\Scripts\python.exe" -r "$tmp\requirements.txt" | Out-Null
Pop-Location

# --skip-unresolved: uvloop solo existe en Linux y no se puede instalar en Windows.
Push-Location $tmp
$backend = snyk test --file=requirements.txt --package-manager=pip --command="$tmp\venv\Scripts\python.exe" --skip-unresolved | Out-String
Pop-Location

# --dev: tambien revisa las dependencias de desarrollo (vite, oxlint, etc.).
Push-Location (Join-Path $raiz "frontend")
$frontend = snyk test --dev | Out-String
Pop-Location

$informe = @"
SNYK - Reporte de dependencias
Fecha: $(Get-Date -Format "yyyy-MM-dd HH:mm")

========== BACKEND (uv.lock) ==========
Notas:
- Snyk no soporta uv.lock en esta cuenta: se exporto uv.lock a requirements.txt
  (mismas versiones) y se analizo ese archivo.
- uvloop no se analizo: solo existe en Linux y no se puede instalar en Windows.
$backend
========== FRONTEND (frontend/package.json) ==========
Nota: se uso --dev para incluir tambien las dependencias de desarrollo.
$frontend
"@

New-Item -ItemType Directory -Force (Split-Path -Parent $Salida) | Out-Null
$informe | Out-File $Salida -Encoding utf8
Remove-Item -Recurse -Force $tmp
Write-Host "Reporte guardado en $Salida"
