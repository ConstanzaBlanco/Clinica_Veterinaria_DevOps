import TarjetaSeleccion from '../../../components/common/TarjetaSeleccion'
import Boton from '../../../components/common/Boton'
import Tarjeta from '../../../components/common/Tarjeta'
import { TIPOS_ATENCION_MOCK } from '../data/reservaMock'

function PasoTipoAtencion({ seleccionado, onSeleccionar, onContinuar, onVolver }) {
  return (
    <Tarjeta>
      <div className="paso-etiqueta">Paso 2 de 4</div>
      <h2 className="paso-titulo">¿Qué tipo de atención necesitás?</h2>
      <p className="paso-ayuda">La duración define los horarios que se te van a ofrecer.</p>

      <div className="paso-lista">
        {TIPOS_ATENCION_MOCK.map((tipo) => (
          <TarjetaSeleccion
            key={tipo.id}
            titulo={tipo.nombre}
            subtitulo={tipo.descripcion}
            icono={null}
            seleccionada={seleccionado?.id === tipo.id}
            onClick={() => onSeleccionar(tipo)}
            etiquetaDerecha={tipo.duracion}
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

export default PasoTipoAtencion
