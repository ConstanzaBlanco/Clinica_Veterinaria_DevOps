from app.database import get_session

def obtener_veterinarios_activos():
    with get_session() as session:
        result = session.execute(
            "SELECT id, nombre, matricula, activo FROM usuarios "
            "WHERE rol = 'VETERINARIO' AND activo = true"
        )
        return result.fetchall()