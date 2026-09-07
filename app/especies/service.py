from app.especies.repository import EspecieRepository


class EspecieService:
    """Reglas de negocio del catálogo de especies (hoy es solo un pasamanos al repository)."""

    def __init__(self, repository: EspecieRepository):
        self.repository = repository

    def listar_activas(self):
        """Especies activas disponibles para elegir al registrar una mascota."""
        return self.repository.listar_activas()
