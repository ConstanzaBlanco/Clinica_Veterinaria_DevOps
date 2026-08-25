from pydantic import BaseModel

class VeterinarioResponse(BaseModel):
    id: int
    nombre: str
    matricula: str
    activo: bool