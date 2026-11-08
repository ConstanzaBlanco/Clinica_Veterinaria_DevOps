{{/*
Corta la instalación con un mensaje claro si falta algo que la chart NO crea
(los Secrets y el ConfigMap con los SQL; ver values.yaml). Sin esto, Helm
instala "bien" y los Pods quedan trabados en ContainerCreating sin decir por qué.

"lookup" consulta el cluster en el momento de instalar. Con "helm template" o
"helm lint" no hay cluster y lookup siempre devuelve vacío, así que primero se
chequea si hay conexión: el namespace kube-system existe en todo cluster, si
no aparece es que no estamos conectados y se saltea la validación.
*/}}
{{- define "petcore.validarPrerequisitos" -}}
{{- if lookup "v1" "Namespace" "" "kube-system" -}}
{{- $ns := .Release.Namespace -}}
{{- $faltan := list -}}
{{- range $nombre := list .Values.secrets.postgres .Values.secrets.jwt -}}
{{- if not (lookup "v1" "Secret" $ns $nombre) -}}
{{- $faltan = append $faltan (printf "Secret %s" $nombre) -}}
{{- end -}}
{{- end -}}
{{- if not (lookup "v1" "ConfigMap" $ns .Values.postgres.initConfigMap) -}}
{{- $faltan = append $faltan (printf "ConfigMap %s" .Values.postgres.initConfigMap) -}}
{{- end -}}
{{- if $faltan -}}
{{- fail (printf "\n\nFaltan recursos en el namespace %q: %s.\nLa chart no los crea (contienen contraseñas o los SQL de db/init/).\nCorré primero:  bash scripts/4to_entregable/preparar-chart.sh %s\n" $ns (join ", " $faltan) $ns) -}}
{{- end -}}
{{- end -}}
{{- end -}}
