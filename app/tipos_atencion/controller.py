from fastapi import APIRouter, Depends, HTTPException, status

from app.database import get_session
from app.Middleware.middleware import requerir_rol
from app.tipos_atencion.dto import (
    TipoAtencionCreate,
    TipoAtencionResponse,
)
from app.tipos_atencion.repository import TipoAtencionRepository
from app.tipos_atencion.service import TipoAtencionService


router = APIRouter(
    prefix="/tipos-atencion",
    tags=["Tipos de atención"],
)


def crear_service(session):
    """Arma el TipoAtencionService con su repository para esta request."""
    repository = TipoAtencionRepository(session)

    return TipoAtencionService(repository)


@router.get("", response_model=list[TipoAtencionResponse])
def listar_tipos_atencion(
    session=Depends(get_session),
    _usuario: dict = Depends(requerir_rol("CLIENTE", "VETERINARIO")),
):
    """Lista todos los tipos de atención (activos e inactivos), para los
    selectores de reserva de turno y agenda."""
    service = crear_service(session)

    return service.listar()


@router.post(
    "",
    response_model=TipoAtencionResponse,
    status_code=status.HTTP_201_CREATED,
)
def crear_tipo_atencion(
    datos: TipoAtencionCreate,
    session=Depends(get_session),
):
    """Crea un tipo de atención nuevo. Nota: a diferencia del resto de los
    endpoints de escritura del proyecto, esta ruta no lleva `requerir_rol`."""
    service = crear_service(session)

    try:
        return service.crear(datos)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error
