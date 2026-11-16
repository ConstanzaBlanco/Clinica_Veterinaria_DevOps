#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
log_file="$repo_dir/reports/falco-event.log"

mkdir -p "$repo_dir/reports"
printf 'Guardando alertas de petcore en %s\n' "$log_file"
printf 'Presiona Ctrl+C para detener la captura.\n'

minikube kubectl -- logs -n falco \
    -l app.kubernetes.io/name=falco -c falco --tail=0 --follow |
    awk '/"k8s[.]ns[.]name"[[:space:]]*:[[:space:]]*"petcore"/ && /"rule"[[:space:]]*:/ {
        print
        fflush()
    }' |
    tee -a "$log_file"