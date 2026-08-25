from app.database import get_session

def obtener_veterinarios_activos():
    with get_session() as session:
        result = session.execute(
            """
            SELECT u.id_usuario, u.nombre, u.apellido, v.matricula_profesional
            FROM veterinario v
            JOIN usuario u ON u.id_usuario = v.id_usuario
            WHERE u.estado = 'ACTIVO'
            """
        )
        return result.fetchall()