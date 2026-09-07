from pydantic import BaseModel, ConfigDict


class EspecieResponse(BaseModel):
    """Especie disponible para asignarle a una mascota."""

    model_config = ConfigDict(from_attributes=True)

    id_especie: int
    nombre: str
    estado: str
