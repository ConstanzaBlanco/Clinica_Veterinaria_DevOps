{{/*
Funciones reutilizables por todas las plantillas. Los archivos que empiezan
con "_" no generan recursos: solo definen bloques que se llaman con include.
*/}}

{{/*
Labels comunes que llevan todos los recursos de la chart. Las recomienda
Kubernetes y permiten, por ejemplo, listar todo lo de esta instalación con:
  kubectl get all -l app.kubernetes.io/instance=<nombre-del-release>
*/}}
{{- define "petcore.labels" -}}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
{{- end }}

{{/*
Labels que usa un Service para encontrar los Pods de un componente.
Se llama con un diccionario: (dict "ctx" $ "component" "api").
Tienen que ser estables: si cambian, el Deployment no se puede actualizar.
*/}}
{{- define "petcore.selectorLabels" -}}
app.kubernetes.io/instance: {{ .ctx.Release.Name }}
app.kubernetes.io/component: {{ .component }}
{{- end }}
