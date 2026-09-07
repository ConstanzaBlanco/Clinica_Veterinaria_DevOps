from pydantic import BaseModel

class VeterinarioResponse(BaseModel):
    """Veterinario activo, para los selectores del cliente al reservar un turno."""

    id_usuario: int
    nombre: str
    apellido: str
    matricula_profesional: str