import { useState } from 'react'
import Boton from '../../../components/common/Boton'

const MASCOTA_VACIA = {
  nombre: '',
  especie: '',
  raza: '',
}

function FormularioMascota({
  onGuardar,
  onCancelar,
}) {
  const [mascota, setMascota] =
    useState(MASCOTA_VACIA)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  function manejarCambio(evento) {
    const { name, value } = evento.target

    setMascota((mascotaActual) => ({
      ...mascotaActual,
      [name]: value,
    }))

    if (error) {
      setError('')
    }
  }

  async function manejarSubmit(evento) {
    evento.preventDefault()
    setError('')
    setGuardando(true)

    try {
      await onGuardar({
        nombre: mascota.nombre.trim(),
        especie: mascota.especie.trim(),
        raza: mascota.raza.trim() || null,
      })
    } catch (errorRegistro) {
      setError(
        errorRegistro.message ||
          'No se pudo registrar la mascota.',
      )
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form
      className="mascota-form"
      onSubmit={manejarSubmit}
    >
      <div className="mascota-form-campo">
        <label htmlFor="nombre">Nombre</label>

        <input
          id="nombre"
          name="nombre"
          type="text"
          maxLength="100"
          value={mascota.nombre}
          onChange={manejarCambio}
          required
        />
      </div>

      <div className="mascota-form-campo">
        <label htmlFor="especie">Especie</label>

        <input
          id="especie"
          name="especie"
          type="text"
          maxLength="100"
          value={mascota.especie}
          onChange={manejarCambio}
          required
        />
      </div>

      <div className="mascota-form-campo">
        <label htmlFor="raza">Raza</label>

        <input
          id="raza"
          name="raza"
          type="text"
          maxLength="100"
          value={mascota.raza}
          onChange={manejarCambio}
        />
      </div>

      {error && (
        <p
          className="mascota-form-error"
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="mascota-form-acciones">
        <Boton
          type="button"
          variant="secundario"
          onClick={onCancelar}
          disabled={guardando}
        >
          Cancelar
        </Boton>

        <Boton
          type="submit"
          disabled={guardando}
        >
          {guardando ? 'Guardando...' : 'Guardar'}
        </Boton>
      </div>
    </form>
  )
}

export default FormularioMascota