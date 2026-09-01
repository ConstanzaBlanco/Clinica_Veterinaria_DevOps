import { useEffect, useState } from 'react'
import Boton from '../../../components/common/Boton'
import { useAuth } from '../../../app/AuthContext'
import { obtenerAgenda } from '../../../api/agenda'
import './AgendaDiariaPage.css'

const HORA_INICIO_PREDETERMINADA = 8
const HORA_FIN_PREDETERMINADA = 18
const PIXELES_POR_MINUTO = 1.15
const MARGEN_VERTICAL_LINEA_TIEMPO = 20

const ETIQUETAS_ESTADO = {
  ATENDIDO: 'Atendido',
  EN_CURSO: 'En curso',
  CONFIRMADO: 'Confirmado',
  NO_ASISTIO: 'No asistió',
}

function obtenerFechaLocal() {
  const ahora = new Date()
  const diferenciaZonaHoraria = ahora.getTimezoneOffset() * 60_000

  return new Date(ahora.getTime() - diferenciaZonaHoraria)
    .toISOString()
    .slice(0, 10)
}

function desplazarFecha(fecha, cantidadDias) {
  const fechaNueva = new Date(`${fecha}T12:00:00`)
  fechaNueva.setDate(fechaNueva.getDate() + cantidadDias)

  const diferenciaZonaHoraria = fechaNueva.getTimezoneOffset() * 60_000

  return new Date(fechaNueva.getTime() - diferenciaZonaHoraria)
    .toISOString()
    .slice(0, 10)
}

function formatearFecha(fecha) {
  const texto = new Date(`${fecha}T12:00:00`).toLocaleDateString('es-UY', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function convertirHoraAMinutos(hora) {
  const [horas, minutos] = hora.split(':').map(Number)

  return horas * 60 + minutos
}

function obtenerLimitesHorario(turnos) {
  if (turnos.length === 0) {
    return {
      horaInicio: HORA_INICIO_PREDETERMINADA,
      horaFin: HORA_FIN_PREDETERMINADA,
    }
  }

  const minutosInicio = turnos.map((turno) => convertirHoraAMinutos(turno.hora_inicio))
  const minutosFin = turnos.map(
    (turno) => convertirHoraAMinutos(turno.hora_inicio) + turno.duracion_minutos,
  )

  return {
    horaInicio: Math.min(
      HORA_INICIO_PREDETERMINADA,
      Math.floor(Math.min(...minutosInicio) / 60),
    ),
    horaFin: Math.max(
      HORA_FIN_PREDETERMINADA,
      Math.ceil(Math.max(...minutosFin) / 60),
    ),
  }
}

function crearHoras(horaInicio, horaFin) {
  return Array.from(
    { length: horaFin - horaInicio + 1 },
    (_, indice) => horaInicio + indice,
  )
}

function obtenerClaseEstado(estadoVisual) {
  return estadoVisual.toLowerCase().replaceAll('_', '-')
}

function AgendaDiariaPage() {
  const { token } = useAuth()
  const [fecha, setFecha] = useState(obtenerFechaLocal)
  const [agenda, setAgenda] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [actualizando, setActualizando] = useState(false)
  const [error, setError] = useState('')
  const [mostrarAvisoCambios, setMostrarAvisoCambios] = useState(false)

  useEffect(() => {
    const controlador = new AbortController()

    setCargando(true)
    setError('')
    setMostrarAvisoCambios(false)

    obtenerAgenda(token, fecha, null, controlador.signal)
      .then(setAgenda)
      .catch((errorPeticion) => {
        if (errorPeticion.name !== 'AbortError') {
          setError(errorPeticion.message)
        }
      })
      .finally(() => {
        if (!controlador.signal.aborted) {
          setCargando(false)
        }
      })

    return () => controlador.abort()
  }, [fecha, token])

  async function actualizarAgenda() {
    if (!agenda) {
      return
    }

    setActualizando(true)
    setError('')

    try {
      const agendaActualizada = await obtenerAgenda(
        token,
        fecha,
        agenda.consultado_el,
      )

      setAgenda(agendaActualizada)
      setMostrarAvisoCambios(agendaActualizada.hay_cambios)
    } catch (errorPeticion) {
      setError(errorPeticion.message)
    } finally {
      setActualizando(false)
    }
  }

  const turnos = agenda?.turnos ?? []
  const { horaInicio, horaFin } = obtenerLimitesHorario(turnos)
  const horas = crearHoras(horaInicio, horaFin)
  const minutosInicio = horaInicio * 60
  const altoLineaTiempo =
    (horaFin - horaInicio) * 60 * PIXELES_POR_MINUTO +
    MARGEN_VERTICAL_LINEA_TIEMPO * 2

  return (
    <section className="agenda-page">
      <div className="agenda-encabezado">
        <div>
          <h1>Agenda del día</h1>

          {agenda && (
            <p className="agenda-resumen-texto">
              {formatearFecha(agenda.fecha)} · {agenda.resumen.total}{' '}
              {agenda.resumen.total === 1 ? 'turno' : 'turnos'} ·{' '}
              {agenda.resumen.atendidos} atendidos · {agenda.resumen.en_curso} en curso
            </p>
          )}
        </div>

        <div className="agenda-navegacion">
          <Boton
            type="button"
            variant="secundario"
            onClick={() => setFecha((actual) => desplazarFecha(actual, -1))}
          >
            ◀ Ayer
          </Boton>

          <Boton
            type="button"
            variant="secundario"
            onClick={() => setFecha(obtenerFechaLocal())}
          >
            Hoy
          </Boton>

          <Boton
            type="button"
            variant="secundario"
            onClick={() => setFecha((actual) => desplazarFecha(actual, 1))}
          >
            Mañana ▶
          </Boton>

          <Boton type="button" disabled={actualizando || cargando} onClick={actualizarAgenda}>
            {actualizando ? 'Actualizando...' : '● Actualizar'}
          </Boton>
        </div>
      </div>

      {mostrarAvisoCambios && (
        <div className="agenda-aviso-cambios" role="status">
          <span>
            <strong>La agenda cambió.</strong> La información mostrada ya está actualizada.
          </span>

          <Boton type="button" onClick={() => setMostrarAvisoCambios(false)}>
            Ver cambios
          </Boton>
        </div>
      )}

      <div className="agenda-leyenda" aria-label="Estados de los turnos">
        <span>
          <i className="agenda-leyenda-marca agenda-leyenda-confirmado" />
          Pendiente de atención
        </span>
        <span>
          <i className="agenda-leyenda-marca agenda-leyenda-atendido" />
          Atendido
        </span>
        <span>
          <i className="agenda-leyenda-marca agenda-leyenda-en-curso" />
          En curso
        </span>
      </div>

      {cargando && <div className="agenda-mensaje">Cargando agenda...</div>}

      {!cargando && error && (
        <div className="agenda-mensaje agenda-mensaje-error">{error}</div>
      )}

      {!cargando && !error && agenda && (
        <div className="agenda-panel">
          <div className="agenda-calendario-desplazable">
            <div className="agenda-calendario">
              <div className="agenda-horas" style={{ height: altoLineaTiempo }}>
                {horas.map((hora) => (
                  <span
                    key={hora}
                    className="agenda-hora"
                    style={{
                      top:
                        (hora * 60 - minutosInicio) * PIXELES_POR_MINUTO +
                        MARGEN_VERTICAL_LINEA_TIEMPO,
                    }}
                  >
                    {String(hora).padStart(2, '0')}:00
                  </span>
                ))}
              </div>

              <div className="agenda-linea-tiempo" style={{ height: altoLineaTiempo }}>
                {horas.map((hora) => (
                  <span
                    key={hora}
                    className="agenda-linea-hora"
                    style={{
                      top:
                        (hora * 60 - minutosInicio) * PIXELES_POR_MINUTO +
                        MARGEN_VERTICAL_LINEA_TIEMPO,
                    }}
                  />
                ))}

                {turnos.map((turno) => {
                  const inicioTurno = convertirHoraAMinutos(turno.hora_inicio)
                  const claseEstado = obtenerClaseEstado(turno.estado_visual)

                  return (
                    <article
                      key={turno.id}
                      className={`agenda-turno agenda-turno-${claseEstado}`}
                      style={{
                        top:
                          (inicioTurno - minutosInicio) * PIXELES_POR_MINUTO +
                          MARGEN_VERTICAL_LINEA_TIEMPO +
                          2,
                        height: turno.duracion_minutos * PIXELES_POR_MINUTO - 4,
                      }}
                    >
                      <div className="agenda-turno-paciente">
                        <strong>
                          {turno.hora_inicio} · {turno.duracion_minutos}'
                        </strong>
                        <span>
                          <b>{turno.mascota.nombre}</b> · {turno.mascota.especie} ·{' '}
                          {turno.propietario}
                        </span>
                      </div>

                      <span className="agenda-turno-tipo">{turno.tipo}</span>

                      <span className={`agenda-estado agenda-estado-${claseEstado}`}>
                        {ETIQUETAS_ESTADO[turno.estado_visual] ?? turno.estado_visual}
                      </span>

                      {turno.agendado_por_administracion && (
                        <span className="agenda-turno-administracion">
                          Agendado por administración
                        </span>
                      )}
                    </article>
                  )
                })}

                {turnos.length === 0 && (
                  <div className="agenda-vacia">
                    No hay turnos para este día.
                  </div>
                )}
              </div>
            </div>
          </div>

          <p className="agenda-nota">
            Los turnos cancelados no aparecen en la agenda.
          </p>
        </div>
      )}
    </section>
  )
}

export default AgendaDiariaPage
