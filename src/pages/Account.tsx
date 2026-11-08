import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { GpsToggle } from '../components/GpsToggle'
import { Icon } from '../components/Icon'
import { RegisterModal, type AuthMode } from '../components/RegisterModal'
import { useToast } from '../components/Toast'
import { TopBar } from '../components/TopBar'
import { useCustomer } from '../context/Customer'
import { errKey, useI18n } from '../i18n/I18n'
import { api } from '../lib/api'
import { formatCOP } from '../lib/format'
import { mapsLink } from '../lib/geo'
import { onChanges } from '../lib/realtime'
import type { Coords, OrderSummary, Reservation } from '../lib/types'

const fmtDate = (iso: string, lang: string) =>
  new Date(iso).toLocaleString(lang, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function Account() {
  const { customer, token, ready, setCustomer, signOut, refresh } = useCustomer()
  const { t, lang } = useI18n()
  const toast = useToast()
  const [auth, setAuth] = useState<AuthMode | null>(null)
  const [orders, setOrders] = useState<OrderSummary[] | null>(null)
  const [reservations, setReservations] = useState<Reservation[] | null>(null)
  const [editing, setEditing] = useState(false)
  const prev = useRef<Map<string, string>>(new Map())

  const loadHistory = useCallback(async () => {
    if (!token) return
    try {
      const [o, r] = await Promise.all([api.myOrders(token), api.myReservations(token)])
      // Avisar cuando el restaurante cambia el estado de un pedido.
      for (const x of o) {
        const before = prev.current.get(x.id)
        if (before && x.status && before !== x.status) {
          toast(t('acc.statusChanged', { n: x.number, status: t(`status.${x.status}` as const) }))
        }
      }
      prev.current = new Map(o.map((x) => [x.id, x.status ?? '']))
      setOrders(o)
      setReservations(r)
    } catch { /* sin conexión: se reintenta en el siguiente ciclo */ }
  }, [token, t, toast])

  useEffect(() => {
    if (!token || !customer) return
    void loadHistory()
    const off = onChanges(`ambar-customer-${customer.id}`, () => void loadHistory())
    const id = window.setInterval(() => void loadHistory(), 30_000)
    return () => { off(); window.clearInterval(id) }
  }, [token, customer?.id, loadHistory]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void refresh() }, [refresh])

  if (!customer) {
    return (
      <>
        <TopBar title={t('acc.title')} />
        <div className="page" style={{ maxWidth: 560 }}>
          {ready ? (
            <motion.div className="empty" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Icon name="users" />
              <h2 style={{ fontSize: 20, color: 'var(--text)', marginBottom: 6 }}>{t('acc.guestTitle')}</h2>
              <p>{t('acc.guestText')}</p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 14 }}>
                <motion.button className="btn solid" whileTap={{ scale: 0.95 }} onClick={() => setAuth('register')}>
                  <Icon name="star" /> {t('auth.tabRegister')}
                </motion.button>
                <motion.button className="btn" whileTap={{ scale: 0.95 }} onClick={() => setAuth('login')}>
                  <Icon name="lock" /> {t('auth.tabLogin')}
                </motion.button>
              </div>
            </motion.div>
          ) : <div className="spinner" />}
        </div>
        <RegisterModal open={auth !== null} initialMode={auth ?? 'register'} onClose={() => setAuth(null)} onDone={() => setAuth(null)} />
      </>
    )
  }

  return (
    <>
      <TopBar title={t('acc.title')} />
      <div className="page" style={{ maxWidth: 560 }}>
        <div className="section-title" style={{ marginTop: 18 }}>
          <h2>{t('acc.hello', { name: customer.name.split(' ')[0] })}</h2>
          <button onClick={signOut}><Icon name="logout" style={{ width: 16, height: 16, verticalAlign: '-3px' }} /> {t('acc.logout')}</button>
        </div>

        {editing
          ? <ProfileForm onDone={(c) => { if (c) { setCustomer(c); toast(t('acc.saved')) } setEditing(false) }} />
          : (
            <div className="card profile-card">
              <div className="profile-row"><span>{t('reg.name')}</span><strong>{customer.name}</strong></div>
              <div className="profile-row"><span>{t('auth.email')}</span><strong dir="ltr">{customer.email || '—'}</strong></div>
              <div className="profile-row"><span>{t('reg.phone')}</span><strong dir="ltr">{customer.phone}</strong></div>
              <div className="profile-row"><span>{t('auth.birthday')}</span><strong>{customer.birthday || '—'}</strong></div>
              <div className="profile-row"><span>{t('reg.address')}</span><strong>{customer.address}</strong></div>
              <div className="profile-row">
                <span>{t('acc.location')}</span>
                {mapsLink(customer)
                  ? <a className="gold" href={mapsLink(customer)!} target="_blank" rel="noreferrer">📍 {customer.lat!.toFixed(4)}, {customer.lng!.toFixed(4)}</a>
                  : <strong className="muted">{t('acc.locationNone')}</strong>}
              </div>
              <button className="btn sm ghost" style={{ marginTop: 12 }} onClick={() => setEditing(true)}><Icon name="edit" /> {t('cart.edit')}</button>
            </div>
          )}

        <PinCard hasPin={customer.has_pin !== false} />

        <section className="section">
          <div className="section-title">
            <h2>{t('acc.orders')}</h2>
            <span className="muted live-dot" style={{ fontSize: 12 }}>{t('acc.live')}</span>
          </div>
          {!orders && <div className="spinner" />}
          {orders && orders.length === 0 && <p className="muted">{t('acc.noOrders')}</p>}
          <AnimatePresence initial={false}>
            {orders?.map((o) => (
              <motion.article key={o.id} layout className="card history" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <div className="history-head">
                  <strong>{t('acc.orderN', { n: o.number })}</strong>
                  <motion.span key={o.status} className={`pill-status s-${o.status}`} initial={{ scale: 0.6 }} animate={{ scale: 1 }}>
                    {t(`status.${o.status ?? 'nuevo'}` as const)}
                  </motion.span>
                </div>
                <small className="muted">{fmtDate(o.created_at, lang)}</small>
                <ul>{o.items.map((i, k) => <li key={k}>{i.qty}× {i.name}</li>)}</ul>
                <strong className="gold">{formatCOP(o.total)}</strong>
              </motion.article>
            ))}
          </AnimatePresence>
        </section>

        <section className="section">
          <div className="section-title">
            <h2>{t('acc.reservations')}</h2>
            <Link to="/reservar">{t('home.reserve')}</Link>
          </div>
          {reservations && reservations.length === 0 && <p className="muted">{t('acc.noReservations')}</p>}
          {reservations?.map((r) => (
            <article key={r.id} className="card history">
              <div className="history-head">
                <strong>{t('acc.reservationN', { n: r.number })}</strong>
                <span className={`pill-status r-${r.status}`}>{t(`rstatus.${r.status}` as const)}</span>
              </div>
              <small className="muted">{fmtDate(r.reserved_at, lang)} · {t('acc.peopleN', { n: r.people })}{r.babies ? ' · 👶' : ''}</small>
              {r.dishes.length > 0 && <ul>{r.dishes.map((d, k) => <li key={k}>{d.qty}× {d.name}</li>)}</ul>}
            </article>
          ))}
        </section>
      </div>
    </>
  )
}

function ProfileForm({ onDone }: { onDone: (c: import('../lib/types').Customer | null) => void }) {
  const { customer, token } = useCustomer()
  const { t } = useI18n()
  const [name, setName] = useState(customer?.name ?? '')
  const [email, setEmail] = useState(customer?.email ?? '')
  const [address, setAddress] = useState(customer?.address ?? '')
  const [birthday, setBirthday] = useState(customer?.birthday ?? '')
  const saved = customer?.lat != null && customer?.lng != null ? { lat: customer.lat, lng: customer.lng } : null
  const [coords, setCoords] = useState<Coords | null>(saved)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    setBusy(true)
    setError(null)
    const gps = coords
      ? (saved && coords.lat === saved.lat && coords.lng === saved.lng ? { mode: 'keep' as const } : { mode: 'set' as const, coords })
      : { mode: 'clear' as const }
    try {
      onDone(await api.updateProfile(token, { name, email, address, birthday: birthday || null }, gps))
    } catch (err) {
      setError(t(errKey(err)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card" style={{ padding: 16 }} onSubmit={save}>
      <div className="field"><label htmlFor="p-name">{t('reg.name')}</label>
        <input id="p-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></div>
      <div className="field"><label htmlFor="p-email">{t('auth.email')}</label>
        <input id="p-email" className="input" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} /></div>
      <div className="field"><label htmlFor="p-bday">{t('auth.birthday')}</label>
        <input id="p-bday" className="input" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} /></div>
      <div className="field"><label htmlFor="p-address">{t('reg.address')}</label>
        <input id="p-address" className="input" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} /></div>
      <GpsToggle value={coords} onChange={setCoords} label={t('acc.locationUpdate')} />
      {error && <p className="error" role="alert">{error}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button className="btn solid sm" disabled={busy}><Icon name="check" /> {t('acc.save')}</button>
        <button type="button" className="btn ghost sm" onClick={() => onDone(null)}>{t('acc.cancel')}</button>
      </div>
    </form>
  )
}

function PinCard({ hasPin }: { hasPin: boolean }) {
  const { token, setCustomer } = useCustomer()
  const { t } = useI18n()
  const toast = useToast()
  const [open, setOpen] = useState(!hasPin)
  const [oldPin, setOldPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const digits = (s: string) => s.replace(/\D/g, '').slice(0, 4)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    if (newPin.length !== 4) return setError(t('err.invalid_pin'))
    setBusy(true)
    setError(null)
    try {
      setCustomer(await api.setPin(token, oldPin, newPin))
      toast(t('acc.pinSaved'))
      setOpen(false)
      setOldPin('')
      setNewPin('')
    } catch (err) {
      setError(t(errKey(err)))
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return <button className="btn ghost sm" style={{ marginTop: 12 }} onClick={() => setOpen(true)}><Icon name="lock" /> {t('acc.pinTitle')}</button>
  }
  return (
    <form className="card" style={{ padding: 16, marginTop: 12 }} onSubmit={save}>
      <strong>{t('acc.pinTitle')}</strong>
      {!hasPin && <p className="muted" style={{ fontSize: 13 }}>{t('acc.pinCreate')}</p>}
      <div className="grid2" style={{ marginTop: 10 }}>
        {hasPin && (
          <div className="field"><label htmlFor="pin-old">{t('acc.pinOld')}</label>
            <input id="pin-old" className="input pin-input" type="password" inputMode="numeric" maxLength={4} dir="ltr" value={oldPin} onChange={(e) => setOldPin(digits(e.target.value))} /></div>
        )}
        <div className="field"><label htmlFor="pin-new">{t('acc.pinNew')}</label>
          <input id="pin-new" className="input pin-input" type="password" inputMode="numeric" maxLength={4} dir="ltr" value={newPin} onChange={(e) => setNewPin(digits(e.target.value))} /></div>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn solid sm" disabled={busy}><Icon name="check" /> {t('acc.pinSave')}</button>
        {hasPin && <button type="button" className="btn ghost sm" onClick={() => setOpen(false)}>{t('acc.cancel')}</button>}
      </div>
    </form>
  )
}
