import unittest
from unittest.mock import Mock

from prometheus_client import REGISTRY

from app.turnos.repository import TurnoRepository


class QueryDurationTests(unittest.TestCase):
    def count(self):
        return REGISTRY.get_sample_value(
            "pg_query_duration_seconds_count", {"query": "listar_turnos_cliente"}
        )

    def test_observes_query_and_preserves_results(self):
        session = Mock()
        expected = [{"id_turno": 12}]
        session.execute.return_value.mappings.return_value.all.return_value = expected
        before = self.count()

        result = TurnoRepository(session).listar_por_cliente(7, "todos")

        self.assertIs(result, expected)
        self.assertEqual(self.count(), before + 1)
        self.assertEqual(session.execute.call_args.args[1], {"id_cliente": 7})
        session.execute.return_value.mappings.return_value.all.assert_called_once()

    def test_observes_failure_without_hiding_exception(self):
        session = Mock()
        error = RuntimeError("consulta fallida")
        session.execute.return_value.mappings.return_value.all.side_effect = error
        before = self.count()

        with self.assertRaises(RuntimeError) as caught:
            TurnoRepository(session).listar_por_cliente(7, "proximos")

        self.assertIs(caught.exception, error)
        self.assertEqual(self.count(), before + 1)


if __name__ == "__main__":
    unittest.main()
