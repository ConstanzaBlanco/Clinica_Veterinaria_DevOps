import unittest
from unittest.mock import Mock

from prometheus_client import REGISTRY
from sqlalchemy.exc import IntegrityError

from app.Auth.Register.clients.repository import RegisterRepository


DATOS = {
    "nombre": "Ana",
    "apellido": "Perez",
    "documento": "12345678",
    "correo": "ana@example.com",
    "telefono": "099123456",
    "contrasena_hash": "hash",
}


class ClientesRegistradosTests(unittest.TestCase):
    def count(self):
        return REGISTRY.get_sample_value("clientes_registrados_total")

    def sesion_exitosa(self):
        session = Mock()
        fila = {
            "id_usuario": 5,
            "nombre": "Ana",
            "apellido": "Perez",
            "documento": "12345678",
            "correo": "ana@example.com",
            "telefono": "099123456",
        }
        session.execute.return_value.mappings.return_value.one.return_value = fila
        return session

    def test_incrementa_tras_alta_exitosa_y_preserva_resultado(self):
        session = self.sesion_exitosa()
        before = self.count()

        usuario = RegisterRepository(session).crear_cliente(**DATOS)

        self.assertEqual(self.count(), before + 1)
        self.assertEqual(usuario["id_usuario"], 5)
        self.assertEqual(usuario["rol"], "CLIENTE")
        session.commit.assert_called_once()

    def test_no_incrementa_si_hay_integrity_error(self):
        session = Mock()
        error = IntegrityError("INSERT", {}, Exception("duplicado"))
        session.execute.side_effect = error
        before = self.count()

        with self.assertRaises(IntegrityError) as caught:
            RegisterRepository(session).crear_cliente(**DATOS)

        self.assertIs(caught.exception, error)
        self.assertEqual(self.count(), before)
        session.rollback.assert_called_once()

    def test_no_incrementa_si_falla_el_commit(self):
        session = self.sesion_exitosa()
        session.commit.side_effect = RuntimeError("commit fallido")
        before = self.count()

        with self.assertRaises(RuntimeError):
            RegisterRepository(session).crear_cliente(**DATOS)

        self.assertEqual(self.count(), before)


if __name__ == "__main__":
    unittest.main()