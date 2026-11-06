import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCustomer } from '../context/Customer'
import { errorMessage } from '../lib/api'
import type { Customer } from '../lib/types'
import { Icon } from './Icon'

export function RegisterModal({
  open, onClose, onDone, reason,
}: { open: boolean; onClose: () => void; onDone: (c: Customer) => void; reason?: string }) {
  const { register, customer } = useCustomer()
  const [name, setName] = useState(customer?.name ?? '')
  const [address, setAddress] = useState(customer?.address ?? '')
  const [phone, setPhone] = useState(customer?.phone ?? '')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const digits = phone.replace(/\D/g, '').replace(/^57(?=\d{10}$)/, '')
  const valid = name.trim().length >= 2 && address.trim().length >= 3 && digits.length === 10 && consent

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) {
      setError(!consent ? 'Debes autorizar el tratamiento de datos para continuar.' : digits.length !== 10 ? 'El teléfono debe tener 10 dígitos.' : 'Completa todos los campos.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const c = await register(name, address, digits, consent)
      onDone(c)
    } catch (err) {
      setError(errorMessage(err))
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
            onDragEnd={(_, info) => { if (info.offset.y > 120) onClose() }}
          >
            <div className="grab" />
            <h2>Regístrate</h2>
            <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
              {reason ?? 'Solo necesitamos tu nombre, dirección y teléfono para tomar tu pedido y crear tu Tarjeta Ámbar.'}
            </p>
            <div className="field">
              <label htmlFor="r-name">Nombre</label>
              <input id="r-name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </div>
            <div className="field">
              <label htmlFor="r-address">Dirección</label>
              <input id="r-address" className="input" autoComplete="street-address" placeholder="Hotel, habitación o dirección" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} />
            </div>
            <div className="field">
              <label htmlFor="r-phone">Teléfono (WhatsApp)</label>
              <input id="r-phone" className="input" type="tel" inputMode="numeric" autoComplete="tel" placeholder="300 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={16} />
            </div>
            <label className="check">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>
                Autorizo a Ámbar Steak House el tratamiento de mis datos personales para gestionar mis pedidos y el programa de fidelización, según la{' '}
                <Link to="/privacidad" target="_blank">política de tratamiento de datos</Link> (Ley 1581 de 2012).
              </span>
            </label>
            {error && <p className="error" role="alert">{error}</p>}
            <motion.button className="btn solid block" style={{ marginTop: 16 }} whileTap={{ scale: 0.96 }} disabled={busy} type="submit">
              <Icon name="check" /> {busy ? 'Guardando…' : 'Continuar'}
            </motion.button>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
