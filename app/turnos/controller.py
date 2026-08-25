from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_session
from app.Middleware.middleware import requerir_rol
from app.turnos.dto import TurnoResponse
from app.turnos.repository import TurnoRepository
from app.turnos.service import TurnoService

router = APIRouter(prefix="/turnos", tags=["Turnos"])


def crear_service(session: Session) -> TurnoService:
    repository: TurnoRepository = TurnoRepository(session)
    return TurnoService(repository)


@router.get("", response_model=list[TurnoResponse])
def listar_turnos(
    periodo: Literal["proximos", "pasados", "todos"] = "proximos",
    usuario: dict[str, Any] = Depends(requerir_rol("CLIENTE")),
    session: Session = Depends(get_session),
) -> list[dict]:
    id_cliente: int = usuario["id_usuario"]
    return crear_service(session).listar_por_cliente(id_cliente, periodo)


@router.get("/{id_turno}", response_model=TurnoResponse)
def ver_turno(
    id_turno: int,
    usuario: dict[str, Any] = Depends(requerir_rol("CLIENTE")),
    session: Session = Depends(get_session),
) -> dict:
    id_cliente: int = usuario["id_usuario"]
    try:
        return crear_service(session).obtener_por_id(id_turno, id_cliente)
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.post("/{id_turno}/cancelar", status_code=status.HTTP_204_NO_CONTENT)
def cancelar_turno(
    id_turno: int,
    usuario: dict[str, Any] = Depends(requerir_rol("CLIENTE")),
    session: Session = Depends(get_session),
) -> None:
    id_cliente: int = usuario["id_usuario"]
    try:
        crear_service(session).cancelar(id_turno, id_cliente)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error