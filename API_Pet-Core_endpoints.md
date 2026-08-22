# Pet-Core — Endpoints de la API

Organizados por pantalla del diseño. Base: `/api/v1`

## Prioridades

| | Significado |
|---|---|
| **P0** | Bloquea la TFU2. Sin esto no hay demo de tácticas. |
| **P1** | Núcleo del sistema. Sin esto la app no funciona. |
| **P2** | Completa el alcance definido en la UT1. |
| **P3** | Puede quedar para el final. |

**Convención de errores**

| Código | Cuándo |
|---|---|
| 400 | Datos mal formados |
| 401 | Sin sesión o sesión expirada |
| 403 | Rol sin permiso para la operación |
| 404 | Recurso inexistente o fuera del alcance del rol |
| 409 | Conflicto de estado (horario tomado, plazo vencido, ventana cerrada) |
| 422 | Regla de negocio incumplida |

Todo `403` y todo acceso a historial se registran en auditoría.

---

## Inicio de sesión
*Formulario de correo y contraseña. Estados: normal, credenciales inválidas, cuenta bloqueada.*

| Método | Endpoint | Descripción | Prioridad |
|---|---|---|---|
| POST | `/auth/login` | Valida credenciales, devuelve token y rol. Error genérico "Usuario o contraseña incorrectos". Tras 5 fallos, 423 con minutos restantes. | **P0** |
| POST | `/auth/logout` | Cierra la sesión. | P1 |
| GET | `/auth/me` | Usuario actual, rol y permisos efectivos. | **P0** |
| POST | `/auth/registro` | Alta pública. Siempre crea rol Cliente. | P2 |

> **P0 porque** `/auth/me` devuelve los permisos leídos del archivo de configuración: es la táctica de *binding en tiempo de configuración* en funcionamiento.

---

## Cliente · Mis mascotas
*Grilla de tarjetas con las mascotas del cliente. Alta y baja lógica.*

| Método | Endpoint | Descripción | Prioridad |
|---|---|---|---|
| GET | `/mascotas` | Mascotas del cliente autenticado. Filtro `?estado=ACTIVA`. | P1 |
| POST | `/mascotas` | Alta. Nombre y especie obligatorios. | P1 |
| GET | `/mascotas/{id}` | Ficha. 404 si no es del cliente. | P1 |
| PATCH | `/mascotas/{id}` | Edita datos. | P2 |
| POST | `/mascotas/{id}/baja` | Baja lógica. No admite nuevos turnos. | P2 |
| POST | `/mascotas/{id}/peso` | Registra peso con su fecha. | P3 |
| GET | `/mascotas/{id}/peso` | Histórico de pesos. | P3 |

---

## Cliente · Reservar turno
*Flujo de 4 pasos: elegir mascota → tipo de atención → veterinario → horario. La grilla de horarios es irregular porque depende de la duración del tipo elegido.*

| Método | Endpoint | Descripción | Prioridad |
|---|---|---|---|
| GET | `/tipos-atencion` | Solo los `reservable_cliente=true` si el rol es Cliente. Devuelve duración. | **P0** |
| GET | `/veterinarios` | Activos, para el paso 3. | P1 |
| GET | `/disponibilidad` | **La operación más cara.** Params: `veterinario`, `fecha`, `tipo_atencion`. Devuelve solo huecos ≥ duración del tipo, en múltiplos de 15 min. | **P0** |
| POST | `/turnos` | Confirma la reserva. Estado `CONFIRMADO`, `canal_origen=AUTOGESTION`. | **P0** |

**Respuesta de `/disponibilidad`:**
```json
{
  "fecha": "2026-09-01",
  "duracion_requerida": 30,
  "slots": [
    { "inicio": "08:00", "disponible": true },
    { "inicio": "08:15", "disponible": false, "motivo": "no entra la duración" }
  ]
}
```
El campo `motivo` es lo que permite a la UI explicar por qué la grilla es irregular.

> **P0 porque** `/disponibilidad` sostiene REND-01 (2 s normal, 4 s con 80 concurrentes) y `POST /turnos` es donde actúa la restricción de no superposición.

---

## Cliente · Estado crítico: el horario fue tomado al confirmar
*Pantalla de rechazo cuando otro cliente reservó ese horario mientras el usuario completaba la selección.*

No es un endpoint nuevo: es la **respuesta de error** de `POST /turnos`.

```json
HTTP 409
{
  "error": "HORARIO_NO_DISPONIBLE",
  "mensaje": "Ese horario fue reservado mientras completabas la selección.",
  "disponibilidad_actualizada": { "slots": [...] },
  "seleccion_conservada": {
    "id_mascota": 3, "id_tipo_atencion": 1, "id_veterinario": 2
  }
}
```

| Requisito | Prioridad |
|---|---|
| Capturar `exclusion_violation` (23P01) y devolver este 409 | **P0** |

> **P0 porque** es la evidencia visible de ASR-PROTECCIÓN-03. Sin `seleccion_conservada` el cliente pierde lo elegido, que es justo lo que HU-03 criterio 6 prohíbe.

---

## Cliente · Mis turnos
*Lista de turnos con su estado. Cancelar y reprogramar disponibles hasta 1 hora antes.*

| Método | Endpoint | Descripción | Prioridad |
|---|---|---|---|
| GET | `/turnos` | Turnos del cliente. Filtros `?estado=`, `?desde=`. Incluye `puede_cancelar` calculado en servidor. | P1 |
| GET | `/turnos/{id}` | Detalle. | P1 |
| POST | `/turnos/{id}/cancelar` | Valida el plazo de 1 h **al ejecutar**, no al mostrar. 409 si venció. | **P0** |
| POST | `/turnos/{id}/reprogramar` | **Operación atómica.** Body: nueva fecha/hora y veterinario. O queda el nuevo, o se conserva el original. | **P0** |

> **P0 porque** la reprogramación es el escenario de demo del *rollback*: si la toma del horario nuevo falla, el original tiene que seguir intacto. Y la cancelación demuestra que la validación de plazo vive en el servidor.

---

## Cliente · Historial clínico de mi mascota
*Timeline de consultas, solo lectura.*

| Método | Endpoint | Descripción | Prioridad |
|---|---|---|---|
| GET | `/mascotas/{id}/historial` | Solo lectura. 404 si no es del cliente. Consultas corregidas siempre junto a su corrección. | **P0** |

---

## Veterinario · Agenda diaria
*Línea de tiempo de 8:00 a 18:00, con bloques de altura proporcional a la duración de cada turno.*

| Método | Endpoint | Descripción | Prioridad |
|---|---|---|---|
| GET | `/agenda` | Turnos del veterinario autenticado. Param `?fecha=`. Incluye duración para dibujar bloques proporcionales. | P1 |

---

## Veterinario · Pacientes
*Buscador de mascotas de la clínica. Es la puerta de entrada a cualquier historial.*

| Método | Endpoint | Descripción | Prioridad |
|---|---|---|---|
| GET | `/pacientes` | Todas las mascotas de la clínica. Búsqueda `?q=`. **El acceso amplio es deliberado; se audita, no se restringe.** | P2 |

---

## Veterinario · Historial clínico completo
*Timeline con correcciones vinculadas a su consulta original y banner de advertencia si el historial no se recuperó completo.*

| Método | Endpoint | Descripción | Prioridad |
|---|---|---|---|
| GET | `/mascotas/{id}/historial` | Mismo endpoint, respuesta según rol. Registra el acceso en auditoría. | **P0** |

**Respuesta con verificación de consistencia:**
```json
{
  "consistente": false,
  "advertencias": [
    "La consulta del 12/03 figura como corregida pero su corrección no se recuperó."
  ],
  "consultas": [
    {
      "id": 41, "fecha": "2026-03-12", "veterinario": "Dr. Pérez",
      "motivo": "...", "diagnostico": "...",
      "modificada_el": "2026-03-12T15:00:00Z",
      "correcciones": [ { "id": 55, "fecha": "...", "texto": "..." } ]
    }
  ]
}
```

**Verificaciones antes de responder** (el *control de cordura*):

1. la cantidad recuperada coincide con la registrada;
2. toda consulta corregida trae su corrección;
3. toda corrección apunta a una consulta original existente;
4. el motivo está presente y no vacío;
5. ninguna fecha es futura.

Si alguna falla → `consistente: false` + `advertencias`. **Nunca se presenta como completo.**

| Endpoint auxiliar | Descripción | Prioridad |
|---|---|---|
| `POST /debug/corromper-historial/{id}` | Solo en modo demo. Rompe una regla a propósito para disparar el control de cordura. | **P0** |

> **P0 porque** este endpoint **es** la demo de la táctica de detección de estados desprotegidos.

---

## Veterinario · Registrar consulta
*Formulario de atención. Autor y fecha los asigna el sistema. Indicador de la ventana de 24 h para editar.*

| Método | Endpoint | Descripción | Prioridad |
|---|---|---|---|
| POST | `/turnos/{id}/consulta` | **Transacción:** escribe la consulta y pasa el turno a `ATENDIDO`. Autor y fecha los pone el servidor. | **P0** |
| PATCH | `/consultas/{id}` | Solo el autor, dentro de 24 h. Valida al confirmar. 409 si venció. Marca `modificada_el` y notifica. | **P0** |
| POST | `/consultas/{id}/correccion` | Cualquier veterinario, sin límite de tiempo. Entrada nueva vinculada. Notifica. | P1 |
| POST | `/debug/fallar-registro/{id}` | Solo en modo demo. Falla a mitad de la transacción. | **P0** |

> **P0 porque** `POST /turnos/{id}/consulta` es la demo del *rollback*, `PATCH` dispara la notificación por polimorfismo, y el endpoint de debug provoca el fallo.

---

## Administrador · Agenda de la clínica
*Las 3 agendas de veterinario en paralelo. Permite crear un turno en nombre de un cliente que llamó por teléfono.*

| Método | Endpoint | Descripción | Prioridad |
|---|---|---|---|
| GET | `/admin/agenda` | Las 3 agendas en paralelo. Param `?fecha=`. **Sin contenido clínico.** | P2 |
| POST | `/admin/turnos` | Crea turno en nombre de un cliente. Puede usar tipos no reservables. `canal_origen=TELEFONO`. | P2 |
| POST | `/admin/turnos/{id}/cancelar` | Sin restricción horaria. | P2 |
| POST | `/admin/turnos/{id}/reprogramar` | Sin restricción horaria. Atómico. | P2 |

---

## Administrador · Clientes y fichas de mascota
*Listado de clientes y ficha de cada mascota. El contenido clínico no existe para este rol: en su lugar aparece un estado vacío explícito.*

| Método | Endpoint | Descripción | Prioridad |
|---|---|---|---|
| GET | `/admin/clientes` | Listado con búsqueda. | P2 |
| GET | `/admin/clientes/{id}` | Ficha con sus mascotas. | P2 |
| GET | `/admin/mascotas/{id}` | Datos de la mascota y **metadatos** de turnos. | P2 |

**Respuesta con el estado vacío explícito:**
```json
{
  "nombre": "Firulais",
  "turnos": [ { "fecha": "...", "tipo": "...", "estado": "ATENDIDO" } ],
  "historial_clinico": {
    "acceso": false,
    "mensaje": "El contenido clínico no está disponible para el rol de administración."
  }
}
```

> El contenido clínico **no se filtra en el frontend**: el servidor no lo envía. Es ASR-SEGURIDAD-02.

---

## Administrador · Tipos de turno
*Tabla con nombre, duración y el interruptor "reservable por el cliente".*

| Método | Endpoint | Descripción | Prioridad |
|---|---|---|---|
| GET | `/admin/tipos-atencion` | Todos, incluidos los no reservables. | P2 |
| POST | `/admin/tipos-atencion` | Alta. Duración múltiplo de 15. | P2 |
| PATCH | `/admin/tipos-atencion/{id}` | Cambia duración o el flag. **No afecta turnos ya reservados.** | P2 |
| POST | `/admin/tipos-atencion/{id}/baja` | Baja lógica. | P3 |

---

## Administrador · Usuarios y veterinarios
*Tabla con filtros por rol y estado. Al deshabilitar a alguien con turnos agendados aparece un diálogo de advertencia que los lista.*

| Método | Endpoint | Descripción | Prioridad |
|---|---|---|---|
| GET | `/admin/usuarios` | Filtros por rol y estado. | P2 |
| POST | `/admin/veterinarios` | Alta con matrícula. | P2 |
| PATCH | `/admin/usuarios/{id}` | Edita datos de contacto. | P3 |
| GET | `/admin/usuarios/{id}/impacto-baja` | **Turnos afectados antes de deshabilitar.** Alimenta el diálogo de advertencia. | P2 |
| POST | `/admin/usuarios/{id}/deshabilitar` | Requiere `confirmado=true` si hay impacto. Nada se cancela automáticamente. | P2 |
| GET | `/admin/disponibilidad/{id_vet}` | Franjas del veterinario. | P3 |
| PUT | `/admin/disponibilidad/{id_vet}` | Modifica franjas. Devuelve impacto si hay turnos fuera. | P3 |

---

## Administrador · Registro de accesos
*Tabla del log de auditoría con filtros por usuario, mascota y fecha. Sin contenido clínico.*

| Método | Endpoint | Descripción | Prioridad |
|---|---|---|---|
| GET | `/admin/auditoria/historial` | Filtros: `usuario`, `mascota`, `desde`, `hasta`. **Sin contenido clínico.** Incluye accesos rechazados. La propia consulta se registra. | P1 |
| GET | `/admin/auditoria/sistema` | Login, altas, bajas, cambios de estado. | P3 |

---

## Endpoints transversales

| Método | Endpoint | Descripción | Prioridad |
|---|---|---|---|
| GET | `/health` | Estado del servicio. | P1 |
| GET | `/health/reservas` | Salud de las funcionalidades de reserva. | P2 |
| GET | `/health/clinico` | Salud de las funcionalidades clínicas. | P2 |
| GET | `/admin/config/roles` | Roles y permisos leídos de la configuración. | **P0** |
| GET | `/admin/config/notificaciones` | Canal activo y canales disponibles. | **P0** |
| POST | `/admin/config/notificaciones/canal` | Cambia el canal activo en ejecución. | **P0** |
| GET | `/notificaciones` | Notificaciones del cliente. Demuestra el envío. | P1 |

> Los tres `/admin/config/*` son P0: son la demostración directa de las dos tácticas de *diferir el binding*.

---

## Orden de trabajo sugerido

**Bloque 1 — desbloquea la TFU2 (todos P0)**

1. `POST /auth/login` + `GET /auth/me` con permisos desde configuración
2. `GET /admin/config/roles` — demuestra binding en configuración
3. `GET /disponibilidad` + `POST /turnos` — con la restricción de superposición
4. `POST /turnos/{id}/consulta` — transacción, demuestra rollback
5. `GET /mascotas/{id}/historial` — con las 5 verificaciones de cordura
6. Los dos `/debug/*` — provocan los fallos de la demo
7. `/admin/config/notificaciones` + canales — demuestra polimorfismo

**Bloque 2 — la app camina (P1)**
Mascotas, turnos del cliente, agenda del veterinario, notificaciones, auditoría de historial.

**Bloque 3 — completa el alcance (P2)**
Todo el módulo de administración.

**Bloque 4 — si sobra tiempo (P3)**
Peso histórico, disponibilidad configurable, auditoría del sistema.

---

## Cuatro reglas que valen para toda la API

**1. Ninguna regla se valida en el frontend.** Plazo de 1 h, ventana de 24 h, permisos, disponibilidad: todo se verifica en el servidor **al ejecutar**, no al mostrar. La pantalla que vio el usuario puede estar vieja.

**2. El servidor no envía lo que el rol no puede ver.** El administrador no recibe contenido clínico ni siquiera oculto en el JSON.

**3. Toda lectura o escritura de historial genera un registro de auditoría**, incluidos los accesos rechazados.

**4. Los endpoints `/debug/*` solo existen si `MODO_DEMO=true`** en la configuración. En cualquier otro ambiente devuelven 404.
