import Boton from '../../../components/common/Boton'
import Tarjeta from '../../../components/common/Tarjeta'

function PasoConfirmar({ mascota, tipoAtencion, veterinario, horario, onVolver, onConfirmar }) {
  return (
    <Tarjeta>
      <div className="paso-etiqueta">Confirmación</div>
      <h2 className="paso-titulo">Revisá los datos del turno</h2>

      <div className="resumen-turno">
        <div className="resumen-fila">
          <span>Mascota</span>
          <strong>{mascota.nombre}</strong>
        </div>
        <div className="resumen-fila">
          <span>Tipo de atención</span>
          <strong>{tipoAtencion.nombre}</strong>
        </div>
        <div className="resumen-fila">
          <span>Veterinario</span>
          <strong>{veterinario.nombre}</strong>
        </div>
        <div className="resumen-fila">
          <span>Horario</span>
          <strong>{horario}</strong>
        </div>
      </div>

      <div className="paso-acciones">
        <Boton variant="secundario" onClick={onVolver}>
          Volver
        </Boton>
        <Boton onClick={onConfirmar}>Confirmar turno</Boton>
      </div>
    </Tarjeta>
  )
}

export default PasoConfirmar
