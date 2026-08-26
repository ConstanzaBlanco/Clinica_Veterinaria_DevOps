import { apiFetch } from './client'

export function listarTurnos(token, periodo = 'proximos') {
  return apiFetch(`/turnos?periodo=${periodo}`, { token })
}

export function obtenerTurno(token, idTurno) {
  return apiFetch(`/turnos/${idTurno}`, { token })
}

export function cancelarTurno(token, idTurno) {
  return apiFetch(`/turnos/${idTurno}/cancelar`, { token, method: 'POST' })
}
