from app.pacientes.repository import PacienteRepository


class PacienteService:
    """Reglas de negocio del buscador de pacientes del veterinario."""

    def __init__(self, repository: PacienteRepository) -> None:
        self.repository: PacienteRepository = repository

    def buscar(
        self,
        id_veterinario: int,
        q: str | None,
        alcance: str,
        especie: str | None,
    ) -> list[dict]:
        """Busca pacientes con los filtros dados y arma la ficha resumida de
        cada uno (última atención y turno de hoy, si existen)."""
        filas = self.repository.buscar(id_veterinario, q, alcance, especie)
        self.repository.registrar_auditoria(
            id_veterinario, {"q": q, "alcance": alcance, "especie": especie}
        )

        resultado = []
        for fila in filas:
            ultima_atencion = None
            if fila["ultima_fecha"]:
                ultima_atencion = {
                    "fecha": str(fila["ultima_fecha"]),
                    "veterinario": fila["ultima_veterinario"],
                    "fue_propia": fila["ultima_fue_propia"],
                }

            turno_hoy = None
            if fila["turno_hoy_hora"]:
                turno_hoy = {
                    "hora": fila["turno_hoy_hora"],
                    "estado_visual": fila["turno_hoy_estado_visual"],
                }

            resultado.append({
                "id": fila["id"],
                "nombre": fila["nombre"],
                "especie": fila["especie"],
                "raza": fila["raza"],
                "edad": f"{fila['edad_anios']} a" if fila["edad_anios"] is not None else None,
                "estado": fila["estado"],
                "propietario": {
                    "nombre": fila["propietario_nombre"],
                    "telefono": fila["propietario_telefono"],
                },
                "consultas_registradas": fila["consultas_registradas"],
                "ultima_atencion": ultima_atencion,
                "turno_hoy": turno_hoy,
            })
        return resultado