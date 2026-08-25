from sqlmodel import Session

from app.database import get_session

class VeterinarioRepository:
    """
    Administra las consultas de veterinarios en la base de datos.
    """

    def __init__(self, session: Session) -> None:
        """
        Inicializa el repositorio.
            session: Sesion de SQLAlchemy utilizada para acceder
                a PostgreSQL.
        """
        self.session: Session = session

    def obtener_veterinarios_activos(self):
        """
        Obtiene la lista de veterinarios activos.
        """
        return self.session.exec(
            """
            SELECT u.id_usuario, u.nombre, u.apellido, v.matricula_profesional
            FROM veterinario v
            JOIN usuario u ON u.id_usuario = v.id_usuario
            WHERE u.estado = 'ACTIVO'
            """
        )
