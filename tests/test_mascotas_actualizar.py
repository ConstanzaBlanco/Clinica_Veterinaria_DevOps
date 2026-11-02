import sys
import unittest
from unittest.mock import Mock

# El repositorio importa app.database, que al cargarse exige toda la config
# (JWT, Postgres). Estos tests no tocan la base, asi que se reemplaza el modulo.
sys.modules.setdefault("app.database", Mock())

from app.Mascotas.dto import MascotaUpdate
from app.Mascotas.repository import MascotaRepository


class ActualizarMascotaTests(unittest.TestCase):
    def test_columnas_editables_coinciden_con_el_dto(self):
        self.assertEqual(
            MascotaRepository.COLUMNAS_EDITABLES,
            set(MascotaUpdate.model_fields),
        )

    def test_rechaza_columnas_no_editables(self):
        session = Mock()
        repo = MascotaRepository(session)

        with self.assertRaises(ValueError):
            repo.actualizar(1, 1, {"id_cliente": 99})

        session.execute.assert_not_called()

    def test_rechaza_inyeccion_en_el_nombre_de_columna(self):
        session = Mock()
        repo = MascotaRepository(session)

        with self.assertRaises(ValueError):
            repo.actualizar(1, 1, {"nombre = 'x', estado": "y"})

        session.execute.assert_not_called()

    def test_acepta_columnas_editables(self):
        session = Mock()
        session.execute.return_value.mappings.return_value.first.return_value = {"id_mascota": 1}
        repo = MascotaRepository(session)

        resultado = repo.actualizar(1, 1, {"nombre": "Firulais", "raza": "Mestizo"})

        self.assertEqual(resultado, {"id_mascota": 1})
        session.execute.assert_called_once()


if __name__ == "__main__":
    unittest.main()
