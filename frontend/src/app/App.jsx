import { BrowserRouter } from 'react-router-dom'
import AppRoutes from '../routes'
import { AuthProvider } from './AuthContext'

// La misma imagen se sirve en la raiz ("/", notebook/minikube) y detras de un
// prefijo de path (gateway APISIX del cluster de la UCU). El basename no se
// puede fijar en build time sin romper uno de los dos casos, asi que se
// calcula en el navegador segun la URL con la que realmente se entro.
const PREFIJO_PUBLICO = '/alumno-team8-petcore'
const basename = window.location.pathname.startsWith(PREFIJO_PUBLICO)
  ? PREFIJO_PUBLICO
  : undefined

function App() {
  return (
    <BrowserRouter basename={basename}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
