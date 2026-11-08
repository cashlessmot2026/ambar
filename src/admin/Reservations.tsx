import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { Icon } from '../components/Icon'
import { api, errorMessage } from '../lib/api'
import { formatCOP } from '../lib/format'
import { RESERVATION_STATUSES, type Reservation, type ReservationStatus } from '../lib/types'
import { reservationText, waUrl } from '../lib/whatsapp'
import { ConfirmButton } from './ConfirmButton'
import { useAdmin } from './useAdmin'
import { useLive } from './useLive'

const LABEL: Record<ReservationStatus, string> = {
  pendiente: 'Pendiente', confirmada: 'Confirmada', rechazada: 'Rechazada', cancelada: 'Cancelada', completada: 'Completada',
}
const TZ = 'America/Bogota'
const when = (iso: string) =>
  new Date(iso).toLocaleString('es-CO', { timeZone: TZ, weekday: 'short', day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' })
const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ })
/** "YYYY-MM-DDTHH:MM" en hora de Colombia, para <input type="datetime-local">. */
const toLocalInput = (iso: string) => {
  const d = new Date(new Date(iso).getTime() - 5 * 3600_000)
  return d.toISOString().slice(0, 16)
}

type Filter = 'proximas' | 'hoy' | ReservationStatus | 'todas'

export default function Reservations() {
  const { run } = useAdmin()
  const live = useLive()
  const [filter, setFilter] = useState<Filter>('proximas')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const list = live.reservations

  async function update(r: Reservation, row: Partial<Reservation>) {
    const updated = await run((t) => api.admin.updateReservation(t, r.id, row))
    live.setReservations((cur) => cur.map((x) => (x.id === r.id ? updated : x)))
    live.seen('reservation', r.id)
    return updated
  }

  async function setStatus(r: Reservation, status: ReservationStatus) {
    if (status === r.status) return
    setBusy(r.id)
    setError(null)
    setInfo(null)
    try {
      const updated = await update(r, { status })
      // Al aceptar se envía automáticamente el correo de confirmación al cliente.
      if (status === 'confirmada') await sendConfirmation(updated)
    } catch (e) {
      setError(errorMessage(e))
      void live.reload()
    } finally {
      setBusy(null)
    }
  }

  async function sendConfirmation(r: Reservation) {
    try {
      await run((t) => api.admin.reservationConfirmedEmail(t, r.id))
      setInfo(`Reserva #${r.number} confirmada y correo enviado a ${r.email}.`)
      live.setReservations((cur) => cur.map((x) => (x.id === r.id ? { ...x, email_confirmed_at: new Date().toISOString() } : x)))
    } catch (e) {
      setError(`Reserva #${r.number} confirmada, pero el correo falló: ${errorMessage(e)}`)
    }
  }

  async function remove(r: Reservation) {
    live.setReservations((cur) => cur.filter((x) => x.id !== r.id))
    try {
      await run((t) => api.admin.deleteReservation(t, r.id))
    } catch (e) {
      setError(errorMessage(e))
      void live.reload()
    }
  }

  const now = Date.now()
  const today = dayKey(new Date().toISOString())
  const shown = (list ?? [])
    .filter((r) =>
      filter === 'todas' ? true
        : filter === 'proximas' ? new Date(r.reserved_at).getTime() > now - 3 * 3600_000 && (r.status === 'pendiente' || r.status === 'confirmada')
        : filter === 'hoy' ? dayKey(r.reserved_at) === today
        : r.status === filter)
    .sort((a, b) => (filter === 'proximas' || filter === 'hoy' ? a.reserved_at.localeCompare(b.reserved_at) : b.reserved_at.localeCompare(a.reserved_at)))
  const pending = (list ?? []).filter((r) => r.status === 'pendiente').length
  const todayPeople = (list ?? []).filter((r) => dayKey(r.reserved_at) === today && r.status === 'confirmada').reduce((n, r) => n + r.people, 0)

  return (
    <>
      <div className="toolbar">
        <h1 className="grow" style={{ margin: 0 }}>Reservas <span className="live-badge">EN VIVO</span></h1>
        <span className="muted" style={{ fontSize: 13 }}>Pendientes: {pending} · Hoy confirmadas: {todayPeople} personas</span>
        <button className="mini" onClick={() => void live.reload()} aria-label="Actualizar"><Icon name="download" /></button>
      </div>
      <div className="seg" style={{ marginBottom: 14 }}>
        {(['proximas', 'hoy', ...RESERVATION_STATUSES, 'todas'] as const).map((s) => (
          <button key={s} className={filter === s ? 'on' : ''} onClick={() => setFilter(s)}>
            {s === 'proximas' ? 'Próximas' : s === 'hoy' ? 'Hoy' : s === 'todas' ? 'Todas' : LABEL[s]}
          </button>
        ))}
      </div>
      {info && <p className="saved">{info}</p>}
      {(error || live.error) && <p className="error">{error || live.error}</p>}
      {!list && <div className="spinner" />}
      {list && shown.length === 0 && <div className="empty"><Icon name="calendar" /><p>No hay reservas aquí.</p></div>}
      <AnimatePresence initial={false}>
        {shown.map((r) => (
          <motion.article
            key={r.id} layout
            className={`card order${live.freshReservations.has(r.id) ? ' is-new' : ''}`}
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
            onClick={() => live.seen('reservation', r.id)}
          >
            <div className="order-head">
              <div>
                <h3>#{r.number} · {r.name}</h3>
                <small className="gold" style={{ fontWeight: 700 }}>📅 {when(r.reserved_at)} · 👥 {r.people}{r.babies ? ' · 👶 con bebés' : ''}</small>
              </div>
              <span className={`status r-${r.status}`}>{LABEL[r.status]}</span>
            </div>

            {editing === r.id
              ? <ReservationEditor r={r} onClose={() => setEditing(null)} onSave={async (row) => {
                  try { await update(r, row); setEditing(null) } catch (e) { setError(errorMessage(e)) }
                }} />
              : (
                <>
                  <p className="muted" style={{ margin: '8px 0', fontSize: 13 }}>
                    📞 <a className="gold" href={`https://api.whatsapp.com/send?phone=57${r.phone}`} target="_blank" rel="noreferrer">{r.phone}</a>
                    {' '}· ✉️ <a className="gold" href={`mailto:${r.email}`}>{r.email}</a>
                  </p>
                  {r.notes && <p style={{ margin: '0 0 8px', fontSize: 13 }}><strong>Notas:</strong> {r.notes}</p>}
                  {r.dishes.length > 0 && (
                    <>
                      <ul>{r.dishes.map((d, k) => <li key={k}>{d.qty}× {d.name} — {formatCOP(d.qty * d.price)}</li>)}</ul>
                      <p style={{ margin: '0 0 8px', fontSize: 13 }}><strong>Platos pre-ordenados:</strong> {formatCOP(r.dishes_total)}</p>
                    </>
                  )}
                  <small className="muted" style={{ display: 'block', marginBottom: 10 }}>
                    Recibida {when(r.created_at)}
                    {r.email_received_at ? ' · ✉️ correo de recibido enviado' : ''}
                    {r.email_confirmed_at ? ' · ✅ correo de confirmación enviado' : ''}
                  </small>
                </>
              )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              {r.status === 'pendiente' && (
                <>
                  <button className="btn solid sm" disabled={busy === r.id} onClick={() => void setStatus(r, 'confirmada')}>
                    <Icon name="check" /> {busy === r.id ? 'Enviando…' : 'Aceptar y enviar correo'}
                  </button>
                  <button className="btn ghost sm" disabled={busy === r.id} onClick={() => void setStatus(r, 'rechazada')}>Rechazar</button>
                </>
              )}
              {r.status === 'confirmada' && (
                <>
                  <button className="btn ghost sm" disabled={busy === r.id} onClick={() => void setStatus(r, 'completada')}>Marcar completada</button>
                  <button className="btn ghost sm" disabled={busy === r.id} onClick={() => { setBusy(r.id); void sendConfirmation(r).finally(() => setBusy(null)) }}>
                    Reenviar correo
                  </button>
                </>
              )}
              <a className="btn ghost sm" href={waUrl(`57${r.phone}`, `Hola ${r.name}, te escribimos de Ámbar sobre tu reserva #${r.number}.`)} target="_blank" rel="noreferrer">
                <Icon name="whatsapp" /> Cliente
              </a>
              <span className="grow" />
              {editing !== r.id && <button className="mini" onClick={() => setEditing(r.id)} aria-label="Editar reserva"><Icon name="edit" /></button>}
              <button className="mini" onClick={() => void navigator.clipboard?.writeText(reservationText(r))} aria-label="Copiar texto de la reserva"><Icon name="receipt" /></button>
              <ConfirmButton label="Eliminar reserva" onConfirm={() => void remove(r)} />
            </div>
            <div className="seg" style={{ marginTop: 10 }}>
              {RESERVATION_STATUSES.map((s) => (
                <button key={s} className={r.status === s ? 'on' : ''} disabled={busy === r.id} onClick={() => void setStatus(r, s)}>{LABEL[s]}</button>
              ))}
            </div>
          </motion.article>
        ))}
      </AnimatePresence>
    </>
  )
}

function ReservationEditor({ r, onClose, onSave }: { r: Reservation; onClose: () => void; onSave: (row: Partial<Reservation>) => Promise<void> }) {
  const [name, setName] = useState(r.name)
  const [phone, setPhone] = useState(r.phone)
  const [email, setEmail] = useState(r.email)
  const [at, setAt] = useState(toLocalInput(r.reserved_at))
  const [people, setPeople] = useState(r.people)
  const [babies, setBabies] = useState(r.babies)
  const [notes, setNotes] = useState(r.notes ?? '')
  const [busy, setBusy] = useState(false)
  return (
    <form
      className="order-editor"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        await onSave({ name, phone, email, reserved_at: `${at}:00-05:00`, people, babies, notes })
        setBusy(false)
      }}
    >
      <div className="form-grid">
        <div className="field"><label>Nombre</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field"><label>Teléfono</label><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        <div className="field"><label>Correo</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="field"><label>Fecha y hora</label><input className="input" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} /></div>
        <div className="field"><label>Personas</label><input className="input" type="number" min={1} max={50} value={people} onChange={(e) => setPeople(Number(e.target.value) || 1)} /></div>
        <label className="switch" style={{ alignSelf: 'center' }}><input type="checkbox" checked={babies} onChange={(e) => setBabies(e.target.checked)} /> Con bebés</label>
      </div>
      <div className="field"><label>Notas</label><textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn solid sm" disabled={busy}><Icon name="check" /> Guardar</button>
        <button type="button" className="btn ghost sm" onClick={onClose}>Cancelar</button>
      </div>
    </form>
  )
}
