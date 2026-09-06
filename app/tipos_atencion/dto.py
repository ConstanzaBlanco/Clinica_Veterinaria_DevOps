from pydantic import BaseModel, ConfigDict, Field

class TipoAtencionCreate(BaseModel):
    """Datos necesarios para crear un tipo de atención."""

    nombre: str = Field(min_length=1, max_length=100)
    descripcion: str | None = None
    duracion_minutos: int = Field(gt=0, multiple_of=15)
    reservable_cliente: bool = True


class TipoAtencionResponse(BaseModel):
    """Tipo de atención devuelto al frontend."""

    model_config = ConfigDict(from_attributes=True)

    id_tipo_atencion: int
    nombre: str
    descripcion: str | None
    duracion_minutos: int
    reservable_cliente: bool
    estado: str