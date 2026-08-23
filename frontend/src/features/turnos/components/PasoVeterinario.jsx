import TarjetaSeleccion from '../../../components/common/TarjetaSeleccion'
import Boton from '../../../components/common/Boton'
import Tarjeta from '../../../components/common/Tarjeta'
import { VETERINARIOS_MOCK } from '../data/reservaMock'

function PasoVeterinario({ seleccionado, onSeleccionar, onContinuar, onVolver }) {
  return (
    <Tarjeta>
      <div className="paso-etiqueta">Paso 3 de 4</div>
      <h2 className="paso-titulo">Elegí veterinario</h2>

      <div className="paso-lista">
        {VETERINARIOS_MOCK.map((veterinario) => (
          <TarjetaSeleccion
            key={veterinario.id}
            titulo={veterinario.nombre}
            subtitulo={veterinario.especialidad}
            seleccionada={seleccionado?.id === veterinario.id}
            onClick={() => onSeleccionar(veterinario)}
          />
        ))}
      </div>

      <div className="paso-acciones">
        <Boton variant="secundario" onClick={onVolver}>
          Volver
        </Boton>
        <Boton disabled={!seleccionado} onClick={onContinuar}>
          Continuar
        </Boton>
      </div>
    </Tarjeta>
  )
}

export default PasoVeterinario
