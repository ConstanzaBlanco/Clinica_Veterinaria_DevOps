# Plan del entregable DevSecOps

Fuente: `Entregable 3 DevSecOps.docx`. Cubre 4 áreas: código, imagen, Kubernetes y tiempo de ejecución.

## Decisiones acordadas

1. **Todo se aplica solo en `main`.** No se toca blue ni green. Rama de integración: `devsecops`, creada desde `main`. Cada persona trabaja en una sub-rama (`devsecops/codigo`, `devsecops/imagenes`, `devsecops/k8s`, `devsecops/falco`) y se mergea a `devsecops`.
2. **Reemplazo de `latest`:** se fija un tag explícito.
   - Imágenes propias: tag con la fecha de build (por ejemplo `clinica-veterinaria:2026-10-29`).
   - Grafana y Prometheus (`grafana/grafana:latest`, `prom/prometheus:latest`): sus registries no publican tags por fecha, así que se fija el **número de versión** de la imagen oficial (por ejemplo `grafana/grafana:12.x.y`), que es lo que sí permite reproducir el despliegue. Fijar la versión es lo seguro; un tag propio por fecha sobre una imagen de terceros no garantiza qué contenido tiene.
3. **Informe incremental y compartido:** hay un único `ENTREGABLE_3_DEVSECOPS.md`, con el esqueleto creado en la Etapa 0. Cada persona completa **su propia sección** a medida que hace cada paso, siguiendo el punteo "Para el informe" de su etapa. Nadie arma el informe al final: al terminar, el informe ya está escrito. Las secciones están separadas por encabezados fijos para evitar conflictos de merge.
4. **Evidencia:** cada reporte se guarda en `reports/` en cuanto se genera. Nada de reconstruir comandos a último momento.

## Estado actual del proyecto (qué hay que arreglar)

| Aspecto | Estado hoy | Impacto | Solucionado - fecha |
|---|---|---|
| Namespace | `clinica-veterinaria` | Las políticas se aplican acá; hay que excluir `kube-system`, `kyverno` y `falco`. | |
| Backend | `Dockerfile` raíz, `python:3.13-slim`, **sin `USER`** (corre como root) | Trivy lo marca; viola política 3. | |
| Frontend | `frontend/Dockerfile.k8s`, `nginx-unprivileged`, `USER nginx` | Ya es no root. `npm audit` va en `frontend/`. | |
| Imágenes `latest` | `grafana/grafana:latest`, `prom/prometheus:latest` | Violan política 1. | Solucionados desde P3 - 1/11/2026 |
| `resources` | Solo `api-monitoring-deployment`. En postgres solo existe `storage`, no hay requests/limits de cpu y memoria. | Violan política 2 en: api-blue, api-green, frontend-blue, frontend-green, postgres, grafana, prometheus. | Solucionados desde P3 - 1/11/2026 |
| `securityContext` | No hay en ningún manifiesto | Viola política 3 en todos. |Solucionados desde P3 - 1/11/2026 |
| Despliegue | `scripts/k8s-up.ps1` (solo rama `blue`), `k8s-up-green.ps1` (green) y `k8s-up-monitoring.ps1` (**sin restricción de rama**, levanta postgres, api-monitoring, Prometheus y Grafana, sin frontend) | Para `main` se usa `k8s-up-monitoring.ps1`. Los scripts de blue y green **no se tocan**. |
| Carpeta `reports/` | No existe | Crearla. | Ya creada y con reportes listos |

Herramientas a instalar: Semgrep, Trivy, KubeLinter, Helm, Kyverno CLI opcional y Falco (por Helm). `kubectl` y Docker ya están.

Archivos finales en `reports/`: `npm-audit.txt`, `trivyreport.txt`, `kubelinter.txt`, `falco-event.log`, más los extras `semgrep.txt` y `kyverno-validacion.txt`.

---

## Etapa 0: Preparación (todos, ~1 h)

1. `git checkout main; git pull`.
2. `git checkout -b devsecops` y `git push -u origin devsecops` (el push de esta rama lo hace quien corresponda del equipo).
3. Crear `reports/.gitkeep` y el esqueleto de `ENTREGABLE_3_DEVSECOPS.md` (ver "Esqueleto del informe" al final de este documento) en `devsecops`. Mergear antes de que cada uno cree su sub-rama.
4. Cada persona crea su sub-rama desde `devsecops`.
5. Instalar las herramientas propias (ver tabla del reparto).
6. Verificar que Minikube levanta desde `main` con `scripts/k8s-up-monitoring.ps1`. Ese script no exige rama y construye `clinica-veterinaria:monitoring`. Los scripts de blue y green quedan intactos. Como no despliega el frontend, el frontend se prueba aparte con `kubectl apply -f k8s/frontend-blue-deployment.yaml` (o green) una vez construida su imagen con `minikube image build -t clinica-frontend:<tag> -f Dockerfile.k8s frontend`.

---

## Etapa 1: Seguridad en el código (P1)

Rama: `devsecops/codigo`. Documenta en su sección de `ENTREGABLE_3_DEVSECOPS.md`.

1. **npm audit**
   - `cd frontend`
   - `npm audit > ../reports/npm-audit.txt` (guardar el resultado inicial; si el archivo queda vacío o dice "found 0 vulnerabilities", igual se entrega).
   - Si hay hallazgos: `npm audit fix` (sin `--force`), volver a correr el audit y guardar el resultado final.
   - Si se guardan los dos (antes y después), nombrarlos `npm-audit.txt` (final) y `npm-audit-inicial.txt`.
   - Revisar que los cambios en `package.json` y `package-lock.json` no rompan: `npm run build` y `npm run lint`.
2. **Semgrep**
   - `pip install semgrep` (o `pipx install semgrep`). En Windows puede fallar, y entonces se corre por Docker: `docker run --rm -v ${PWD}:/src semgrep/semgrep semgrep --config auto /src/app /src/frontend/src`.
   - `semgrep --config auto app frontend/src > reports/semgrep.txt`
   - Opcional: sumar `--config p/python --config p/react --config p/jwt`.
3. **Triage.** Para cada hallazgo:
   - Revisar el código real, no solo la regla.
   - Decidir: corregir, o mantener con justificación (falso positivo, riesgo aceptado, alcance local).
   - Zonas probables: `app/config.py` (credenciales y secretos), `app/Auth/` (JWT, hash), `app/Middleware/middleware.py` (CORS), repositorios con SQL.
   - Corregir en la sub-rama con commits pequeños, un hallazgo por commit.
4. **Documentación:** completar la sección 2 del informe (ver "Para el informe" abajo).
5. Verificar que los tests no se rompan: `uv run pytest` (hay carpeta `tests/`).

**Entregables:** `reports/npm-audit.txt`, `reports/semgrep.txt`, correcciones y la sección 2 del informe.

**Para el informe (sección 2):**
- Explicación de qué es `npm audit` y qué es Semgrep (análisis de dependencias vs. análisis estático del código), y por qué se usan.
- Comandos exactos ejecutados y versión de cada herramienta.
- Resultado de `npm audit`: cantidad de vulnerabilidades por severidad, antes y después de `npm audit fix`.
- Resultado de Semgrep: reglas usadas, cantidad de hallazgos y cuáles son los relevantes.
- Tabla de triage: hallazgo, archivo, severidad, decisión (corregido o mantenido) y justificación.
- Qué se corrigió en el código (con referencia al commit).
- Captura o extracto de los reportes en `reports/`.

---

## Etapa 2: Seguridad en la imagen (P2)

Rama: `devsecops/imagenes`. Documenta en su sección de `ENTREGABLE_3_DEVSECOPS.md`.

**Prioridad:** el `Dockerfile` no root es lo primero porque desbloquea a P3. Hacer un PR chico con eso a `devsecops` antes de seguir.

1. **Primer paso: `USER` no root en el backend** (`Dockerfile`).
   - Crear un usuario con UID fijo (por ejemplo 10001): `RUN useradd --uid 10001 --no-create-home app` y `USER 10001`. Un UID numérico es necesario para que Kyverno y `runAsNonRoot` puedan verificar que no es root.
   - `uv sync --locked` crea el entorno en `/app/.venv`: asegurarse de que ese directorio sea legible por el usuario nuevo (`COPY --chown` o `chown` en el `RUN`). Si `uv run` intenta escribir cache o `.venv`, hace falta una carpeta escribible (`UV_CACHE_DIR=/tmp/uv`).
   - Probar localmente: `docker build -t clinica-veterinaria:test .` y `docker run --rm clinica-veterinaria:test id` (debe mostrar uid 10001).
2. **Escaneo inicial** (antes de más cambios, para tener el "antes"):
   - `trivy image --severity CRITICAL,HIGH clinica-veterinaria:test > reports/trivyreport.txt`
   - Agregar a continuación el de la imagen de frontend: `trivy image --severity CRITICAL,HIGH clinica-frontend:test >> reports/trivyreport.txt` (poner un título de sección antes de cada uno).
   - Opcional: escanear también `postgres:18` y las imágenes fijadas de grafana y prometheus.
3. **Resolver:**
   - Fijar la base con tag específico (o digest) en vez de `python:3.13-slim` genérico.
   - Actualizar dependencias con CVE (en `pyproject.toml` y regenerar `uv.lock`).
   - Si Trivy marca paquetes del sistema base sin parche, documentarlos.
4. **Documentar lo que queda:** CVE, paquete, versión instalada, versión corregida (si existe), decisión y justificación.
5. **Reescanear** y dejar el reporte final en `reports/trivyreport.txt`.
6. Avisar a P3 apenas esté el UID elegido, porque ese número va en el `securityContext` del backend.

**Entregables:** `reports/trivyreport.txt`, `Dockerfile` corregido y la sección 3 del informe.

**Para el informe (sección 3):**
- Explicación de qué es Trivy y qué analiza en una imagen (paquetes del sistema y dependencias).
- Imágenes escaneadas (backend, frontend y, si se hizo, postgres, grafana, prometheus) y comandos usados.
- Resultado inicial: cantidad de CRITICAL y HIGH por imagen.
- Cambios hechos en el `Dockerfile` (usuario no root, base fijada, dependencias actualizadas) y por qué.
- Resultado final tras corregir.
- Tabla de CVE no resueltos: CVE, paquete, versión, ¿hay fix?, decisión y justificación.
- Extracto del `trivyreport.txt`.

---

## Etapa 3: Seguridad en Kubernetes (P3 y P4)

### 3a. Hardening de manifiestos (P3) - Listo (01/11/2026)

Rama: `devsecops/k8s`. Documenta en su sección de `ENTREGABLE_3_DEVSECOPS.md`.

Aplicar a: `api-blue`, `api-green`, `api-monitoring`, `frontend-blue`, `frontend-green`, `grafana`, `prometheus`, `postgres-statefulset`. Aunque blue/green no se despliegan en `main`, los manifiestos están en el repo y KubeLinter y Kyverno los evalúan igual.

1. **Tags:**
   - Grafana y Prometheus: fijar versión (ver decisión 2).
   - Imágenes propias: tag con la fecha. Tocar solo `k8s-up-monitoring.ps1` (que construye con `monitoring`) si se cambia el tag de `api-monitoring`; **no modificar** `k8s-up.ps1`, `k8s-up-green.ps1` ni los scripts de switch, así blue y green siguen funcionando. Los manifiestos blue/green mantienen sus tags `v1`/`v2` (no son `latest`, cumplen la política 1).
   - `postgres:18` ya tiene tag.
2. **Resources**, en cada contenedor, con requests y limits de cpu y memoria. Valores de partida (ajustar mirando `kubectl top pod`):
   - API: requests `100m` / `128Mi`, limits `1` / `512Mi` (ya están en `api-monitoring`; copiar).
   - Frontend: requests `50m` / `64Mi`, limits `250m` / `128Mi`.
   - Postgres: requests `100m` / `256Mi`, limits `500m` / `512Mi`.
   - Grafana: requests `100m` / `128Mi`, limits `500m` / `256Mi`.
   - Prometheus: requests `100m` / `256Mi`, limits `500m` / `512Mi`.
3. **securityContext** en cada Pod/contenedor:
   - Pod: `runAsNonRoot: true`, `runAsUser` y `runAsGroup` explícitos, `fsGroup` si hay volúmenes, `seccompProfile.type: RuntimeDefault`.
   - Contenedor: `allowPrivilegeEscalation: false`, `capabilities.drop: [ALL]`, `readOnlyRootFilesystem: true` donde la app lo soporte (si hace falta escribir, montar un `emptyDir` en `/tmp`).
   - UIDs de partida: API el elegido por P2 (por ejemplo 10001), frontend 101 (usuario `nginx` de la imagen unprivileged), postgres 999, grafana 472, prometheus 65534. Verificar cada uno con `kubectl exec ... -- id` o con la documentación de la imagen.
   - Postgres, grafana y prometheus escriben en volúmenes: usar `fsGroup` igual al UID del proceso, y probar que el pod arranque sin errores de permisos.
4. **Despliegue de prueba en Minikube** (todo debe quedar `Running`), antes de pasar a Kyverno. Se despliega con `scripts/k8s-up-monitoring.ps1`, que funciona desde `main`.
5. Documentar cada cambio y por qué (sección 4.1 del informe).

### 3b. Kyverno (P3) - Listo (01/11/2026)

1. Instalar:
   - `helm repo add kyverno https://kyverno.github.io/kyverno/`
   - `helm repo update`
   - `helm install kyverno kyverno/kyverno -n kyverno --create-namespace`
   - `kubectl get pods -n kyverno` hasta que estén `Running`.
2. Crear `k8s/policies/` con tres `ClusterPolicy`:
   - `disallow-latest-tag.yaml`: regla `validate` sobre `Pod`. Patrón `image: "!*:latest"` y además exigir que tenga tag (`*:*`). Usar `validationFailureAction: Enforce`.
   - `require-resources.yaml`: exige `resources.requests.cpu`, `requests.memory`, `limits.cpu` y `limits.memory` con patrón `"?*"`.
   - `disallow-root.yaml`: exige `runAsNonRoot: true` (a nivel de Pod o de contenedor).
   - En las tres: `match` sobre `Pod`, y `exclude` de los namespaces `kube-system`, `kyverno`, `falco`. Kyverno aplica a Deployments y StatefulSets porque evalúa los Pods que éstos generan, y el autogen de reglas para controladores ya viene activo por defecto.
3. Aplicar: `kubectl apply -f k8s/policies/` y verificar con `kubectl get clusterpolicy`.
4. **Validación con manifiesto no conforme.** Crear `k8s/policies/test/pod-no-conforme.yaml` con:
   - `image: nginx:latest`
   - sin `resources`
   - sin `securityContext` (corre como root)
   - `namespace: clinica-veterinaria`
   - Ejecutar `kubectl apply -f k8s/policies/test/pod-no-conforme.yaml`: debe ser rechazado. Guardar la salida completa, que muestra el mensaje de cada política violada.
   - Probar también cada política por separado (tres variantes del manifiesto, cada una violando solo una regla) para demostrar que las tres funcionan.
   - Crear `k8s/policies/test/pod-conforme.yaml` y comprobar que pasa.
   - Volver a aplicar `k8s/` completo: todo debe pasar. Si algo se rechaza, volver a 3a.
5. Guardar todo en `reports/kyverno-validacion.txt` y completar las secciones 4.1 y 4.2 del informe.

### 3c. KubeLinter (P4)

Rama: `devsecops/falco` (o una propia). Documenta en su sección de `ENTREGABLE_3_DEVSECOPS.md`. **Depende de que P3 termine 3a.** Mientras tanto se puede correr una primera pasada para conocer los hallazgos.

1. Instalar KubeLinter (binario de GitHub releases, `scoop install kube-linter` o `go install`).
2. `kube-linter lint k8s/ > reports/kubelinter.txt`. Guardar primero el resultado "antes" como `reports/kubelinter-inicial.txt` (extra).
3. Después del hardening de P3, repetir y dejar el final en `reports/kubelinter.txt`.
4. Hallazgos habituales a corregir: `no-read-only-root-fs`, `run-as-non-root`, `unset-cpu-requirements`, `unset-memory-requirements`, `latest-tag`, `no-liveness-probe`, `no-readiness-probe`, `privilege-escalation-container`.
5. Los que se mantengan (por ejemplo, ConfigMaps de dashboards, o `readOnlyRootFilesystem` en postgres), justificarlos en el informe. Si se quiere silenciar un chequeo concreto, crear `.kube-linter.yaml` con `checks.exclude` y explicar el motivo.

**Entregables:** `k8s/policies/*.yaml`, `k8s/policies/test/*.yaml`, manifiestos endurecidos, `reports/kubelinter.txt`, `reports/kyverno-validacion.txt` y las secciones 4.1, 4.2 y 4.3 del informe.

**Para el informe (secciones 4.1, 4.2 y 4.3):**
- *4.1 Hardening (P3):* explicación de cada concepto aplicado (tag fijo, requests y limits, `runAsNonRoot`, `allowPrivilegeEscalation`, `capabilities`, `readOnlyRootFilesystem`, `fsGroup`). Tabla por manifiesto con qué se cambió y por qué. Versiones fijadas de Grafana y Prometheus. --> Listo
- *4.2 Kyverno (P3):* qué es Kyverno y cómo actúa (admission controller). Cómo se instaló. Explicación de cada una de las tres políticas (qué regla, qué valida, `Enforce`, namespaces excluidos). Procedimiento de validación con el manifiesto no conforme, con el mensaje de rechazo pegado, la prueba de cada política por separado, y el manifiesto conforme que sí pasa. Confirmación de que los manifiestos reales del proyecto pasan. --> Listo
- *4.3 KubeLinter (P4):* qué es y qué chequea. Comando usado. Hallazgos iniciales vs. finales. Lista de hallazgos corregidos y de los mantenidos con su justificación. Si se usó `.kube-linter.yaml`, el motivo de cada exclusión.

---

## Etapa 4: Seguridad en tiempo de ejecución, Falco (P4)

Rama: `devsecops/falco`. Documenta en su sección de `ENTREGABLE_3_DEVSECOPS.md`. **Conviene empezarla el día 1**, porque es la parte con más riesgo técnico.

1. Instalar:
   - `helm repo add falcosecurity https://falcosecurity.github.io/charts`
   - `helm repo update`
   - `helm install falco falcosecurity/falco -n falco --create-namespace --set driver.kind=modern_ebpf --set tty=true`
   - Si falla por el driver en Minikube con Docker, alternativas: `driver.kind=ebpf`, o iniciar Minikube con otro driver (`--driver=hyperv` o `--driver=virtualbox`) o usar `--set driver.kind=kmod`. Documentar qué se probó.
2. Verificar: `kubectl get pods -n falco` (`Running`) y `kubectl logs -n falco -l app.kubernetes.io/name=falco` sin errores de driver.
3. **Generar el evento sospechoso.** En una terminal: `kubectl logs -n falco -l app.kubernetes.io/name=falco -f`. En otra: `kubectl exec -it -n clinica-veterinaria deploy/<api> -- /bin/sh` (o `bash`), y dentro correr algún comando (por ejemplo `cat /etc/shadow`).
   - Esperado: la alerta "Notice A shell was spawned in a container with an attached terminal".
   - Si no sale: revisar que la regla esté activa (`falco_rules.yaml`) y que `tty` esté habilitado.
4. **Guardar la evidencia:** `kubectl logs -n falco -l app.kubernetes.io/name=falco --tail=-1 > reports/falco-event.log` (o filtrar con `| Select-String "shell"`). Que la línea del evento esté visible, con timestamp, pod y namespace.
5. Opcional: regla custom en `values.yaml` (por ejemplo, lectura de `/etc/shadow` o conexión saliente inesperada) y capturar su alerta también.
6. **Nota:** con `readOnlyRootFilesystem` o sin shell en la imagen, el `exec` puede fallar. La imagen del backend es `python-slim` y tiene `/bin/sh`, y la del frontend (alpine) también.

**Entregables:** `reports/falco-event.log`, capturas y la sección 5 del informe.

**Para el informe (sección 5):**
- Explicación de qué es Falco y en qué se diferencia de las herramientas anteriores (detección en tiempo de ejecución vs. análisis previo).
- Cómo se instaló (comandos de Helm, driver elegido y por qué) y problemas encontrados.
- Verificación de que Falco corre (`kubectl get pods -n falco`).
- La acción sospechosa ejecutada (comando exacto, pod y namespace).
- La alerta generada, pegada tal cual, con timestamp, regla y pod.
- Interpretación: qué regla saltó y qué significa.
- Opcional: regla custom y su alerta.

---

## Etapa 5: Integración y entrega (todos)

1. Merge de las sub-ramas a `devsecops`, en este orden: P2 (Dockerfile), P1, P3, P4. Resolver conflictos entre todos.
2. En `devsecops`, desplegar de cero en Minikube con Kyverno activo y comprobar que todo levanta (prueba de humo).
3. Verificar que `reports/` contenga los archivos obligatorios y que no tengan datos sensibles (contraseñas, tokens, `db/password.txt`).
4. Revisar entre todos que `ENTREGABLE_3_DEVSECOPS.md` esté completo: que las secciones 1 a 6 no tengan pendientes, que el estilo sea parejo y que la sección 1 (resumen) y la 6 (hallazgos mantenidos) se escriban con aporte de los cuatro.
5. Agregar una sección DevSecOps al `README.md` con los comandos (la hace quien termine primero).
6. Revisión cruzada: P1 revisa P2, P2 revisa P3, P3 revisa P4, P4 revisa P1.
7. PR de `devsecops` a `main`.
8. Opcional: sumar stages de escaneo al `Jenkinsfile` (hoy solo existe en la rama `jenkins-multibranch`, así que queda fuera de alcance si todo va a `main`).

---

## Reparto resumido

| Persona | Etapas | Rama | Documento propio | Herramientas a instalar |
|---|---|---|---|---|
| **P1** | 1 | `devsecops/codigo` | Sección 2 del informe | Semgrep, Node (para npm audit) |
| **P2** | 2 | `devsecops/imagenes` | Sección 3 del informe | Trivy |
| **P3** | 3a, 3b | `devsecops/k8s` | Secciones 4.1 y 4.2 del informe | Helm, Kyverno |
| **P4** | 3c, 4 | `devsecops/falco` | Secciones 4.3 y 5 del informe | Helm, Falco, KubeLinter |

## Cronograma sugerido

| Día | P1 | P2 | P3 | P4 |
|---|---|---|---|---|
| 1 | npm audit y Semgrep | `USER` no root + PR chico | Tags, resources y securityContext de grafana, prometheus, postgres y frontend | Instalar Falco (probar el driver) |
| 2 | Triage y correcciones | Trivy, correcciones, reescaneo | Backend con el UID de P2; adaptar scripts; instalar Kyverno | Evento de Falco; primera pasada de KubeLinter |
| 3 | Completar sección 2 del informe | Completar sección 3 del informe | Políticas, manifiesto no conforme y validación | KubeLinter final |
| 4 | Revisión cruzada | Revisión cruzada | Revisión cruzada | Completar secciones 4.3 y 5 del informe |

## Riesgos

- **Orden:** si Kyverno entra en `Enforce` antes de endurecer los manifiestos, los pods actuales dejan de recrearse. Hacer 3a primero.
- **Falco en Minikube:** puede fallar por el driver del kernel. Probarlo temprano.
- **Volúmenes y `runAsNonRoot`:** postgres, grafana y prometheus necesitan `fsGroup` correcto o no arrancan.
- **Imágenes locales:** con `imagePullPolicy: Never` hay que reconstruir dentro de Minikube (`minikube image build`) tras cada cambio de Dockerfile.
- **Scripts de despliegue:** `k8s-up.ps1` falla fuera de `blue`. En `main` se usa `k8s-up-monitoring.ps1`, que no despliega el frontend, ni blue ni green.
- **Endurecer blue/green sin romperlos:** los manifiestos blue/green también se endurecen en `main`. Cada cambio de `securityContext` hay que probarlo desplegando blue y green al menos una vez (con sus scripts) antes del merge final.
- **Secretos:** no subir credenciales reales a los reportes ni al repo.

## Esqueleto del informe (`ENTREGABLE_3_DEVSECOPS.md`)

Se crea en la Etapa 0 con estos encabezados. Cada persona completa solo su sección.

```markdown
# Entregable 3 - DevSecOps

## 1. Resumen y herramientas        <!-- todos, al final -->
## 2. Seguridad en el código        <!-- P1 -->
## 3. Seguridad en la imagen        <!-- P2 -->
## 4. Seguridad en Kubernetes
### 4.1 Hardening de manifiestos    <!-- P3 -->
### 4.2 Políticas con Kyverno       <!-- P3 -->
### 4.3 Análisis con KubeLinter     <!-- P4 -->
## 5. Seguridad en tiempo de ejecución: Falco   <!-- P4 -->
## 6. Hallazgos mantenidos y justificación      <!-- todos, al final -->
## 7. Cómo reproducir todo          <!-- cada uno agrega sus comandos -->
```
