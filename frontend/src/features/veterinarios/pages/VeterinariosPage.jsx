import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../app/AuthContext'
import { listarVeterinarios } from '../../../api/catalogos'
import Boton from '../../../components/common/Boton'
import './VeterinariosPage.css'

function TarjetaVeterinario({ veterinario }) {
  return (
    <article className="veterinario-card">
      <div className="veterinario-card-encabezado">
        <div className="veterinario-foto">foto</div>

        <div className="veterinario-card-titulo">
          <div className="veterinario-nombre">
            {veterinario.nombre} {veterinario.apellido}
          </div>
          <div className="veterinario-matricula">Matrícula {veterinario.matricula_profesional}</div>
        </div>
      </div>

      <Boton as={Link} to={`/veterinarios/${veterinario.id_usuario}/horario`} className="veterinario-boton">
        Ver y editar horario
      </Boton>
    </article>
  )
}

function VeterinariosPage() {
  const { token } = useAuth()

  const [veterinarios, setVeterinarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controlador = new AbortController()

    listarVeterinarios(token, controlador.signal)
      .then(setVeterinarios)
      .catch((errorPeticion) => {
        if (errorPeticion.name !== 'AbortError') {
          setError(errorPeticion.message || 'No se pudieron obtener los veterinarios.')
        }
      })
      .finally(() => {
        if (!controlador.signal.aborted) {
          setCargando(false)
        }
      })

    return () => controlador.abort()
  }, [token])

  return (
    <section className="veterinarios-page">
      <div className="veterinarios-encabezado">
        <h1>Veterinarios</h1>
      </div>

      {cargando && <div className="veterinarios-mensaje">Buscando veterinarios...</div>}

      {!cargando && error && <div className="veterinarios-mensaje veterinarios-mensaje-error">{error}</div>}

      {!cargando && !error && veterinarios.length === 0 && (
        <div className="veterinarios-mensaje">No hay veterinarios activos.</div>
      )}

      {!cargando && !error && veterinarios.length > 0 && (
        <div className="veterinarios-grid">
          {veterinarios.map((veterinario) => (
            <TarjetaVeterinario key={veterinario.id_usuario} veterinario={veterinario} />
          ))}
        </div>
      )}
    </section>
  )
}

export default VeterinariosPage
