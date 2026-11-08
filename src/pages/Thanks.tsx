import { motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { TopBar } from '../components/TopBar'
import { useAppData } from '../context/AppData'
import { useI18n } from '../i18n/I18n'
import { fireworks } from '../lib/celebrate'
import { formatCOP } from '../lib/format'
import { renderTicket } from '../lib/ticket'
import type { Customer, OrderSummary } from '../lib/types'
import { orderText } from '../lib/whatsapp'
import { LAST_ORDER_KEY } from './Cart'

function readLast(): { order: OrderSummary; url: string; customer?: Customer } | null {
  try {
    const raw = sessionStorage.getItem(LAST_ORDER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/** Imagen PNG del ticket con botones para descargarla o compartirla (WhatsApp, etc.). */
function Ticket({ order, customer }: { order: OrderSummary; customer: Customer }) {
  const { t, lang } = useI18n()
  const [blob, setBlob] = useState<Blob | null>(null)
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob])
  useEffect(() => { void renderTicket(order, customer).then(setBlob).catch(() => {}) }, [order, customer])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  if (!blob || !url) return null
  const file = new File([blob], `ambar-pedido-${order.number}.png`, { type: 'image/png' })
  const canShare = typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [file] })
  return (
    <section className="section">
      <div className="section-title"><h2>{t('thanks.ticket')}</h2></div>
      <motion.img className="ticket-img" src={url} alt={t('thanks.ticket')} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} />
      <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
        <a className="btn" href={url} download={file.name}><Icon name="download" /> {t('thanks.download')}</a>
        {canShare && (
          <button className="btn" onClick={() => void navigator.share({ files: [file], text: orderText(order, customer, lang) }).catch(() => {})}>
            <Icon name="share" /> {t('thanks.share')}
          </button>
        )}
      </div>
      <p className="muted" style={{ fontSize: 12 }}>{t('thanks.shareHint')}</p>
    </section>
  )
}

export default function Thanks() {
  const { data } = useAppData()
  const { t } = useI18n()
  const [last] = useState(readLast)
  useEffect(() => { if (last) fireworks(1200) }, [last])

  const contact = data?.settings.contact
  const reviews = [
    { href: contact?.google_review_url, title: t('thanks.google'), sub: t('thanks.googleSub'), logo: <GoogleLogo />, style: undefined },
    { href: contact?.tripadvisor_url, title: t('thanks.trip'), sub: t('thanks.tripSub'), logo: <Icon name="owl" />, style: { background: '#34E0A1', color: '#000' } },
    { href: contact?.instagram_url, title: t('thanks.ig'), sub: t('thanks.igSub'), logo: <Icon name="instagram" />, style: { background: 'linear-gradient(45deg,#f9ce34,#ee2a7b,#6228d7)', color: '#fff' } },
  ]
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
          <h1 style={{ fontSize: 24 }} className="upper">{t('thanks.title')}</h1>
          {last && (
            <p className="muted">
              <strong className="gold">{t('thanks.summary', { n: last.order.number, total: formatCOP(last.order.total) })}</strong>
              <br />{t('thanks.noWhatsapp')}
            </p>
          )}
          {last?.order.star_awarded && (
            <motion.p
              className="star-earned"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5, type: 'spring', stiffness: 300, damping: 15 }}
            >
              ⭐ {t('thanks.star', { n: last.order.stars ?? 1 })}
            </motion.p>
          )}
        </motion.div>

        {last && (
          <motion.a className="btn solid block" style={{ height: 54 }} href={last.url} target="_blank" rel="noreferrer" whileTap={{ scale: 0.96 }}>
            <Icon name="whatsapp" /> {t('thanks.sendWhatsapp')}
          </motion.a>
        )}
        {last?.customer && <Ticket order={last.order} customer={last.customer} />}
        {last?.customer && (
          <Link to="/cuenta" className="btn block" style={{ marginTop: 14 }}><Icon name="receipt" /> {t('thanks.track')}</Link>
        )}

        <section className="section">
          <div className="section-title"><h2>{t('thanks.howWasIt')}</h2></div>
          <p className="muted" style={{ marginTop: -6, fontSize: 14 }}>{t('thanks.reviewHelp')}</p>
          <div className="review-btns">
            {reviews.map((r, i) => (
              <motion.a
                key={r.title}
                className="review-btn"
                href={r.href}
                target="_blank"
                rel="noreferrer"
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.97 }}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.12 }}
              >
                <span className="logo" style={r.style}>{r.logo}</span>
                <span style={{ flex: 1 }}>
                  <strong>{r.title}</strong>
                  <span className="muted" style={{ fontSize: 13 }}>{r.sub}</span>
                </span>
                <Icon name="arrowRight" className="flip-rtl" style={{ width: 20, color: 'var(--gold)' }} />
              </motion.a>
            ))}
          </div>
        </section>

        <Link to="/tarjeta" className="btn block" style={{ marginTop: 22 }}><Icon name="star" /> {t('thanks.viewCard')}</Link>
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
