from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)

from app.database import get_session
from app.Auth.Register.clients.dto import (
    RegisterRequest,
    RegisterResponse,
)
from app.Auth.Register.clients.repository import (
    RegisterRepository,
)
from app.Auth.Register.clients.service import (
    RegisterService,
    RegistroDuplicadoError,
    RegistroInvalidoError,
)


router = APIRouter(
    prefix="/auth/register"
)


def crear_service(session):
    """Arma el RegisterService con su repository para esta request."""
    repository = RegisterRepository(session)

    return RegisterService(repository)


@router.post(
    "",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
)
def registrar_cliente(
    datos: RegisterRequest,
    session=Depends(get_session),
):
    """Ruta pública de autorregistro: crea un usuario con rol CLIENTE.
    Solo sirve para el alta de clientes; veterinarios y administradores
    se crean por otra vía (no expuesta acá)."""
    service = crear_service(session)

    try:
        return service.registrar_cliente(datos)

    except RegistroInvalidoError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error

    except RegistroDuplicadoError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error