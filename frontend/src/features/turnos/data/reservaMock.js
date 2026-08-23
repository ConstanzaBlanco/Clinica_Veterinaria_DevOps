// Datos de ejemplo para maquetar el flujo de reserva. No viene de ninguna API todavía.
export const TIPOS_ATENCION_MOCK = [
  {
    id: 1,
    nombre: 'Consulta general',
    descripcion: 'Motivo clínico general, revisión y diagnóstico',
    duracion: '30 min',
  },
  {
    id: 2,
    nombre: 'Control',
    descripcion: 'Seguimiento de un tratamiento en curso',
    duracion: '20 min',
  },
  {
    id: 3,
    nombre: 'Vacunación',
    descripcion: 'Aplicación de vacuna y registro en el carnet',
    duracion: '15 min',
  },
]

export const VETERINARIOS_MOCK = [
  { id: 1, nombre: 'Dra. Marcela Álvarez', especialidad: 'Clínica general · MP 4821' },
  { id: 2, nombre: 'Dr. Julián Bianchi', especialidad: 'Clínica general · MP 5103' },
  { id: 3, nombre: 'Dra. Sofía Duarte', especialidad: 'Clínica general · MP 5388' },
]

export const HORARIOS_MOCK = {
  'Mañana · 8:00 a 12:00': [
    { hora: '08:00', estado: 'disponible' },
    { hora: '08:15', estado: 'ocupado' },
    { hora: '08:30', estado: 'ocupado' },
    { hora: '08:45', estado: 'disponible' },
    { hora: '09:00', estado: 'ocupado' },
    { hora: '09:15', estado: 'disponible' },
    { hora: '09:30', estado: 'disponible' },
    { hora: '09:45', estado: 'disponible' },
  ],
  'Tarde · 12:00 a 18:00': [
    { hora: '12:00', estado: 'disponible' },
    { hora: '12:15', estado: 'disponible' },
    { hora: '12:30', estado: 'ocupado' },
    { hora: '12:45', estado: 'ocupado' },
    { hora: '13:00', estado: 'disponible' },
    { hora: '13:15', estado: 'disponible' },
    { hora: '13:30', estado: 'ocupado' },
    { hora: '13:45', estado: 'disponible' },
  ],
}
