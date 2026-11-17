from datetime import date, time

from sqlalchemy import text
from sqlalchemy.orm import Session


class DisponibilidadRepository:
    """Acceso a datos para calcular la grilla de horarios de un veterinario."""

    def __init__(self, session: Session) -> None:
        self.session: Session = session

    def obtener_tipo_atencion(self, id_tipo_atencion: int):
        """Trae la duración (en minutos) del tipo de atención, si está activo."""
        consulta = text(
            """
            SELECT id_tipo_atencion, duracion_minutos
            FROM tipo_atencion
            WHERE id_tipo_atencion = :id_tipo_atencion
              AND estado = 'ACTIVO'
            """
        )
        return self.session.execute(
            consulta, {"id_tipo_atencion": id_tipo_atencion}
        ).mappings().first()

    def obtener_bloques(self, id_veterinario: int, dia_semana: int):
        """Franjas recurrentes activas del veterinario para ese día de la semana."""
        consulta = text(
            """
            SELECT hora_inicio, hora_fin
            FROM disponibilidad
            WHERE id_veterinario = :id_veterinario
              AND dia_semana = :dia_semana
              AND estado = 'ACTIVA'
            ORDER BY hora_inicio
            """
        )
        return self.session.execute(
            consulta,
            {"id_veterinario": id_veterinario, "dia_semana": dia_semana},
        ).mappings().all()

    def obtener_excepciones(self, id_veterinario: int, fecha: date):
        """Ausencias puntuales del veterinario en esa fecha (día completo o franja parcial)."""
        consulta = text(
            """
            SELECT hora_inicio, hora_fin
            FROM excepcion_disponibilidad
            WHERE id_veterinario = :id_veterinario
              AND fecha = :fecha
            """
        )
        return self.session.execute(
            consulta, {"id_veterinario": id_veterinario, "fecha": fecha}
        ).mappings().all()

    def obtener_turnos_ocupados(self, id_veterinario: int, fecha: date):
        """Turnos ya reservados (CONFIRMADO/ATENDIDO) del veterinario en esa fecha."""
        consulta = text(
            """
            SELECT fecha_hora_inicio, fecha_hora_fin
            FROM turno
            WHERE id_veterinario = :id_veterinario
              AND estado IN ('CONFIRMADO', 'ATENDIDO')
              AND fecha_hora_inicio::date = :fecha
            """
        )
        return self.session.execute(
            consulta, {"id_veterinario": id_veterinario, "fecha": fecha}
        ).mappings().all()

    def obtener_veterinario_activo(self, id_veterinario: int):
        """Verifica que el id corresponda a un veterinario con usuario ACTIVO."""
        consulta = text(
            """
            SELECT u.id_usuario
            FROM veterinario v
            JOIN usuario u ON u.id_usuario = v.id_usuario
            WHERE v.id_usuario = :id_veterinario
              AND u.estado = 'ACTIVO'
            """
        )
        return self.session.execute(
            consulta, {"id_veterinario": id_veterinario}
        ).mappings().first()

    def listar_franjas(self, id_veterinario: int):
        """Todas las franjas recurrentes del veterinario (activas e inactivas), crudas."""
        consulta = text(
            """
            SELECT id_disponibilidad, id_veterinario, dia_semana, hora_inicio, hora_fin, estado
            FROM disponibilidad
            WHERE id_veterinario = :id_veterinario
            ORDER BY dia_semana, hora_inicio
            """
        )
        return self.session.execute(
            consulta, {"id_veterinario": id_veterinario}
        ).mappings().all()

    def obtener_franja(self, id_disponibilidad: int):
        """Trae una franja puntual por id, para validar pertenencia antes de editarla."""
        consulta = text(
            """
            SELECT id_disponibilidad, id_veterinario, dia_semana, hora_inicio, hora_fin, estado
            FROM disponibilidad
            WHERE id_disponibilidad = :id_disponibilidad
            """
        )
        return self.session.execute(
            consulta, {"id_disponibilidad": id_disponibilidad}
        ).mappings().first()

    def obtener_franjas_del_dia(
        self, id_veterinario: int, dia_semana: int, excluir_id: int | None = None
    ):
        """Franjas activas del veterinario en ese día, para chequear solapamiento.
        `excluir_id` se usa al editar, para no comparar la franja contra sí misma."""
        # El CAST es necesario: sin tipo explícito, Postgres no puede inferir
        # el tipo del parámetro cuando excluir_id llega como NULL (pasa
        # siempre que se valida una franja nueva, no una edición). Se usa
        # CAST(...) en vez de "::bigint" porque SQLAlchemy no reconoce bien
        # un bind param seguido directamente de "::" dentro de un text().
        consulta = text(
            """
            SELECT id_disponibilidad, hora_inicio, hora_fin
            FROM disponibilidad
            WHERE id_veterinario = :id_veterinario
              AND dia_semana = :dia_semana
              AND estado = 'ACTIVA'
              AND (
                CAST(:excluir_id AS bigint) IS NULL
                OR id_disponibilidad != CAST(:excluir_id AS bigint)
              )
            """
        )
        return self.session.execute(
            consulta,
            {
                "id_veterinario": id_veterinario,
                "dia_semana": dia_semana,
                "excluir_id": excluir_id,
            },
        ).mappings().all()

    def crear_franja(
        self, id_veterinario: int, dia_semana: int, hora_inicio: time, hora_fin: time
    ):
        """Inserta una franja recurrente nueva (queda ACTIVA por default del esquema)."""
        consulta = text(
            """
            INSERT INTO disponibilidad (id_veterinario, dia_semana, hora_inicio, hora_fin)
            VALUES (:id_veterinario, :dia_semana, :hora_inicio, :hora_fin)
            RETURNING id_disponibilidad, id_veterinario, dia_semana, hora_inicio, hora_fin, estado
            """
        )
        fila = self.session.execute(
            consulta,
            {
                "id_veterinario": id_veterinario,
                "dia_semana": dia_semana,
                "hora_inicio": hora_inicio,
                "hora_fin": hora_fin,
            },
        ).mappings().one()

        self.session.commit()

        return dict(fila)

    def actualizar_horario_franja(
        self, id_disponibilidad: int, hora_inicio: time, hora_fin: time
    ):
        """Pisa el horario de una franja existente (no cambia el día de semana)."""
        consulta = text(
            """
            UPDATE disponibilidad
            SET hora_inicio = :hora_inicio, hora_fin = :hora_fin
            WHERE id_disponibilidad = :id_disponibilidad
            RETURNING id_disponibilidad, id_veterinario, dia_semana, hora_inicio, hora_fin, estado
            """
        )
        fila = self.session.execute(
            consulta,
            {
                "id_disponibilidad": id_disponibilidad,
                "hora_inicio": hora_inicio,
                "hora_fin": hora_fin,
            },
        ).mappings().one()

        self.session.commit()

        return dict(fila)
