import { Link } from 'react-router-dom'
import Boton from '../../../components/common/Boton'
import './Auth.css'

function LoginPage() {
  return (
    <div className="auth-pantalla">
      <div className="auth-panel">
        <span className="auth-logo">Pet-Core</span>

        <div className="auth-tarjeta">
          <h1 className="auth-titulo">Iniciar sesión</h1>
          <p className="auth-subtitulo">Clínica Veterinaria · sede única</p>

          <form className="auth-form">
            <div className="auth-campo">
              <label htmlFor="correo">Correo electrónico</label>
              <input id="correo" type="email" placeholder="nombre@correo.com" />
            </div>
            <div className="auth-campo">
              <label htmlFor="contrasena">Contraseña</label>
              <input id="contrasena" type="password" placeholder="••••••••" />
            </div>
            <Boton type="submit" className="auth-boton">
              Ingresar
            </Boton>
            <div className="auth-enlaces">
              <a href="#">Olvidé mi contraseña</a>
              <Link to="/registro">Crear cuenta</Link>
            </div>
          </form>
        </div>

        <p className="auth-nota">
          Estado inicial. Sin segundo factor para ningún rol. El rol se determina del lado del
          servidor tras validar credenciales.
        </p>
      </div>
    </div>
  )
}

export default LoginPage
