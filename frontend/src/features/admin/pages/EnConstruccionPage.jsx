function EnConstruccionPage({ mensaje = 'Esta sección todavía no está implementada para el rol de Administrador.' }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '60vh',
      textAlign: 'center',
      padding: '2rem',
    }}>
      <h2>🚧 Próximamente</h2>
      <p>{mensaje}</p>
    </div>
  )
}

export default EnConstruccionPage