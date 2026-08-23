import { useState } from 'react'
import NavLink from './NavLink'
import { ROL_ACTUAL, NOMBRE_USUARIO_ACTUAL } from '../../app/rolActual'
import './Header.css'

const LINKS_POR_ROL = {
  cliente: [
    { to: '/mascotas', label: 'Mis mascotas' },
    { to: '/turnos', label: 'Mis turnos' },
    { to: '/turnos/nuevo', label: 'Reservar turno' },
  ],
  veterinario: [{ to: '/agenda', label: 'Mi agenda' }],
}

function obtenerIniciales(nombre) {
  return nombre
    .split(' ')
    .map((palabra) => palabra[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function Header() {
  const [menuAbierto, setMenuAbierto] = useState(false)
  const links = LINKS_POR_ROL[ROL_ACTUAL] ?? []

  return (
    <header className="header">
      <div className="header-barra">
        <div className="header-marca">
          <span className="header-logo">Pet-Core</span>

          <nav className={`header-nav ${menuAbierto ? 'header-nav-abierto' : ''}`}>
            {links.map((link) => (
              <NavLink key={link.to} to={link.to}>
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="header-usuario">
          <span className="header-badge-rol">{ROL_ACTUAL}</span>
          <span className="header-nombre">{NOMBRE_USUARIO_ACTUAL}</span>
          <span className="header-avatar">{obtenerIniciales(NOMBRE_USUARIO_ACTUAL)}</span>
          <button type="button" className="header-logout">
            Cerrar sesión
          </button>
        </div>

        <button
          type="button"
          className="header-hamburguesa"
          aria-label="Abrir menú"
          aria-expanded={menuAbierto}
          onClick={() => setMenuAbierto((abierto) => !abierto)}
        >
          ☰
        </button>
      </div>
    </header>
  )
}

export default Header
