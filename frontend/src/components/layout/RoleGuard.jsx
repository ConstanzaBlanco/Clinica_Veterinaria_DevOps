import { Navigate } from 'react-router-dom'
import { ROL_ACTUAL } from '../../app/rolActual'

// Redirige si el rol simulado no coincide con el permitido para esta sección.
// No es un sistema de auth real: solo evita que un rol vea rutas de otro.
function RoleGuard({ rolPermitido, children }) {
  if (ROL_ACTUAL !== rolPermitido) {
    return <Navigate to="/" replace />
  }

  return children
}

export default RoleGuard
