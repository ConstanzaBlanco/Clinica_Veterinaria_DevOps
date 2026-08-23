import { useState } from 'react'
import MascotaCard from '../components/MascotaCard'
import FormularioMascota from '../components/FormularioMascota'
import Boton from '../../../components/common/Boton'
import { MASCOTAS_MOCK } from '../data/mascotasMock'
import './ListaMascotasPage.css'

function ListaMascotasPage() {
  const [mascotas, setMascotas] = useState(MASCOTAS_MOCK)
  const [soloActivas, setSoloActivas] = useState(true)
  const [formularioAbierto, setFormularioAbierto] = useState(false)

  const mascotasVisibles = soloActivas ? mascotas.filter((m) => m.activa) : mascotas

  function agregarMascota(datos) {
    setMascotas((actuales) => [
      ...actuales,
      {
        id: actuales.length + 1,
        activa: true,
        edad: '—',
        ultimoPeso: '—',
        proximoTurno: 'Sin turnos',
        consultas: 0,
        ...datos,
      },
    ])
    setFormularioAbierto(false)
  }

  return (
    <section className="mascotas-page">
      <div className="mascotas-encabezado">
        <div>
          <h1>Mis mascotas</h1>
          <p className="mascotas-resumen">
            {mascotas.length} mascotas · {mascotas.filter((m) => m.activa).length} activas
          </p>
        </div>

        <div className="mascotas-acciones-header">
          <div className="mascotas-tabs">
            <button
              type="button"
              className={soloActivas ? 'tab tab-activo' : 'tab'}
              onClick={() => setSoloActivas(true)}
            >
              Activas
            </button>
            <button
              type="button"
              className={!soloActivas ? 'tab tab-activo' : 'tab'}
              onClick={() => setSoloActivas(false)}
            >
              Todas
            </button>
          </div>
          <Boton type="button" onClick={() => setFormularioAbierto((abierto) => !abierto)}>
            + Registrar mascota
          </Boton>
        </div>
      </div>

      {formularioAbierto && (
        <FormularioMascota onGuardar={agregarMascota} onCancelar={() => setFormularioAbierto(false)} />
      )}

      <div className="mascotas-grid">
        {mascotasVisibles.map((mascota) => (
          <MascotaCard key={mascota.id} mascota={mascota} />
        ))}
      </div>
    </section>
  )
}

export default ListaMascotasPage
