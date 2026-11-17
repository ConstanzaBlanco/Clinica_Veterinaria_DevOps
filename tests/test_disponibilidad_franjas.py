import unittest
from datetime import time
from unittest.mock import Mock

from app.disponibilidad.dto import FranjaCreate, FranjaUpdate
from app.disponibilidad.service import DisponibilidadService


def _datos_crear(dia_semana=1, hora_inicio="10:00", hora_fin="11:00"):
    return FranjaCreate(dia_semana=dia_semana, hora_inicio=hora_inicio, hora_fin=hora_fin)


def _datos_editar(hora_inicio="10:00", hora_fin="11:00"):
    return FranjaUpdate(hora_inicio=hora_inicio, hora_fin=hora_fin)


class CrearFranjaTests(unittest.TestCase):
    def test_rechaza_veterinario_inexistente(self):
        repository = Mock()
        repository.obtener_veterinario_activo.return_value = None
        service = DisponibilidadService(repository)

        with self.assertRaises(LookupError):
            service.crear_franja(1, _datos_crear())

        repository.crear_franja.assert_not_called()

    def test_rechaza_hora_fin_anterior_o_igual_a_inicio(self):
        repository = Mock()
        repository.obtener_veterinario_activo.return_value = {"id_usuario": 1}
        service = DisponibilidadService(repository)

        with self.assertRaises(ValueError):
            service.crear_franja(1, _datos_crear(hora_inicio="11:00", hora_fin="10:00"))

        repository.crear_franja.assert_not_called()

    def test_rechaza_horario_que_no_es_multiplo_de_15(self):
        repository = Mock()
        repository.obtener_veterinario_activo.return_value = {"id_usuario": 1}
        service = DisponibilidadService(repository)

        with self.assertRaises(ValueError):
            service.crear_franja(1, _datos_crear(hora_inicio="10:05", hora_fin="11:00"))

        repository.crear_franja.assert_not_called()

    def test_rechaza_franja_solapada_con_una_existente(self):
        repository = Mock()
        repository.obtener_veterinario_activo.return_value = {"id_usuario": 1}
        repository.obtener_franjas_del_dia.return_value = [
            {"id_disponibilidad": 5, "hora_inicio": time(9, 0), "hora_fin": time(13, 0)}
        ]
        service = DisponibilidadService(repository)

        with self.assertRaises(ValueError):
            service.crear_franja(1, _datos_crear(hora_inicio="12:00", hora_fin="14:00"))

        repository.crear_franja.assert_not_called()

    def test_crea_la_franja_cuando_los_datos_son_validos(self):
        repository = Mock()
        repository.obtener_veterinario_activo.return_value = {"id_usuario": 1}
        repository.obtener_franjas_del_dia.return_value = []
        repository.crear_franja.return_value = {
            "id_disponibilidad": 10,
            "id_veterinario": 1,
            "dia_semana": 1,
            "hora_inicio": time(10, 0),
            "hora_fin": time(11, 0),
            "estado": "ACTIVA",
        }
        service = DisponibilidadService(repository)

        resultado = service.crear_franja(1, _datos_crear())

        self.assertEqual(resultado["id_disponibilidad"], 10)
        repository.crear_franja.assert_called_once_with(1, 1, time(10, 0), time(11, 0))


class ActualizarFranjaTests(unittest.TestCase):
    def test_rechaza_franja_inexistente(self):
        repository = Mock()
        repository.obtener_franja.return_value = None
        service = DisponibilidadService(repository)

        with self.assertRaises(LookupError):
            service.actualizar_franja(1, 99, _datos_editar())

        repository.actualizar_horario_franja.assert_not_called()

    def test_rechaza_franja_de_otro_veterinario(self):
        repository = Mock()
        repository.obtener_franja.return_value = {
            "id_disponibilidad": 5,
            "id_veterinario": 2,
            "dia_semana": 1,
            "hora_inicio": time(9, 0),
            "hora_fin": time(13, 0),
            "estado": "ACTIVA",
        }
        service = DisponibilidadService(repository)

        with self.assertRaises(LookupError):
            service.actualizar_franja(1, 5, _datos_editar())

        repository.actualizar_horario_franja.assert_not_called()

    def test_no_se_compara_contra_si_misma_al_validar_solapamiento(self):
        repository = Mock()
        repository.obtener_franja.return_value = {
            "id_disponibilidad": 5,
            "id_veterinario": 1,
            "dia_semana": 1,
            "hora_inicio": time(9, 0),
            "hora_fin": time(13, 0),
            "estado": "ACTIVA",
        }
        repository.obtener_franjas_del_dia.return_value = []
        repository.actualizar_horario_franja.return_value = {
            "id_disponibilidad": 5,
            "id_veterinario": 1,
            "dia_semana": 1,
            "hora_inicio": time(10, 0),
            "hora_fin": time(14, 0),
            "estado": "ACTIVA",
        }
        service = DisponibilidadService(repository)

        service.actualizar_franja(1, 5, _datos_editar(hora_inicio="10:00", hora_fin="14:00"))

        repository.obtener_franjas_del_dia.assert_called_once_with(1, 1, 5)
        repository.actualizar_horario_franja.assert_called_once_with(5, time(10, 0), time(14, 0))


if __name__ == "__main__":
    unittest.main()
