import { Outlet } from 'react-router-dom'

// Contenedor de las rutas del rol administrador. La navegación general vive
// en el Header; este layout queda como punto de extensión propio del rol.
function AdministradorLayout() {
  return <Outlet />
}

export default AdministradorLayout
