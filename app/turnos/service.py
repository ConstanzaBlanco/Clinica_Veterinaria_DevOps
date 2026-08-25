from app.turnos.repository import TurnoRepository


class TurnoService:
    def __init__(self, repository: TurnoRepository) -> None:
        self.repository: TurnoRepository = repository

    def _a_dict(self, fila) -> dict:
        from datetime import datetime, timezone

        puede_cancelar = (
            fila.estado == "CONFIRMADO"
            and fila.fecha_hora_inicio > datetime.now(timezone.utc)
        )

        return {
            "id_turno": fila.id_turno,
            "fecha_hora_inicio": fila.fecha_hora_inicio,
            "duracion_minutos": fila.duracion_minutos,
            "tipo": fila.tipo,
            "estado": fila.estado,
            "canal_origen": fila.canal_origen,
            "veterinario": fila.veterinario,
            "puede_cancelar": puede_cancelar,
            "mascota": {
                "id_mascota": fila.id_mascota,
                "nombre": fila.mascota_nombre,
                "especie": fila.especie,
                "estado": fila.mascota_estado,
            },
        }

    def listar_por_cliente(self, id_cliente: int, periodo: str) -> list[dict]:
        filas = self.repository.listar_por_cliente(id_cliente, periodo)
        return [self._a_dict(f) for f in filas]

    def obtener_por_id(self, id_turno: int, id_cliente: int) -> dict:
        fila = self.repository.obtener_por_id(id_turno, id_cliente)
        if not fila:
            raise LookupError("Turno no encontrado.")
        return self._a_dict(fila)

    def cancelar(self, id_turno: int, id_cliente: int) -> None:
        resultado = self.repository.cancelar(id_turno, id_cliente)
        if not resultado:
            raise ValueError(
                "No se pudo cancelar: el turno no existe, ya fue "
                "cancelado, o falta menos de 1 hora para su inicio."
            )