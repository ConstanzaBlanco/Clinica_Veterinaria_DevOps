from sqlalchemy import text
from sqlalchemy.orm import Session


class PacienteRepository:
    """Acceso a datos para el buscador de pacientes del veterinario."""

    def __init__(self, session: Session) -> None:
        self.session: Session = session

    def buscar(
        self,
        id_veterinario: int,
        q: str | None,
        alcance: str,
        especie: str | None,
    ) -> list:
        """
        Busca mascotas filtrando por nombre (`q`), especie y `alcance`
        ('mios' restringe a mascotas con algún turno del veterinario autenticado,
        cualquier otro valor es 'toda la clínica'). Cada fila trae, vía subconsultas,
        la cantidad de consultas, la última atención y el turno de hoy si existe —
        todo metadatos, sin contenido clínico.
        """
        condiciones = []
        parametros = {"id_veterinario": id_veterinario}

        if q:
            condiciones.append("m.nombre ILIKE :q")
            parametros["q"] = f"%{q}%"

        if especie:
            condiciones.append("m.especie = :especie")
            parametros["especie"] = especie

        if alcance == "mios":
            condiciones.append(
                "EXISTS ("
                "  SELECT 1 FROM turno t2"
                "  WHERE t2.id_mascota = m.id_mascota"
                "    AND t2.id_veterinario = :id_veterinario"
                ")"
            )

        where_extra = ("AND " + " AND ".join(condiciones)) if condiciones else ""

        consulta = text(
            f"""
            SELECT
                m.id_mascota AS id, m.nombre, m.especie, m.raza, m.estado,
                date_part('year', age(m.fecha_nacimiento))::int AS edad_anios,
                u.nombre || ' ' || u.apellido AS propietario_nombre,
                u.telefono AS propietario_telefono,

                (SELECT COUNT(*) FROM consulta_clinica c
                 WHERE c.id_mascota = m.id_mascota
                   AND c.id_consulta_original IS NULL) AS consultas_registradas,

                (SELECT c2.fecha_registro::date
                 FROM consulta_clinica c2
                 WHERE c2.id_mascota = m.id_mascota
                   AND c2.id_consulta_original IS NULL
                 ORDER BY c2.fecha_registro DESC LIMIT 1) AS ultima_fecha,

                (SELECT uv.nombre || ' ' || uv.apellido
                 FROM consulta_clinica c2
                 JOIN usuario uv ON uv.id_usuario = c2.id_veterinario
                 WHERE c2.id_mascota = m.id_mascota
                   AND c2.id_consulta_original IS NULL
                 ORDER BY c2.fecha_registro DESC LIMIT 1) AS ultima_veterinario,

                (SELECT c2.id_veterinario = :id_veterinario
                 FROM consulta_clinica c2
                 WHERE c2.id_mascota = m.id_mascota
                   AND c2.id_consulta_original IS NULL
                 ORDER BY c2.fecha_registro DESC LIMIT 1) AS ultima_fue_propia,

                (SELECT to_char(t4.fecha_hora_inicio, 'HH24:MI')
                 FROM turno t4
                 WHERE t4.id_mascota = m.id_mascota
                   AND t4.fecha_hora_inicio::date = CURRENT_DATE
                   AND t4.estado IN ('CONFIRMADO', 'ATENDIDO')
                 ORDER BY t4.fecha_hora_inicio LIMIT 1) AS turno_hoy_hora,

                (SELECT
                    CASE
                        WHEN t4.estado = 'CONFIRMADO'
                             AND now() BETWEEN t4.fecha_hora_inicio AND t4.fecha_hora_fin
                            THEN 'EN_CURSO'
                        WHEN t4.estado = 'ATENDIDO' THEN 'ATENDIDO'
                        ELSE 'PENDIENTE'
                    END
                 FROM turno t4
                 WHERE t4.id_mascota = m.id_mascota
                   AND t4.fecha_hora_inicio::date = CURRENT_DATE
                   AND t4.estado IN ('CONFIRMADO', 'ATENDIDO')
                 ORDER BY t4.fecha_hora_inicio LIMIT 1) AS turno_hoy_estado_visual

            FROM mascota m
            JOIN usuario u ON u.id_usuario = m.id_cliente
            WHERE 1=1 {where_extra}
            ORDER BY m.nombre
            """
        )
        return self.session.execute(consulta, parametros).mappings().all()

    def registrar_auditoria(self, id_veterinario: int, filtros: dict) -> None:
        """Deja constancia en auditoria_sistema de cada búsqueda de pacientes, con commit propio."""
        consulta = text(
            """
            INSERT INTO auditoria_sistema (id_usuario_actor, accion, resultado, detalle)
            VALUES (:id_usuario_actor, 'BUSQUEDA_PACIENTES', 'EXITOSO', :detalle)
            """
        )
        self.session.execute(
            consulta,
            {
                "id_usuario_actor": id_veterinario,
                "detalle": f"Busqueda de pacientes: {filtros}",
            },
        )
        self.session.commit()