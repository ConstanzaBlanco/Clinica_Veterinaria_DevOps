from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    SecretStr,
)


class LoginRequest(BaseModel):
    """Credenciales enviadas por el cliente al iniciar sesión."""

    correo: EmailStr
    contrasena: SecretStr = Field(
        min_length=1,
        max_length=128,
    )


class UsuarioLoginResponse(BaseModel):
    """Datos públicos del usuario autenticado, incluidos en la respuesta del login."""

    model_config = ConfigDict(from_attributes=True)

    id_usuario: int
    nombre: str
    apellido: str
    correo: EmailStr
    rol: str


class LoginResponse(BaseModel):
    """Token de acceso emitido tras un login exitoso, junto con los datos del usuario."""

    access_token: str
    token_type: str
    expires_in: int
    usuario: UsuarioLoginResponse