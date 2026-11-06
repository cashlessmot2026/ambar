import { motion } from 'motion/react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { TopBar } from '../components/TopBar'
import { useAppData } from '../context/AppData'
import { fireworks } from '../lib/celebrate'
import { formatCOP } from '../lib/format'
import type { OrderSummary } from '../lib/types'
import { LAST_ORDER_KEY } from './Cart'

function readLast(): { order: OrderSummary; url: string } | null {
  try {
    const raw = sessionStorage.getItem(LAST_ORDER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export default function Thanks() {
  const { data } = useAppData()
  const last = readLast()
  useEffect(() => { if (last) fireworks(1200) }, [])

  const contact = data?.settings.contact
  return (
    <>
      <TopBar />
      <div className="page" style={{ maxWidth: 560 }}>
        <motion.div
          style={{ textAlign: 'center', padding: '28px 0 8px' }}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        >
          <div style={{ fontSize: 56 }}>🥩</div>
          <h1 style={{ fontSize: 24, textTransform: 'uppercase' }}>¡Pedido recibido!</h1>
          {last && (
            <p className="muted">
              Pedido <strong className="gold">#{last.order.number}</strong> por <strong className="gold">{formatCOP(last.order.total)}</strong>.
              <br />Si WhatsApp no se abrió, envíalo con el botón.
            </p>
          )}
        </motion.div>

        {last && (
          <motion.a className="btn solid block" style={{ height: 54 }} href={last.url} target="_blank" rel="noreferrer" whileTap={{ scale: 0.96 }}>
            <Icon name="whatsapp" /> Enviar por WhatsApp
          </motion.a>
        )}

        <section className="section">
          <div className="section-title"><h2>¿Cómo te fue?</h2></div>
          <p className="muted" style={{ marginTop: -6, fontSize: 14 }}>Tu reseña nos ayuda muchísimo. ¡Gracias por elegirnos!</p>
          <div className="review-btns">
            <motion.a className="review-btn" href={contact?.google_review_url} target="_blank" rel="noreferrer" whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
              <span className="logo"><GoogleLogo /></span>
              <span style={{ flex: 1 }}>
                <strong>Reseña en Google</strong>
                <span className="muted" style={{ fontSize: 13 }}>Califícanos con ⭐⭐⭐⭐⭐</span>
              </span>
              <Icon name="arrowRight" style={{ width: 20, color: 'var(--gold)' }} />
            </motion.a>
            <motion.a className="review-btn" href={contact?.tripadvisor_url} target="_blank" rel="noreferrer" whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.32 }}>
              <span className="logo" style={{ background: '#34E0A1', color: '#000' }}><Icon name="owl" /></span>
              <span style={{ flex: 1 }}>
                <strong>Reseña en Tripadvisor</strong>
                <span className="muted" style={{ fontSize: 13 }}>Cuéntale al mundo tu experiencia</span>
              </span>
              <Icon name="arrowRight" style={{ width: 20, color: 'var(--gold)' }} />
            </motion.a>
            <motion.a className="review-btn" href={contact?.instagram_url} target="_blank" rel="noreferrer" whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.44 }}>
              <span className="logo" style={{ background: 'linear-gradient(45deg,#f9ce34,#ee2a7b,#6228d7)', color: '#fff' }}><Icon name="instagram" /></span>
              <span style={{ flex: 1 }}>
                <strong>Síguenos en Instagram</strong>
                <span className="muted" style={{ fontSize: 13 }}>Etiquétanos en tus fotos</span>
              </span>
              <Icon name="arrowRight" style={{ width: 20, color: 'var(--gold)' }} />
            </motion.a>
          </div>
        </section>

        <Link to="/tarjeta" className="btn block" style={{ marginTop: 22 }}><Icon name="star" /> Ver mi Tarjeta Ámbar</Link>
      </div>
    </>
  )
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.5z" />
      <path fill="#34A853" d="M12 23.5c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3A11.5 11.5 0 0 0 12 23.5z" />
      <path fill="#FBBC05" d="M5.6 14.2a6.9 6.9 0 0 1 0-4.4v-3H1.8a11.5 11.5 0 0 0 0 10.4z" />
      <path fill="#EA4335" d="M12 5c1.7 0 3.2.6 4.4 1.7l3.3-3.3A11.5 11.5 0 0 0 1.8 6.8l3.8 3C6.5 7 9 5 12 5z" />
    </svg>
  )
}
