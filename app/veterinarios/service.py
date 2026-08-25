from app.veterinarios.repository import obtener_veterinarios_activos

def listar_veterinarios():
    return obtener_veterinarios_activos()