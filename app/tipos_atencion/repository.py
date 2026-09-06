from sqlalchemy import text


class TipoAtencionRepository:
    """Acceso a datos del catálogo de tipos de atención."""

    def __init__(self, session):
        self.session = session

    def listar(self):
        """Todos los tipos de atención, activos e inactivos, ordenados por nombre."""
        consulta = text(
            """
            SELECT
                id_tipo_atencion,
                nombre,
                descripcion,
                duracion_minutos,
                reservable_cliente,
                estado
            FROM tipo_atencion
            ORDER BY nombre
            """
        )
        filas = self.session.execute(consulta).mappings().all()

        tipos_atencion = []

        for fila in filas:
            tipos_atencion.append(dict(fila))

        return tipos_atencion

    def buscar_por_nombre(self, nombre: str):
        """Chequeo previo de duplicado por nombre antes de crear un tipo de atención."""
        consulta = text(
            """
            SELECT
                id_tipo_atencion,
                nombre,
                descripcion,
                duracion_minutos,
                reservable_cliente,
                estado
            FROM tipo_atencion
            WHERE nombre = :nombre
            """
        )
        fila = self.session.execute(
            consulta,
            {"nombre": nombre},
        ).mappings().first()

        if fila is None:
            return None

        return dict(fila)

    def crear(
        self,
        nombre: str,
        descripcion: str | None,
        duracion_minutos: int,
        reservable_cliente: bool,
    ):
        """Inserta el tipo de atención nuevo (queda ACTIVO por default del esquema)."""
        consulta = text(
            """
            INSERT INTO tipo_atencion (
                nombre,
                descripcion,
                duracion_minutos,
                reservable_cliente
            )
            VALUES (
                :nombre,
                :descripcion,
                :duracion_minutos,
                :reservable_cliente
            )
            RETURNING
                id_tipo_atencion,
                nombre,
                descripcion,
                duracion_minutos,
                reservable_cliente,
                estado
            """
        )

        valores = {
            "nombre": nombre,
            "descripcion": descripcion,
            "duracion_minutos": duracion_minutos,
            "reservable_cliente": reservable_cliente,
        }

        fila = self.session.execute(
            consulta,
            valores,
        ).mappings().one()

        self.session.commit()

        return dict(fila)
