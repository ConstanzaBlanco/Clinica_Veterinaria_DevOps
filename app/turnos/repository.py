from sqlalchemy.orm import Session


class TurnoRepository:
    def __init__(self, session: Session) -> None:
        self.session: Session = session

    def listar_por_cliente(self, id_cliente: int, periodo: str) -> list:
        condicion_periodo = {
            "proximos": "AND t.fecha_hora_inicio >= now()",
            "pasados": "AND t.fecha_hora_inicio < now()",
            "todos": "",
        }[periodo]

        resultado = self.session.execute(
            f"""
            SELECT
                t.id_turno, t.fecha_hora_inicio, t.duracion_minutos,
                t.estado, t.canal_origen,
                ta.nombre AS tipo,
                m.id_mascota, m.nombre AS mascota_nombre,
                m.especie, m.estado AS mascota_estado,
                u.nombre || ' ' || u.apellido AS veterinario
            FROM turno t
            JOIN mascota m ON m.id_mascota = t.id_mascota
            JOIN tipo_atencion ta ON ta.id_tipo_atencion = t.id_tipo_atencion
            JOIN usuario u ON u.id_usuario = t.id_veterinario
            WHERE m.id_cliente = :id_cliente
            {condicion_periodo}
            ORDER BY t.fecha_hora_inicio DESC
            """,
            {"id_cliente": id_cliente},
        )
        return resultado.fetchall()

    def obtener_por_id(self, id_turno: int, id_cliente: int):
        resultado = self.session.execute(
            """
            SELECT
                t.id_turno, t.fecha_hora_inicio, t.duracion_minutos,
                t.estado, t.canal_origen,
                ta.nombre AS tipo,
                m.id_mascota, m.nombre AS mascota_nombre,
                m.especie, m.estado AS mascota_estado,
                u.nombre || ' ' || u.apellido AS veterinario
            FROM turno t
            JOIN mascota m ON m.id_mascota = t.id_mascota
            JOIN tipo_atencion ta ON ta.id_tipo_atencion = t.id_tipo_atencion
            JOIN usuario u ON u.id_usuario = t.id_veterinario
            WHERE t.id_turno = :id_turno AND m.id_cliente = :id_cliente
            """,
            {"id_turno": id_turno, "id_cliente": id_cliente},
        )
        return resultado.fetchone()

    def cancelar(self, id_turno: int, id_cliente: int):
        resultado = self.session.execute(
            """
            UPDATE turno t SET estado = 'CANCELADO'
            FROM mascota m
            WHERE t.id_mascota = m.id_mascota
              AND t.id_turno = :id_turno
              AND m.id_cliente = :id_cliente
              AND t.estado = 'CONFIRMADO'
              AND t.fecha_hora_inicio > now() + interval '1 hour'
            RETURNING t.id_turno
            """,
            {"id_turno": id_turno, "id_cliente": id_cliente},
        )
        self.session.commit()
        return resultado.fetchone()