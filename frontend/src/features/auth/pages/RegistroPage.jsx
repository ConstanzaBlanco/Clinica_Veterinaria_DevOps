import { Link } from 'react-router-dom'
import Boton from '../../../components/common/Boton'
import './Auth.css'

function RegistroPage() {
  return (
    <div className="auth-pantalla">
      <div className="auth-panel">
        <span className="auth-logo">Pet-Core</span>

        <div className="auth-tarjeta">
          <h1 className="auth-titulo">Crear cuenta</h1>
          <p className="auth-subtitulo">Clínica Veterinaria · sede única</p>

          <form className="auth-form">
            <div className="auth-campo">
              <label htmlFor="nombre">Nombre y apellido</label>
              <input id="nombre" type="text" placeholder="Ana Giménez" />
            </div>
            <div className="auth-campo">
              <label htmlFor="correo">Correo electrónico</label>
              <input id="correo" type="email" placeholder="nombre@correo.com" />
            </div>
            <div className="auth-campo">
              <label htmlFor="contrasena">Contraseña</label>
              <input id="contrasena" type="password" placeholder="••••••••" />
            </div>
            <div className="auth-campo">
              <label htmlFor="confirmar-contrasena">Confirmar contraseña</label>
              <input id="confirmar-contrasena" type="password" placeholder="••••••••" />
            </div>
            <Boton type="submit" className="auth-boton">
              Crear cuenta
            </Boton>
            <div className="auth-enlaces">
              <Link to="/login">Ya tengo cuenta</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default RegistroPage
