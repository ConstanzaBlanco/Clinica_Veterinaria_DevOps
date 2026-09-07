from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


# --- Respuesta para CLIENTE ---

class ConsultaClienteItem(BaseModel):
    """Una consulta clínica tal como la ve el cliente dueño de la mascota."""

    model_config = ConfigDict(from_attributes=True)

    id_consulta: int
    fecha: date
    hora: str
    tipo: str
    veterinario: str
    motivo: str
    diagnostico: str
    observaciones: str | None
    tratamiento: str | None
    recomendaciones: str | None
    modificada_el: datetime | None
    edicion_vencida: bool
    corregida: bool
    corregida_el: date | None


class HistorialClienteResponse(BaseModel):
    """Respuesta de GET /mascotas/{id}/historial para un CLIENTE, paginada."""

    total: int
    consultas: list[ConsultaClienteItem]


# --- Respuesta para VETERINARIO ---

class MascotaHistorialInfo(BaseModel):
    """Ficha resumida de la mascota mostrada junto al historial del veterinario."""

    id: int
    nombre: str
    especie: str
    raza: str | None
    fecha_nacimiento: date | None
    peso_actual: float | None
    propietario: str
    telefono: str


class CorreccionItem(BaseModel):
    """Una corrección posterior de una consulta original (fila con `id_consulta_original`)."""

    id: int
    fecha: date
    hora: str
    veterinario: str
    motivo_correccion: str
    # Campos clínicos que la corrección haya modificado (motivo, diagnostico,
    # observaciones, tratamiento o recomendaciones) — los incluyo todos por
    # simplicidad; el frontend muestra los que tengan valor.
    diagnostico: str | None = None
    observaciones: str | None = None
    tratamiento: str | None = None
    recomendaciones: str | None = None
    vigente: bool


class ConsultaRecuperada(BaseModel):
    """Consulta original que se pudo leer bien, con sus correcciones si las tiene."""

    id: int
    recuperada: bool = True
    fecha: date
    hora: str
    tipo: str
    veterinario: str
    motivo: str
    observaciones: str | None
    diagnostico: str
    tratamiento: str | None
    recomendaciones: str | None
    modificada_el: datetime | None
    edicion_vencida: bool
    corregida: bool
    corregida_el: date | None
    correcciones: list[CorreccionItem]


class ConsultaNoRecuperada(BaseModel):
    """Placeholder para una consulta que se esperaba pero no se pudo recuperar
    (ver `consistente`/`advertencias` en HistorialVeterinarioResponse)."""

    id: None = None
    recuperada: bool = False
    mensaje: str = (
        "Consulta no recuperada. Existe en el registro pero no se pudo "
        "leer su contenido."
    )


class HistorialVeterinarioResponse(BaseModel):
    """Respuesta de GET /mascotas/{id}/historial para un VETERINARIO. `consistente`
    es False si `recuperadas` < `esperadas` (alguna consulta no se pudo leer)."""

    mascota: MascotaHistorialInfo
    consistente: bool
    recuperadas: int
    esperadas: int
    ultimo_intento: datetime
    advertencias: list[str]
    consultas: list[ConsultaRecuperada | ConsultaNoRecuperada]