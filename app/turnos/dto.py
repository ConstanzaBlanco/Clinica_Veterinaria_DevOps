from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class TurnoCreate(BaseModel):
    """
    Representa los datos necesarios para registrar una mascota.
    """
    fecha_hora_inicio: date = Field(
        ...,
        description="Fecha y hora de inicio del turno en formato ISO 8601.",
    )
    fecha_hora_fin: date = Field(
        ...,
        description="Fecha y hora de fin del turno en formato ISO 8601.",
    )
    duracion_minutos: int = Field(
        ...,
        description="Duracion del turno en minutos.",
    )
    estado: str = Field(
        ...,
        description="Estado del turno.",
    )
    canal_origen: str = Field(
        ...,
        description="Canal de origen del turno.",
    )
    


class TurnoResponse(BaseModel):
    """
    Representa los datos de un turno enviados al frontend.
    """

    model_config = ConfigDict(from_attributes=True)

    