import { apiFetch } from './client'

// Franjas recurrentes (crudas) de un veterinario, para que el admin las edite.
export function listarFranjas(token, idVeterinario) {
  return apiFetch(`/disponibilidad/veterinarios/${idVeterinario}/franjas`, { token })
}

export function crearFranja(token, idVeterinario, { diaSemana, horaInicio, horaFin }) {
  return apiFetch(`/disponibilidad/veterinarios/${idVeterinario}/franjas`, {
    token,
    method: 'POST',
    body: JSON.stringify({
      dia_semana: diaSemana,
      hora_inicio: horaInicio,
      hora_fin: horaFin,
    }),
  })
}

export function editarFranja(token, idVeterinario, idDisponibilidad, { horaInicio, horaFin }) {
  return apiFetch(`/disponibilidad/veterinarios/${idVeterinario}/franjas/${idDisponibilidad}`, {
    token,
    method: 'PUT',
    body: JSON.stringify({
      hora_inicio: horaInicio,
      hora_fin: horaFin,
    }),
  })
}
