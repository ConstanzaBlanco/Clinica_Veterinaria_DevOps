from pydantic import BaseModel, ConfigDict


class PropietarioResumen(BaseModel):
    """Datos de contacto del dueño, embebidos en la ficha del paciente."""

    nombre: str
    telefono: str


class UltimaAtencion(BaseModel):
    """Resumen de la última consulta registrada (sin contenido clínico)."""

    fecha: str
    veterinario: str
    fue_propia: bool


class TurnoHoy(BaseModel):
    """Turno de hoy de esta mascota, si tiene uno confirmado o atendido."""

    hora: str
    estado_visual: str


class PacienteResponse(BaseModel):
    """Ficha resumida de una mascota en el buscador de pacientes del veterinario."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    especie: str
    raza: str | None
    edad: str | None
    estado: str
    propietario: PropietarioResumen
    consultas_registradas: int
    ultima_atencion: UltimaAtencion | None
    turno_hoy: TurnoHoy | None