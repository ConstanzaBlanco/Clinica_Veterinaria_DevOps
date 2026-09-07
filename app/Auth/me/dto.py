from pydantic import BaseModel, ConfigDict


class MeResponse(BaseModel):
    """Datos públicos del usuario autenticado devueltos por GET /auth/me."""

    model_config = ConfigDict(
        from_attributes=True
    )

    id_usuario: int
    nombre: str
    apellido: str
    correo: str
    rol: str