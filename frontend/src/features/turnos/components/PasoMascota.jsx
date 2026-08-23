import TarjetaSeleccion from '../../../components/common/TarjetaSeleccion'
import Boton from '../../../components/common/Boton'
import Tarjeta from '../../../components/common/Tarjeta'
import { MASCOTAS_MOCK } from '../../mascotas/data/mascotasMock'

function PasoMascota({ seleccionada, onSeleccionar, onContinuar }) {
  const mascotasActivas = MASCOTAS_MOCK.filter((mascota) => mascota.activa)

  return (
    <Tarjeta>
      <div className="paso-etiqueta">Paso 1 de 4</div>
      <h2 className="paso-titulo">¿Para qué mascota es el turno?</h2>
      <p className="paso-ayuda">Solo se listan tus mascotas activas.</p>

      <div className="paso-lista">
        {mascotasActivas.map((mascota) => (
          <TarjetaSeleccion
            key={mascota.id}
            titulo={mascota.nombre}
            subtitulo={`${mascota.especie} · ${mascota.raza}`}
            seleccionada={seleccionada?.id === mascota.id}
            onClick={() => onSeleccionar(mascota)}
          />
        ))}
      </div>

      <div className="paso-acciones paso-acciones-fin">
        <Boton disabled={!seleccionada} onClick={onContinuar}>
          Continuar
        </Boton>
      </div>
    </Tarjeta>
  )
}

export default PasoMascota
