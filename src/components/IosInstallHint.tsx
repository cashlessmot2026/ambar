import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/I18n'
import { mediaUrl } from '../lib/format'
import { Icon } from './Icon'

const KEY = 'ambar:ios-hint-dismissed'
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000

/** iPhone/iPad (incluye iPadOS que se presenta como Mac con pantalla táctil). */
export function isIos(ua: string, maxTouchPoints: number): boolean {
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)
}

function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

/** Safari en iOS no muestra botón de instalar: explicamos "Compartir → Agregar a inicio". */
export function IosInstallHint() {
  const { t } = useI18n()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!isIos(navigator.userAgent, navigator.maxTouchPoints ?? 0) || isStandalone()) return
    let dismissed = 0
    try { dismissed = Number(localStorage.getItem(KEY) ?? 0) } catch { /* sin almacenamiento */ }
    if (Date.now() - dismissed < SNOOZE_MS) return
    const timer = window.setTimeout(() => setShow(true), 2500)
    return () => window.clearTimeout(timer)
  }, [])

  const close = () => {
    setShow(false)
    try { localStorage.setItem(KEY, String(Date.now())) } catch { /* sin almacenamiento */ }
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="ios-hint"
          role="dialog"
          aria-label={t('install.iosTitle')}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        >
          <img src={mediaUrl('icons/apple-touch-icon.png')} alt="" />
          <div style={{ flex: 1 }}>
            <strong>{t('install.iosTitle')}</strong>
            <p><Icon name="share" /> {t('install.iosText')}</p>
          </div>
          <button className="x" onClick={close} aria-label={t('common.close')}><Icon name="x" /></button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
