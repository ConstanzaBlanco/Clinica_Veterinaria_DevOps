from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_session
from app.Middleware.middleware import requerir_rol
from app.disponibilidad.dto import (
    DisponibilidadResponse,
    FranjaCreate,
    FranjaResponse,
    FranjaUpdate,
)
from app.disponibilidad.repository import DisponibilidadRepository
from app.disponibilidad.service import DisponibilidadService

router = APIRouter(prefix="/disponibilidad", tags=["Disponibilidad"])


def crear_service(session: Session) -> DisponibilidadService:
    """Arma el servicio de disponibilidad con su repositorio."""
    repository: DisponibilidadRepository = DisponibilidadRepository(session)
    return DisponibilidadService(repository)


@router.get("", response_model=DisponibilidadResponse, response_model_exclude_none=True)
def obtener_disponibilidad(
    veterinario: int = Query(...),
    fecha: date = Query(...),
    tipo_atencion: int = Query(...),
    _usuario: dict[str, Any] = Depends(requerir_rol("CLIENTE", "ADMINISTRADOR")),
    session: Session = Depends(get_session),
) -> dict:
    """
    Grilla de horarios de un veterinario para una fecha y un tipo de atención.

    Usada en el paso 4 de "Reservar turno" (cliente) y en el panel de
    turnos por teléfono (administrador). `response_model_exclude_none`
    hace que el campo `motivo` no aparezca en los slots disponibles.
    """
    try:
        return crear_service(session).calcular(veterinario, fecha, tipo_atencion)
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.get(
    "/veterinarios/{id_veterinario}/franjas",
    response_model=list[FranjaResponse],
)
def listar_franjas(
    id_veterinario: int,
    _usuario: dict[str, Any] = Depends(requerir_rol("ADMINISTRADOR")),
    session: Session = Depends(get_session),
) -> list[dict]:
    """Franjas recurrentes (crudas) de un veterinario, para que el admin las edite."""
    try:
        return crear_service(session).listar_franjas(id_veterinario)
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.post(
    "/veterinarios/{id_veterinario}/franjas",
    response_model=FranjaResponse,
    status_code=status.HTTP_201_CREATED,
)
def crear_franja(
    id_veterinario: int,
    datos: FranjaCreate,
    _usuario: dict[str, Any] = Depends(requerir_rol("ADMINISTRADOR")),
    session: Session = Depends(get_session),
) -> dict:
    """Crea una franja de disponibilidad recurrente para el veterinario."""
    try:
        return crear_service(session).crear_franja(id_veterinario, datos)
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


@router.put(
    "/veterinarios/{id_veterinario}/franjas/{id_disponibilidad}",
    response_model=FranjaResponse,
)
def editar_franja(
    id_veterinario: int,
    id_disponibilidad: int,
    datos: FranjaUpdate,
    _usuario: dict[str, Any] = Depends(requerir_rol("ADMINISTRADOR")),
    session: Session = Depends(get_session),
) -> dict:
    """Edita el horario (hora_inicio/hora_fin) de una franja existente del veterinario."""
    try:
        return crear_service(session).actualizar_franja(id_veterinario, id_disponibilidad, datos)
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
