import { motion } from 'motion/react'
import { useI18n } from '../i18n/I18n'
import type { Settings } from '../lib/types'
import { Icon } from './Icon'

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

/** Botones a Google y Tripadvisor; se muestran solo los que tienen enlace configurado. */
export function ReviewButtons({ contact }: { contact: Settings['contact'] | undefined }) {
  const { t } = useI18n()
  const items = [
    { href: contact?.google_review_url, title: t('thanks.google'), sub: t('thanks.googleSub'), logo: <GoogleLogo />, style: undefined },
    { href: contact?.tripadvisor_url, title: t('thanks.trip'), sub: t('thanks.tripSub'), logo: <Icon name="owl" />, style: { background: '#34E0A1', color: '#000' } },
  ].filter((r) => r.href)

  return (
    <div className="review-btns">
      {items.map((r, i) => (
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
  )
}
