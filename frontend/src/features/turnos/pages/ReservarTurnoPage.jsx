import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Stepper from '../../../components/common/Stepper'
import PasoMascota from '../components/PasoMascota'
import PasoTipoAtencion from '../components/PasoTipoAtencion'
import PasoVeterinario from '../components/PasoVeterinario'
import PasoHorario from '../components/PasoHorario'
import PasoConfirmar from '../components/PasoConfirmar'
import './ReservarTurnoPage.css'

const PASOS = ['Mascota', 'Tipo de atención', 'Veterinario', 'Horario']

function ReservarTurnoPage() {
  const navigate = useNavigate()

  const [pasoActual, setPasoActual] = useState(1)
  const [mascota, setMascota] = useState(null)
  const [tipoAtencion, setTipoAtencion] = useState(null)
  const [veterinario, setVeterinario] = useState(null)
  const [horario, setHorario] = useState(null)

  function confirmarTurno() {
    navigate('/turnos')
  }

  return (
    <section className="reservar-page">
      <h1>Reservar un turno</h1>

      <div className="reservar-stepper">
        <Stepper pasos={PASOS} pasoActual={pasoActual} />
      </div>

      {pasoActual === 1 && (
        <PasoMascota seleccionada={mascota} onSeleccionar={setMascota} onContinuar={() => setPasoActual(2)} />
      )}

      {pasoActual === 2 && (
        <PasoTipoAtencion
          seleccionado={tipoAtencion}
          onSeleccionar={setTipoAtencion}
          onContinuar={() => setPasoActual(3)}
          onVolver={() => setPasoActual(1)}
        />
      )}

      {pasoActual === 3 && (
        <PasoVeterinario
          seleccionado={veterinario}
          onSeleccionar={setVeterinario}
          onContinuar={() => setPasoActual(4)}
          onVolver={() => setPasoActual(2)}
        />
      )}

      {pasoActual === 4 && (
        <PasoHorario
          seleccionado={horario}
          onSeleccionar={setHorario}
          onContinuar={() => setPasoActual(5)}
          onVolver={() => setPasoActual(3)}
        />
      )}

      {pasoActual === 5 && (
        <PasoConfirmar
          mascota={mascota}
          tipoAtencion={tipoAtencion}
          veterinario={veterinario}
          horario={horario}
          onVolver={() => setPasoActual(4)}
          onConfirmar={confirmarTurno}
        />
      )}
    </section>
  )
}

export default ReservarTurnoPage
