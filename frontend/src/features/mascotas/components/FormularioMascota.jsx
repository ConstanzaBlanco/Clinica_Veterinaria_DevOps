import { useState } from 'react'
import Boton from '../../../components/common/Boton'

const MASCOTA_VACIA = { nombre: '', especie: '', raza: '' }

// Formulario mockeado: agrega la mascota a la lista en memoria, sin backend.
function FormularioMascota({ onGuardar, onCancelar }) {
  const [mascota, setMascota] = useState(MASCOTA_VACIA)

  function manejarCambio(evento) {
    const { name, value } = evento.target
    setMascota((actual) => ({ ...actual, [name]: value }))
  }

  function manejarSubmit(evento) {
    evento.preventDefault()
    onGuardar(mascota)
  }

  return (
    <form className="mascota-form" onSubmit={manejarSubmit}>
      <div className="mascota-form-campo">
        <label htmlFor="nombre">Nombre</label>
        <input id="nombre" name="nombre" value={mascota.nombre} onChange={manejarCambio} required />
      </div>
      <div className="mascota-form-campo">
        <label htmlFor="especie">Especie</label>
        <input id="especie" name="especie" value={mascota.especie} onChange={manejarCambio} required />
      </div>
      <div className="mascota-form-campo">
        <label htmlFor="raza">Raza</label>
        <input id="raza" name="raza" value={mascota.raza} onChange={manejarCambio} />
      </div>
      <div className="mascota-form-acciones">
        <Boton type="button" variant="secundario" onClick={onCancelar}>
          Cancelar
        </Boton>
        <Boton type="submit">Guardar</Boton>
      </div>
    </form>
  )
}

export default FormularioMascota
