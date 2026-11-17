from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, Field


class FranjaCreate(BaseModel):
    """Datos para crear una franja de disponibilidad recurrente."""

    dia_semana: int = Field(ge=1, le=7)
    hora_inicio: time
    hora_fin: time


class FranjaUpdate(BaseModel):
    """Datos para editar el horario de una franja existente (no cambia el día)."""

    hora_inicio: time
    hora_fin: time


class FranjaResponse(BaseModel):
    """Franja de disponibilidad recurrente cruda (fila de la tabla, no el grid calculado)."""

    model_config = ConfigDict(from_attributes=True)

    id_disponibilidad: int
    id_veterinario: int
    dia_semana: int
    hora_inicio: time
    hora_fin: time
    estado: str


class SlotDisponibilidad(BaseModel):
    """Un horario de 15 min: si está libre, y si no, por qué (motivo)."""

    inicio: str
    disponible: bool
    motivo: str | None = None


class DisponibilidadResponse(BaseModel):
    """Respuesta de GET /disponibilidad: grilla completa de un día para un veterinario."""

    fecha: date
    duracion_requerida: int
    calculado_el: datetime
    slots: list[SlotDisponibilidad]
