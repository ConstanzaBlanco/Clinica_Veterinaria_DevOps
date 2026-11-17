from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.database import get_session
from app.Middleware.middleware import requerir_rol
from app.veterinarios.repository import VeterinarioRepository
from app.veterinarios.service import VeterinarioService
from app.veterinarios.dto import VeterinarioResponse

router = APIRouter(
    prefix="/veterinarios",
    tags=["Veterinarios"],
)

def crear_service(session: Session) -> VeterinarioService:
    """
    Crea el servicio necesario para gestionar los veterinarios.
        session: Sesion de SQLAlchemy proporcionada por FastAPI.

    Return:
        Servicio de veterinarios configurado.
    """
    repository:VeterinarioRepository = VeterinarioRepository(session)

    return VeterinarioService(repository)

@router.get("", response_model=list[VeterinarioResponse])
def obtener_veterinarios(
    session: Session = Depends(get_session),
    _usuario: dict = Depends(requerir_rol("CLIENTE", "ADMINISTRADOR")),
):
    """Lista los veterinarios activos: el cliente los usa para reservar un
    turno, y el administrador para elegir a quién editarle el horario."""
    return crear_service(session).listar_veterinarios()