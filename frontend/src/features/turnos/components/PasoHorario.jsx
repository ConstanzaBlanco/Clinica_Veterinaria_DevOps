import Boton from '../../../components/common/Boton'
import Tarjeta from '../../../components/common/Tarjeta'
import { HORARIOS_MOCK } from '../data/reservaMock'

function PasoHorario({ seleccionado, onSeleccionar, onContinuar, onVolver }) {
  return (
    <Tarjeta>
      <div className="paso-etiqueta">Paso 4 de 4</div>
      <h2 className="paso-titulo">Elegí un horario</h2>
      <p className="paso-ayuda">Mar 25 · agosto 2026</p>

      <div className="horario-franjas">
        {Object.entries(HORARIOS_MOCK).map(([franja, horarios]) => (
          <div key={franja}>
            <div className="horario-franja-titulo">{franja}</div>
            <div className="horario-grid">
              {horarios.map((horario) => {
                const ocupado = horario.estado === 'ocupado'
                const activo = seleccionado === horario.hora

                return (
                  <button
                    type="button"
                    key={horario.hora}
                    className={`horario-slot ${activo ? 'horario-slot-activo' : ''} ${
                      ocupado ? 'horario-slot-ocupado' : ''
                    }`}
                    disabled={ocupado}
                    onClick={() => onSeleccionar(horario.hora)}
                  >
                    {horario.hora}
                  </button>
                )
              })}
            </div>
          </div>
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

export default PasoHorario
