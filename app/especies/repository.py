from sqlalchemy import text


class EspecieRepository:
    """Acceso a datos del catálogo de especies."""

    def __init__(self, session):
        self.session = session

    def listar_activas(self):
        """Especies con estado ACTIVO, ordenadas por nombre."""
        consulta = text(
            """
            SELECT id_especie, nombre, estado
            FROM especie
            WHERE estado = 'ACTIVO'
            ORDER BY nombre
            """
        )
        filas = self.session.execute(consulta).mappings().all()

        especies = []

        for fila in filas:
            especies.append(dict(fila))

        return especies
