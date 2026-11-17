import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../../../app/AuthContext'
import { listarVeterinarios } from '../../../api/catalogos'
import { listarFranjas, crearFranja, editarFranja } from '../../../api/disponibilidad'
import Boton from '../../../components/common/Boton'
import './HorarioVeterinarioPage.css'

const DIAS_SEMANA = [
  { numero: 1, nombre: 'Lunes' },
  { numero: 2, nombre: 'Martes' },
  { numero: 3, nombre: 'Miércoles' },
  { numero: 4, nombre: 'Jueves' },
  { numero: 5, nombre: 'Viernes' },
  { numero: 6, nombre: 'Sábado' },
  { numero: 7, nombre: 'Domingo' },
]

// El backend devuelve "HH:MM:SS"; <input type="time"> necesita "HH:MM".
function aCorto(hora) {
  return hora?.slice(0, 5) ?? ''
}

function FormularioFranja({ horaInicioInicial, horaFinInicial, guardando, error, onGuardar, onCancelar }) {
  const [horaInicio, setHoraInicio] = useState(horaInicioInicial)
  const [horaFin, setHoraFin] = useState(horaFinInicial)

  return (
    <form
      className="horario-form"
      onSubmit={(evento) => {
        evento.preventDefault()
        onGuardar({ horaInicio, horaFin })
      }}
    >
      <div className="horario-form-campo">
        <input
          type="time"
          step="900"
          value={horaInicio}
          onChange={(evento) => setHoraInicio(evento.target.value)}
          required
        />
      </div>

      <span className="horario-form-separador">a</span>

      <div className="horario-form-campo">
        <input
          type="time"
          step="900"
          value={horaFin}
          onChange={(evento) => setHoraFin(evento.target.value)}
          required
        />
      </div>

      <div className="horario-form-acciones">
        <Boton type="submit" disabled={guardando}>
          {guardando ? 'Guardando...' : 'Guardar'}
        </Boton>
        <Boton type="button" variant="secundario" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </Boton>
      </div>

      {error && (
        <p className="horario-form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}

function HorarioVeterinarioPage() {
  const { token } = useAuth()
  const { idVeterinario } = useParams()

  const [veterinario, setVeterinario] = useState(null)
  const [franjas, setFranjas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [edicionActiva, setEdicionActiva] = useState(null)
  const [diaAgregando, setDiaAgregando] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [errorFormulario, setErrorFormulario] = useState('')

  function cargarFranjas() {
    return listarFranjas(token, idVeterinario).then(setFranjas)
  }

  useEffect(() => {
    setCargando(true)
    setError('')

    Promise.all([listarVeterinarios(token), listarFranjas(token, idVeterinario)])
      .then(([veterinarios, franjasVeterinario]) => {
        setVeterinario(veterinarios.find((v) => String(v.id_usuario) === idVeterinario) ?? null)
        setFranjas(franjasVeterinario)
      })
      .catch((errorPeticion) => setError(errorPeticion.message || 'No se pudo obtener el horario.'))
      .finally(() => setCargando(false))
  }, [token, idVeterinario])

  function cerrarFormularios() {
    setEdicionActiva(null)
    setDiaAgregando(null)
    setErrorFormulario('')
  }

  function manejarGuardarNueva(diaSemana, datos) {
    setGuardando(true)
    setErrorFormulario('')

    crearFranja(token, idVeterinario, { diaSemana, ...datos })
      .then(() => {
        setDiaAgregando(null)
        return cargarFranjas()
      })
      .catch((errorPeticion) => setErrorFormulario(errorPeticion.message || 'No se pudo crear la franja.'))
      .finally(() => setGuardando(false))
  }

  function manejarGuardarEdicion(idDisponibilidad, datos) {
    setGuardando(true)
    setErrorFormulario('')

    editarFranja(token, idVeterinario, idDisponibilidad, datos)
      .then(() => {
        setEdicionActiva(null)
        return cargarFranjas()
      })
      .catch((errorPeticion) => setErrorFormulario(errorPeticion.message || 'No se pudo editar la franja.'))
      .finally(() => setGuardando(false))
  }

  return (
    <section className="horario-page">
      <div className="horario-encabezado">
        <h1>
          Horario de{' '}
          {veterinario ? `${veterinario.nombre} ${veterinario.apellido}` : `veterinario #${idVeterinario}`}
        </h1>
      </div>

      {cargando && <div className="horario-mensaje">Cargando horario...</div>}

      {!cargando && error && <div className="horario-mensaje horario-mensaje-error">{error}</div>}

      {!cargando && !error && (
        <div className="horario-dias">
          {DIAS_SEMANA.map((dia) => {
            const franjasDelDia = franjas.filter((franja) => franja.dia_semana === dia.numero)

            return (
              <div key={dia.numero} className="horario-dia">
                <div className="horario-dia-nombre">{dia.nombre}</div>

                <div className="horario-dia-franjas">
                  {franjasDelDia.length === 0 && diaAgregando !== dia.numero && (
                    <span className="horario-sin-franjas">Sin horario cargado</span>
                  )}

                  {franjasDelDia.map((franja) =>
                    edicionActiva === franja.id_disponibilidad ? (
                      <FormularioFranja
                        key={franja.id_disponibilidad}
                        horaInicioInicial={aCorto(franja.hora_inicio)}
                        horaFinInicial={aCorto(franja.hora_fin)}
                        guardando={guardando}
                        error={errorFormulario}
                        onGuardar={(datos) => manejarGuardarEdicion(franja.id_disponibilidad, datos)}
                        onCancelar={cerrarFormularios}
                      />
                    ) : (
                      <button
                        key={franja.id_disponibilidad}
                        type="button"
                        className="horario-franja-chip"
                        onClick={() => {
                          cerrarFormularios()
                          setEdicionActiva(franja.id_disponibilidad)
                        }}
                      >
                        {aCorto(franja.hora_inicio)} - {aCorto(franja.hora_fin)}
                      </button>
                    ),
                  )}

                  {diaAgregando === dia.numero ? (
                    <FormularioFranja
                      horaInicioInicial="09:00"
                      horaFinInicial="10:00"
                      guardando={guardando}
                      error={errorFormulario}
                      onGuardar={(datos) => manejarGuardarNueva(dia.numero, datos)}
                      onCancelar={cerrarFormularios}
                    />
                  ) : (
                    <button
                      type="button"
                      className="horario-agregar"
                      onClick={() => {
                        cerrarFormularios()
                        setDiaAgregando(dia.numero)
                      }}
                    >
                      + Agregar franja
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default HorarioVeterinarioPage
