from fastapi import APIRouter
from app.veterinarios.service import listar_veterinarios
from app.veterinarios.dto import VeterinarioResponse

router = APIRouter()

@router.get("/veterinarios", response_model=list[VeterinarioResponse])
def obtener_veterinarios():
    return listar_veterinarios()