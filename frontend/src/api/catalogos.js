import { apiFetch } from './client'

export function listarTiposAtencion(token) {
  return apiFetch('/tipos-atencion', { token })
}

export function listarVeterinarios(token, signal = undefined) {
  return apiFetch('/veterinarios', { token, signal })
}
