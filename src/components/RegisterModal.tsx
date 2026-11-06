import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCustomer } from '../context/Customer'
import { errKey, useI18n } from '../i18n/I18n'
import type { Customer } from '../lib/types'
import { Icon } from './Icon'

export function RegisterModal({
  open, onClose, onDone, reason,
}: { open: boolean; onClose: () => void; onDone: (c: Customer) => void; reason?: string }) {
  const { register, customer } = useCustomer()
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Al abrir, precargar los datos actuales del cliente (si los hay).
  useEffect(() => {
    if (!open) return
    setName(customer?.name ?? '')
    setAddress(customer?.address ?? '')
    setPhone(customer?.phone ?? '')
    setError(null)
  }, [open, customer])

  const digits = phone.replace(/\D/g, '').replace(/^57(?=\d{10}$)/, '')
  const valid = name.trim().length >= 2 && address.trim().length >= 3 && digits.length === 10 && consent

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) {
      setError(t(!consent ? 'err.consent_required' : digits.length !== 10 ? 'err.invalid_phone' : 'reg.errFields'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const c = await register(name, address, digits, consent)
      onDone(c)
    } catch (err) {
      setError(t(errKey(err)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.form
            className="sheet"
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            dragListener={false}
            onDragEnd={(_, info) => { if (info.offset.y > 120) onClose() }}
          >
            <div className="grab" />
            <h2>{t('reg.title')}</h2>
            <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>{reason ?? t('reg.defaultReason')}</p>
            <div className="field">
              <label htmlFor="r-name">{t('reg.name')}</label>
              <input id="r-name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </div>
            <div className="field">
              <label htmlFor="r-address">{t('reg.address')}</label>
              <input id="r-address" className="input" autoComplete="street-address" placeholder={t('reg.addressPlaceholder')} value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} />
            </div>
            <div className="field">
              <label htmlFor="r-phone">{t('reg.phone')}</label>
              <input id="r-phone" className="input" type="tel" inputMode="numeric" autoComplete="tel" dir="ltr" placeholder="300 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={16} />
            </div>
            <label className="check">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>
                {t('reg.consent')} <Link to="/privacidad" target="_blank">{t('reg.policyLink')}</Link> {t('reg.law')}
              </span>
            </label>
            {error && <p className="error" role="alert">{error}</p>}
            <motion.button className="btn solid block" style={{ marginTop: 16 }} whileTap={{ scale: 0.96 }} disabled={busy} type="submit">
              <Icon name="check" /> {busy ? t('reg.saving') : t('reg.continue')}
            </motion.button>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
