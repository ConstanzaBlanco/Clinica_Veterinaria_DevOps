// Datos de ejemplo para maquetar el paso de horario. Sin endpoint de disponibilidad todavía.
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
