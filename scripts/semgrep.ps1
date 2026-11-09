# Analiza el backend (app/) con las reglas propias de .semgrep.yml
# y guarda el resultado en reports/semgrep-report.txt.
# Se ejecuta desde la raiz del proyecto: .\scripts\semgrep.ps1
docker run --rm `
  -v "${PWD}:/src" `
  semgrep/semgrep semgrep `
  --config /src/.semgrep.yml `
  --metrics=off `
  --output /src/reports/semgrep-report.txt `
  /src/app
