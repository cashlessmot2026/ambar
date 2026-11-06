import { TopBar } from '../components/TopBar'
import { useAppData } from '../context/AppData'

export default function Privacy() {
  const { data } = useAppData()
  const phone = data?.settings.contact.whatsapp ?? '573229089680'
  const pretty = `+${phone.slice(0, 2)} ${phone.slice(2, 5)} ${phone.slice(5)}`
  return (
    <>
      <TopBar />
      <article className="page prose" style={{ maxWidth: 720 }}>
        <h1>Política de tratamiento de datos personales</h1>
        <p>
          En cumplimiento de la Ley 1581 de 2012 y el Decreto 1377 de 2013, <strong>Ámbar Steak House</strong> (Punta Hansa, frente al hotel
          Arena Blanca, San Andrés Isla), como responsable del tratamiento, informa cómo recolecta, usa y protege tus datos.
        </p>
        <h2>Datos que recolectamos</h2>
        <p>Nombre, dirección y número de teléfono, además del historial de pedidos y de visitas (estrellas) de tu Tarjeta Ámbar.</p>
        <h2>Finalidades</h2>
        <ul>
          <li>Recibir, preparar y entregar tus pedidos y contactarte sobre ellos por WhatsApp o llamada.</li>
          <li>Administrar el programa de fidelización: registrar visitas, estrellas y premios.</li>
          <li>Enviarte información sobre tus pedidos y beneficios del programa.</li>
        </ul>
        <h2>Tus derechos</h2>
        <p>
          Como titular puedes conocer, actualizar, rectificar y suprimir tus datos, revocar la autorización otorgada, solicitar prueba de
          ella y presentar quejas ante la Superintendencia de Industria y Comercio.
        </p>
        <h2>Cómo ejercerlos</h2>
        <p>
          Escríbenos por WhatsApp al <a className="gold" href={`https://wa.me/${phone}`}>{pretty}</a> indicando tu nombre, teléfono registrado
          y tu solicitud. Responderemos consultas en máximo 10 días hábiles y reclamos en máximo 15 días hábiles.
        </p>
        <h2>Seguridad y conservación</h2>
        <p>
          Tus datos se almacenan en servidores con acceso restringido y no se venden ni se comparten con terceros, salvo obligación legal. Se
          conservan mientras participes en el programa o hasta que solicites su supresión.
        </p>
        <p className="muted">Versión v1 · noviembre de 2026.</p>
      </article>
    </>
  )
}
