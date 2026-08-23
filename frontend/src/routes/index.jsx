import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from '../layouts/AppLayout'
import ClienteLayout from '../layouts/ClienteLayout'
import VeterinarioLayout from '../layouts/VeterinarioLayout'
import RoleGuard from '../components/layout/RoleGuard'
import { ROL_ACTUAL } from '../app/rolActual'
import LoginPage from '../features/auth/pages/LoginPage'
import RegistroPage from '../features/auth/pages/RegistroPage'
import ListaMascotasPage from '../features/mascotas/pages/ListaMascotasPage'
import MisTurnosPage from '../features/turnos/pages/MisTurnosPage'
import DetalleTurnoPage from '../features/turnos/pages/DetalleTurnoPage'
import ReservarTurnoPage from '../features/turnos/pages/ReservarTurnoPage'
import HistorialMascotaPage from '../features/historial/pages/HistorialMascotaPage'
import AgendaDiariaPage from '../features/agenda/pages/AgendaDiariaPage'

// Ruta de entrada por rol, según el rol simulado en app/rolActual.js.
const RUTA_INICIO_POR_ROL = {
  cliente: '/mascotas',
  veterinario: '/agenda',
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/registro" element={<RegistroPage />} />

      <Route element={<AppLayout />}>
        <Route index element={<Navigate to={RUTA_INICIO_POR_ROL[ROL_ACTUAL]} replace />} />

        <Route
          element={
            <RoleGuard rolPermitido="cliente">
              <ClienteLayout />
            </RoleGuard>
          }
        >
          <Route path="mascotas" element={<ListaMascotasPage />} />
          <Route path="turnos" element={<MisTurnosPage />} />
          <Route path="turnos/nuevo" element={<ReservarTurnoPage />} />
          <Route path="turnos/:id" element={<DetalleTurnoPage />} />
          <Route path="turnos/:id/historial" element={<HistorialMascotaPage />} />
        </Route>

        <Route
          element={
            <RoleGuard rolPermitido="veterinario">
              <VeterinarioLayout />
            </RoleGuard>
          }
        >
          <Route path="agenda" element={<AgendaDiariaPage />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default AppRoutes
