import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppData } from '../context/AppData'
import { useCustomer } from '../context/Customer'
import { errKey, useI18n } from '../i18n/I18n'
import type { Coords, Customer } from '../lib/types'
import { DEFAULT_WHATSAPP } from '../lib/whatsapp'
import { GpsToggle } from './GpsToggle'
import { Icon } from './Icon'

export type AuthMode = 'register' | 'login'

const onlyDigits = (s: string, max: number) => s.replace(/\D/g, '').slice(0, max)
const today = () => new Date().toISOString().slice(0, 10)

/** Crear cuenta o iniciar sesión (correo/teléfono + PIN de 4 dígitos). La sesión queda guardada en el dispositivo. */
export function RegisterModal({
  open, onClose, onDone, reason, initialMode = 'register',
}: { open: boolean; onClose: () => void; onDone: (c: Customer) => void; reason?: string; initialMode?: AuthMode }) {
  const { signUp, signIn } = useCustomer()
  const { data } = useAppData()
  const { t } = useI18n()
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [birthday, setBirthday] = useState('')
  const [address, setAddress] = useState('')
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [coords, setCoords] = useState<Coords | null>(null)
  const [consent, setConsent] = useState(false)
  const [login, setLogin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setMode(initialMode)
    setError(null)
    setPin('')
    setPin2('')
  }, [open, initialMode])

  const digits = phone.replace(/\D/g, '').replace(/^57(?=\d{10}$)/, '')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (mode === 'login') {
      if (!login.trim() || pin.length !== 4) return setError(t(pin.length !== 4 ? 'err.invalid_pin' : 'reg.errFields'))
    } else {
      if (name.trim().length < 2 || address.trim().length < 3 || !email.trim() || !birthday) return setError(t('reg.errFields'))
      if (digits.length !== 10) return setError(t('err.invalid_phone'))
      if (pin.length !== 4) return setError(t('err.invalid_pin'))
      if (pin !== pin2) return setError(t('auth.pinMismatch'))
      if (!consent) return setError(t('err.consent_required'))
    }
    setBusy(true)
    try {
      const c = mode === 'login'
        ? await signIn(login.trim(), pin)
        : await signUp({ name, email: email.trim(), phone: digits, birthday, address, pin, consent, coords })
      onDone(c)
    } catch (err) {
      setError(t(errKey(err)))
      setPin('')
      setPin2('')
    } finally {
      setBusy(false)
    }
  }

  const pinInput = (id: string, label: string, value: string, set: (v: string) => void) => (
    <div className="field">
      <label htmlFor={id}>{label} *</label>
      <input
        id={id} className="input pin-input" type="password" inputMode="numeric" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        pattern="\d{4}" maxLength={4} dir="ltr" placeholder="••••" value={value} onChange={(e) => set(onlyDigits(e.target.value, 4))}
      />
    </div>
  )

  const wa = (data?.settings.contact.whatsapp ?? DEFAULT_WHATSAPP).replace(/\D/g, '')

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.form
            className="sheet auth-sheet"
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            noValidate
          >
            <div className="grab" />
            <div className="auth-tabs" role="tablist">
              {(['register', 'login'] as const).map((m) => (
                <button key={m} type="button" role="tab" aria-selected={mode === m} className={mode === m ? 'on' : ''} onClick={() => { setMode(m); setError(null) }}>
                  {t(m === 'register' ? 'auth.tabRegister' : 'auth.tabLogin')}
                </button>
              ))}
            </div>
            <h2>{t(mode === 'register' ? 'auth.registerTitle' : 'auth.loginTitle')}</h2>
            <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
              {reason ?? t(mode === 'register' ? 'auth.registerText' : 'auth.loginText')}
            </p>

            {mode === 'login' ? (
              <>
                <div className="field">
                  <label htmlFor="a-login">{t('auth.login')} *</label>
                  <input id="a-login" className="input" autoComplete="username" dir="ltr" value={login} onChange={(e) => setLogin(e.target.value)} maxLength={120} />
                </div>
                {pinInput('a-pin', t('auth.pin'), pin, setPin)}
                <a className="muted" style={{ fontSize: 12 }} href={`https://api.whatsapp.com/send?phone=${wa}`} target="_blank" rel="noreferrer">{t('auth.forgot')}</a>
              </>
            ) : (
              <>
                <div className="field">
                  <label htmlFor="r-name">{t('reg.name')} *</label>
                  <input id="r-name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
                </div>
                <div className="field">
                  <label htmlFor="r-email">{t('auth.email')} *</label>
                  <input id="r-email" className="input" type="email" autoComplete="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} />
                </div>
                <div className="field">
                  <label htmlFor="r-phone">{t('reg.phone')} *</label>
                  <input id="r-phone" className="input" type="tel" inputMode="numeric" autoComplete="tel" dir="ltr" placeholder="300 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={16} />
                </div>
                <div className="field">
                  <label htmlFor="r-bday">{t('auth.birthday')} *</label>
                  <input id="r-bday" className="input" type="date" autoComplete="bday" max={today()} min="1900-01-01" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="r-address">{t('reg.address')} *</label>
                  <input id="r-address" className="input" autoComplete="street-address" placeholder={t('reg.addressPlaceholder')} value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} />
                </div>
                <div className="grid2">
                  {pinInput('r-pin', t('auth.pin'), pin, setPin)}
                  {pinInput('r-pin2', t('auth.pinConfirm'), pin2, setPin2)}
                </div>
                <GpsToggle value={coords} onChange={setCoords} />
                <label className="check" style={{ marginTop: 12 }}>
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                  <span>
                    {t('reg.consent')} <Link to="/privacidad" target="_blank">{t('reg.policyLink')}</Link> {t('reg.law')}
                  </span>
                </label>
              </>
            )}

            {error && <p className="error" role="alert">{error}</p>}
            <motion.button className="btn solid block" style={{ marginTop: 16 }} whileTap={{ scale: 0.96 }} disabled={busy} type="submit">
              <Icon name={mode === 'login' ? 'lock' : 'check'} /> {busy ? t('reg.saving') : t(mode === 'login' ? 'auth.loginBtn' : 'auth.registerBtn')}
            </motion.button>
            <button type="button" className="auth-switch" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null) }}>
              {t(mode === 'login' ? 'auth.noAccount' : 'auth.haveAccount')}
            </button>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
