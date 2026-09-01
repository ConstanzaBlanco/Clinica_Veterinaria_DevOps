import { Link } from 'react-router-dom'
import Tarjeta from '../../../components/common/Tarjeta'
import Badge from '../../../components/common/Badge'
import Boton from '../../../components/common/Boton'

function MascotaCard({ mascota }) {
  return (
    <Tarjeta className="mascota-card">
      <div className="mascota-card-encabezado">
        <div className="mascota-foto">foto</div>
        <div className="mascota-card-titulo">
          <div className="mascota-nombre">{mascota.nombre}</div>
          <div className="mascota-especie">
            {mascota.especie} · {mascota.raza}
          </div>
        </div>
        <Badge variant={mascota.activa ? 'activa' : 'inactiva'}>
          {mascota.activa ? 'Activa' : 'Inactiva'}
        </Badge>
      </div>

      <div className="mascota-datos">
        <div>
          <div className="mascota-dato-valor">{mascota.edad}</div>
          Edad
        </div>
        <div>
          <div className="mascota-dato-valor">{mascota.ultimoPeso}</div>
          Último peso
        </div>
        <div>
          <div className="mascota-dato-valor">{mascota.proximoTurno}</div>
          Próximo turno
        </div>
        <div>
          <div className="mascota-dato-valor">{mascota.consultas} consultas</div>
          Historial
        </div>
      </div>

      <div className="mascota-acciones">
        <Boton as={Link} to={`/turnos/${mascota.id}/historial`} variant="secundario">
          Ver historial
        </Boton>
      </div>
    </Tarjeta>
  )
}

export default MascotaCard
