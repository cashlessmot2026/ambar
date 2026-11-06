import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { api, errorMessage } from '../lib/api'
import { formatCOP } from '../lib/format'
import type { AdminOrder } from '../lib/types'
import { useAdmin } from './useAdmin'

const STATUSES: AdminOrder['status'][] = ['nuevo', 'preparando', 'entregado', 'cancelado']
const LABEL: Record<AdminOrder['status'], string> = { nuevo: 'Nuevo', preparando: 'Preparando', entregado: 'Entregado', cancelado: 'Cancelado' }

const time = (iso: string) =>
  new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function Orders() {
  const { run } = useAdmin()
  const [orders, setOrders] = useState<AdminOrder[] | null>(null)
  const [filter, setFilter] = useState<'activos' | AdminOrder['status'] | 'todos'>('activos')
  const [error, setError] = useState<string | null>(null)
  const seen = useRef<Set<string> | null>(null)
  const [fresh, setFresh] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    try {
      const list = await run((t) => api.admin.orders(t, 200))
      if (seen.current) {
        const newIds = list.filter((o) => !seen.current!.has(o.id)).map((o) => o.id)
        if (newIds.length) setFresh((f) => new Set([...f, ...newIds]))
      }
      seen.current = new Set(list.map((o) => o.id))
      setOrders(list)
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [run])

  useEffect(() => {
    void load()
    const id = window.setInterval(() => void load(), 15_000)
    return () => window.clearInterval(id)
  }, [load])

  async function setStatus(o: AdminOrder, status: AdminOrder['status']) {
    setOrders((cur) => cur?.map((x) => (x.id === o.id ? { ...x, status } : x)) ?? null)
    setFresh((f) => { const n = new Set(f); n.delete(o.id); return n })
    try {
      await run((t) => api.admin.setOrderStatus(t, o.id, status))
    } catch (e) {
      setError(errorMessage(e))
      void load()
    }
  }

  const shown = (orders ?? []).filter((o) =>
    filter === 'todos' ? true : filter === 'activos' ? o.status === 'nuevo' || o.status === 'preparando' : o.status === filter,
  )
  const today = (orders ?? []).filter((o) => new Date(o.created_at).toDateString() === new Date().toDateString() && o.status !== 'cancelado')

  return (
    <>
      <div className="toolbar">
        <h1 className="grow" style={{ margin: 0 }}>Pedidos</h1>
        <span className="muted" style={{ fontSize: 13 }}>Hoy: {today.length} · {formatCOP(today.reduce((n, o) => n + o.total, 0))}</span>
        <button className="mini" onClick={() => void load()} aria-label="Actualizar"><Icon name="download" /></button>
      </div>
      <div className="seg" style={{ marginBottom: 14 }}>
        {(['activos', ...STATUSES, 'todos'] as const).map((s) => (
          <button key={s} className={filter === s ? 'on' : ''} onClick={() => setFilter(s)}>
            {s === 'activos' ? 'Activos' : s === 'todos' ? 'Todos' : LABEL[s]}
          </button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      {!orders && <div className="spinner" />}
      {orders && shown.length === 0 && <div className="empty"><Icon name="receipt" /><p>No hay pedidos aquí.</p></div>}
      <AnimatePresence initial={false}>
        {shown.map((o) => (
          <motion.article key={o.id} layout className={`card order${fresh.has(o.id) ? ' is-new' : ''}`} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="order-head">
              <div>
                <h3>#{o.number} · {o.customer.name}</h3>
                <small className="muted">{time(o.created_at)}</small>
              </div>
              <span className={`status ${o.status}`}>{LABEL[o.status]}</span>
            </div>
            <ul>
              {o.items.map((i, idx) => <li key={idx}>{i.qty}× {i.name} — {formatCOP(i.qty * i.price)}</li>)}
            </ul>
            {o.notes && <p style={{ margin: '0 0 8px', fontSize: 13 }}><strong>Notas:</strong> {o.notes}</p>}
            <p className="muted" style={{ margin: '0 0 10px', fontSize: 13 }}>
              📍 {o.customer.address} · 📞{' '}
              <a className="gold" href={`https://api.whatsapp.com/send?phone=57${o.customer.phone}`} target="_blank" rel="noreferrer">{o.customer.phone}</a>
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
              <strong className="gold" style={{ fontSize: 18, fontFamily: 'var(--font-heading)' }}>{formatCOP(o.total)}</strong>
              <div className="seg">
                {STATUSES.map((s) => (
                  <button key={s} className={o.status === s ? 'on' : ''} onClick={() => void setStatus(o, s)}>{LABEL[s]}</button>
                ))}
              </div>
            </div>
          </motion.article>
        ))}
      </AnimatePresence>
    </>
  )
}
