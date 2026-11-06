import { motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import { useI18n } from '../i18n/I18n'
import { mediaUrl } from '../lib/format'
import type { Customer } from '../lib/types'
import { Icon } from './Icon'

export function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, '')
  return d.length === 10 ? `${d.slice(0, 3)} ••• ${d.slice(6, 8)} ${d.slice(8)}` : d
}

/** Tarjeta de fidelización tipo tarjeta de crédito. Se puede arrastrar e inclinar; vuelve a su sitio al soltar. */
export function LoyaltyCard({ customer, goal }: { customer: Customer; goal: number }) {
  const { t } = useI18n()
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotateY = useSpring(useTransform(x, [-150, 150], [-18, 18]), { stiffness: 300, damping: 30 })
  const rotateX = useSpring(useTransform(y, [-150, 150], [14, -14]), { stiffness: 300, damping: 30 })
  const slots = Math.max(goal, customer.stars, 5)
  const shown = Math.min(slots, 12)

  return (
    <div style={{ perspective: 1000 }}>
      <motion.div
        className="loyalty"
        drag
        dragSnapToOrigin
        dragElastic={0.25}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 1 }}
        whileDrag={{ scale: 1.08 }}
        style={{ x, y, rotateX, rotateY }}
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 160, damping: 18 }}
        aria-label={t('card.aria', { name: customer.name, n: customer.stars })}
      >
        <div className="loyalty-shine" />
        <div className="loyalty-top">
          <img src={mediaUrl('logo.png')} alt="" className="loyalty-logo" />
          <div className="loyalty-brand">
            <span>{t('card.label')}</span>
            <strong>ÁMBAR</strong>
          </div>
        </div>
        <div className="loyalty-mid">
          <svg className="loyalty-chip" viewBox="0 0 48 36" aria-hidden="true">
            <rect x="1" y="1" width="46" height="34" rx="7" fill="url(#chipg)" stroke="#8a6a2a" />
            <path d="M1 12h14M1 24h14M33 12h14M33 24h14M15 1v34M33 1v34M15 18h18" stroke="#8a6a2a" fill="none" />
            <defs>
              <linearGradient id="chipg" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stopColor="#f3d27a" />
                <stop offset="1" stopColor="#b8862f" />
              </linearGradient>
            </defs>
          </svg>
          <Icon name="nfc" className="loyalty-nfc" />
        </div>
        <div className="loyalty-stars" aria-hidden="true">
          {Array.from({ length: shown }, (_, i) => (
            <motion.span
              key={i}
              className={i < customer.stars ? 'on' : ''}
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.3 + i * 0.06, type: 'spring', stiffness: 400, damping: 15 }}
            >
              <Icon name="star" filled />
            </motion.span>
          ))}
          {slots > shown && <span className="more">+{slots - shown}</span>}
        </div>
        <div className="loyalty-bottom">
          <div>
            <small>{t('card.holder')}</small>
            <strong>{customer.name.toUpperCase()}</strong>
          </div>
          <div style={{ textAlign: 'end' }}>
            <small>{t('card.phone')}</small>
            <strong dir="ltr">{maskPhone(customer.phone)}</strong>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
