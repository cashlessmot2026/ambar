import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { TopBar } from '../components/TopBar'
import { useAppData } from '../context/AppData'
import { useCustomer } from '../context/Customer'
import { errKey, useI18n } from '../i18n/I18n'
import { api } from '../lib/api'
import { fireworks } from '../lib/celebrate'
import { isOrderingEnabled } from '../lib/ordering'
import { writeDraft } from '../lib/reservationDraft'
import type { Reservation } from '../lib/types'
import { DEFAULT_WHATSAPP, reservationText, waUrl } from '../lib/whatsapp'

/** Fecha local de Colombia (YYYY-MM-DD) para el mínimo del selector. */
const bogotaToday = () => new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10)

export default function Reserve() {
  const { customer, token } = useCustomer()
  const { data } = useAppData()
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [people, setPeople] = useState(2)
  const [babies, setBabies] = useState<boolean | null>(null)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ r: Reservation; key: string; emailOk: boolean | null } | null>(null)

  // Si tiene sesión, precargar sus datos.
  useEffect(() => {
    if (!customer) return
    setName((v) => v || customer.name)
    setPhone((v) => v || customer.phone)
    setEmail((v) => v || customer.email || '')
  }, [customer])

  const digits = phone.replace(/\D/g, '').replace(/^57(?=\d{10}$)/, '')
  const whatsapp = data?.settings.contact.whatsapp ?? DEFAULT_WHATSAPP

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (name.trim().length < 2 || !email.trim() || !date || !time || !people || babies === null) return setError(t('res.required'))
    if (digits.length !== 10) return setError(t('err.invalid_phone'))
    setBusy(true)
    try {
      const { reservation, key } = await api.createReservation({
        name, phone: digits, email: email.trim(), reserved_at: `${date}T${time}:00-05:00`, people, babies, notes,
      }, token)
      setDone({ r: reservation, key, emailOk: null })
      fireworks(900)
      api.reservationReceivedEmail(reservation.id, key)
        .then(() => setDone((d) => (d ? { ...d, emailOk: true } : d)))
        .catch(() => setDone((d) => (d ? { ...d, emailOk: false } : d)))
    } catch (err) {
      setError(t(errKey(err)))
    } finally {
      setBusy(false)
    }
  }

  function chooseDishes() {
    if (!done) return
    writeDraft({ id: done.r.id, number: done.r.number, key: done.key, reserved_at: done.r.reserved_at, people: done.r.people })
    navigate('/menu')
  }

  if (done) {
    const when = new Date(done.r.reserved_at).toLocaleString(lang, {
      timeZone: 'America/Bogota', weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit',
    })
    return (
      <>
        <TopBar title={t('res.title')} />
        <div className="page" style={{ maxWidth: 560 }}>
          <motion.div style={{ textAlign: 'center', padding: '28px 0 8px' }} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <div style={{ fontSize: 56 }}>🍽️</div>
            <h1 style={{ fontSize: 24 }} className="upper">{t('res.doneTitle')}</h1>
            <p className="muted">{t('res.doneText', { n: done.r.number, people: done.r.people, when })}</p>
            {done.emailOk === false && <p className="muted" style={{ fontSize: 13 }}>{t('res.emailFailed')}</p>}
          </motion.div>

          {isOrderingEnabled(data?.settings) && (
            <motion.div className="card ask-dishes" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <h3>{t('res.askDishes')}</h3>
              <p className="muted" style={{ fontSize: 14 }}>{t('res.askDishesText')}</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <motion.button className="btn solid" whileTap={{ scale: 0.95 }} onClick={chooseDishes}>
                  <Icon name="menu" /> {t('res.dishesYes')}
                </motion.button>
                <a className="btn" href={waUrl(whatsapp, reservationText(done.r, lang))} target="_blank" rel="noreferrer">
                  {t('res.dishesNo')}
                </a>
              </div>
            </motion.div>
          )}

          <a className="btn solid block" style={{ marginTop: 16, height: 54 }} href={waUrl(whatsapp, reservationText(done.r, lang))} target="_blank" rel="noreferrer">
            <Icon name="whatsapp" /> {t('res.whatsapp')}
          </a>
        </div>
      </>
    )
  }

  return (
    <>
      <TopBar title={t('res.title')} />
      <div className="page" style={{ maxWidth: 560 }}>
        <h1 style={{ fontSize: 22, marginTop: 18 }}>{t('res.heading')}</h1>
        <p className="muted" style={{ marginTop: 4 }}>{t('res.text')}</p>
        <form className="card" style={{ padding: 16 }} onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="rs-name">{t('reg.name')} *</label>
            <input id="rs-name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </div>
          <div className="field">
            <label htmlFor="rs-phone">{t('reg.phone')} *</label>
            <input id="rs-phone" className="input" type="tel" inputMode="numeric" autoComplete="tel" dir="ltr" placeholder="300 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={16} />
          </div>
          <div className="field">
            <label htmlFor="rs-email">{t('auth.email')} *</label>
            <input id="rs-email" className="input" type="email" autoComplete="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} />
          </div>
          <div className="grid2">
            <div className="field">
              <label htmlFor="rs-date">{t('res.date')} *</label>
              <input id="rs-date" className="input" type="date" min={bogotaToday()} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="rs-time">{t('res.time')} *</label>
              <input id="rs-time" className="input" type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="rs-people">{t('res.people')} *</label>
            <div className="stepper">
              <button type="button" onClick={() => setPeople((n) => Math.max(1, n - 1))} aria-label="−"><Icon name="minus" /></button>
              <input id="rs-people" className="input" type="number" inputMode="numeric" min={1} max={50} value={people}
                onChange={(e) => setPeople(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} />
              <button type="button" onClick={() => setPeople((n) => Math.min(50, n + 1))} aria-label="+"><Icon name="plus" /></button>
            </div>
          </div>
          <fieldset className="field yesno">
            <legend>{t('res.babies')} *</legend>
            <div className="seg-pub">
              <button type="button" className={babies === true ? 'on' : ''} onClick={() => setBabies(true)}>👶 {t('res.yes')}</button>
              <button type="button" className={babies === false ? 'on' : ''} onClick={() => setBabies(false)}>{t('res.no')}</button>
            </div>
          </fieldset>
          <div className="field">
            <label htmlFor="rs-notes">{t('res.notes')}</label>
            <textarea id="rs-notes" className="input" placeholder={t('res.notesPh')} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
          </div>
          <AnimatePresence>{error && <motion.p className="error" role="alert" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{error}</motion.p>}</AnimatePresence>
          <motion.button className="btn solid block" style={{ height: 54 }} whileTap={{ scale: 0.96 }} disabled={busy}>
            <Icon name="check" /> {busy ? t('res.sending') : t('res.submit')}
          </motion.button>
        </form>
      </div>
    </>
  )
}
