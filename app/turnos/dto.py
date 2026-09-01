from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict


class MascotaResumen(BaseModel):
    id_mascota: int
    nombre: str
    especie: str
    estado: str


class TurnoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_turno: int
    fecha_hora_inicio: datetime
    duracion_minutos: int
    tipo: str
    mascota: MascotaResumen
    veterinario: str
    estado: str
    puede_cancelar: bool
    canal_origen: str


class TurnoCreate(BaseModel):
    id_mascota: int
    id_tipo_atencion: int
    id_veterinario: int
    fecha: date
    hora_inicio: time