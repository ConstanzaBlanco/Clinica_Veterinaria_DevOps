from app.veterinarios.repository import obtener_veterinarios_activos


class VeterinarioService:
    def listar_veterinarios(self):
        """
        Devuelve la lista de veterinarios activos.
        """
        return [dict(v) for v in self.repository.obtener_veterinarios_activos()]
