import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { useAppData } from '../context/AppData'
import { api, errorMessage } from '../lib/api'
import { formatCOP } from '../lib/format'
import { mapsLink } from '../lib/geo'
import { isOrderingEnabled } from '../lib/ordering'
import { ORDER_STATUSES, type AdminOrder, type OrderLine, type OrderStatus, type Product } from '../lib/types'
import { ConfirmButton } from './ConfirmButton'
import { useAdmin } from './useAdmin'
import { useLive } from './useLive'

export const ORDER_LABEL: Record<OrderStatus, string> = {
  nuevo: 'Nuevo', preparando: 'Preparando', en_camino: 'En camino', entregado: 'Entregado', cancelado: 'Cancelado',
}

const time = (iso: string) =>
  new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function Orders() {
  const { run, data, reload } = useAdmin()
  const live = useLive()
  const pub = useAppData()
  const [savingToggle, setSavingToggle] = useState(false)
  const ordering = isOrderingEnabled(data?.settings)
  const [filter, setFilter] = useState<'activos' | OrderStatus | 'todos'>('activos')
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const orders = live.orders

  async function setStatus(o: AdminOrder, status: OrderStatus) {
    live.setOrders((cur) => cur.map((x) => (x.id === o.id ? { ...x, status } : x)))
    live.seen('order', o.id)
    try {
      await run((t) => api.admin.setOrderStatus(t, o.id, status))
    } catch (e) {
      setError(errorMessage(e))
      void live.reload()
    }
  }

  async function remove(o: AdminOrder) {
    live.setOrders((cur) => cur.filter((x) => x.id !== o.id))
    try {
      await run((t) => api.admin.deleteOrder(t, o.id))
    } catch (e) {
      setError(errorMessage(e))
      void live.reload()
    }
  }

  async function toggleOrdering(enabled: boolean) {
    setSavingToggle(true)
    setError(null)
    try {
      await run((t) => api.admin.setOrdering(t, enabled))
      await reload()
      void pub.reload()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSavingToggle(false)
    }
  }

  const shown = (orders ?? []).filter((o) =>
    filter === 'todos' ? true
      : filter === 'activos' ? o.status === 'nuevo' || o.status === 'preparando' || o.status === 'en_camino'
      : o.status === filter,
  )
  const today = (orders ?? []).filter((o) => new Date(o.created_at).toDateString() === new Date().toDateString() && o.status !== 'cancelado')

  return (
    <>
      <div className="toolbar">
        <h1 className="grow" style={{ margin: 0 }}>Pedidos <span className="live-badge">EN VIVO</span></h1>
        <span className="muted" style={{ fontSize: 13 }}>Hoy: {today.length} · {formatCOP(today.reduce((n, o) => n + o.total, 0))}</span>
        <button className="mini" onClick={() => void live.reload()} aria-label="Actualizar"><Icon name="download" /></button>
      </div>
      <div className={`card ordering-toggle${ordering ? ' on' : ''}`}>
        <div style={{ flex: 1 }}>
          <strong>Recibir pedidos por la app</strong>
          <small className="muted">
            {ordering
              ? 'Activo: los clientes pueden pedir y llegan aquí y a WhatsApp.'
              : 'Desactivado: los clientes solo ven el menú (sin botón Agregar ni pestaña Pedido).'}
          </small>
        </div>
        <label className="switch-big" aria-label="Recibir pedidos por la app">
          <input type="checkbox" checked={ordering} disabled={savingToggle || !data} onChange={(e) => void toggleOrdering(e.target.checked)} />
          <span className="track"><motion.span className="thumb" layout transition={{ type: 'spring', stiffness: 500, damping: 30 }} /></span>
        </label>
      </div>
      <div className="seg" style={{ marginBottom: 14 }}>
        {(['activos', ...ORDER_STATUSES, 'todos'] as const).map((s) => (
          <button key={s} className={filter === s ? 'on' : ''} onClick={() => setFilter(s)}>
            {s === 'activos' ? 'Activos' : s === 'todos' ? 'Todos' : ORDER_LABEL[s]}
          </button>
        ))}
      </div>
      {(error || live.error) && <p className="error">{error || live.error}</p>}
      {!orders && <div className="spinner" />}
      {orders && shown.length === 0 && <div className="empty"><Icon name="receipt" /><p>No hay pedidos aquí.</p></div>}
      <AnimatePresence initial={false}>
        {shown.map((o) => {
          const gps = mapsLink(o)
          return (
            <motion.article
              key={o.id} layout
              className={`card order${live.freshOrders.has(o.id) ? ' is-new' : ''}`}
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
              onClick={() => live.seen('order', o.id)}
            >
              <div className="order-head">
                <div>
                  <h3>#{o.number} · {o.customer.name}</h3>
                  <small className="muted">{time(o.created_at)}{o.updated_at && o.updated_at !== o.created_at ? ` · editado ${time(o.updated_at)}` : ''}</small>
                </div>
                <span className={`status ${o.status}`}>{ORDER_LABEL[o.status]}</span>
              </div>
              {editing === o.id
                ? <OrderEditor order={o} onClose={() => setEditing(null)} onError={setError} />
                : (
                  <>
                    <ul>
                      {o.items.map((i, idx) => <li key={idx}>{i.qty}× {i.name} — {formatCOP(i.qty * i.price)}</li>)}
                    </ul>
                    {o.notes && <p style={{ margin: '0 0 8px', fontSize: 13 }}><strong>Notas:</strong> {o.notes}</p>}
                  </>
                )}
              <p className="muted" style={{ margin: '0 0 10px', fontSize: 13 }}>
                📍 {o.customer.address}
                {gps && <> · <a className="gold" href={gps} target="_blank" rel="noreferrer">Ver GPS en el mapa</a></>}
                {' '}· 📞 <a className="gold" href={`https://api.whatsapp.com/send?phone=57${o.customer.phone}`} target="_blank" rel="noreferrer">{o.customer.phone}</a>
                {o.customer.email && <> · ✉️ {o.customer.email}</>}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                <strong className="gold" style={{ fontSize: 18, fontFamily: 'var(--font-heading)' }}>{formatCOP(o.total)}</strong>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {editing !== o.id && <button className="mini" onClick={() => setEditing(o.id)} aria-label="Editar pedido"><Icon name="edit" /></button>}
                  <ConfirmButton label="Eliminar pedido" onConfirm={() => void remove(o)} />
                </div>
              </div>
              <div className="seg" style={{ marginTop: 10 }}>
                {ORDER_STATUSES.map((s) => (
                  <button key={s} className={o.status === s ? 'on' : ''} onClick={() => void setStatus(o, s)}>{ORDER_LABEL[s]}</button>
                ))}
              </div>
            </motion.article>
          )
        })}
      </AnimatePresence>
    </>
  )
}

/** Edita las líneas del pedido: cantidades, quitar, agregar productos de la carta y notas. */
function OrderEditor({ order, onClose, onError }: { order: AdminOrder; onClose: () => void; onError: (m: string | null) => void }) {
  const { run, data } = useAdmin()
  const live = useLive()
  const [lines, setLines] = useState<OrderLine[]>(order.items.map((i) => ({ ...i })))
  const [notes, setNotes] = useState(order.notes ?? '')
  const [pick, setPick] = useState('')
  const [busy, setBusy] = useState(false)

  const products = useMemo(() => {
    const list: Product[] = []
    data?.menus.forEach((m) => m.categories.forEach((c) => c.products.forEach((p) => list.push(p))))
    return list.sort((a, b) => a.name.localeCompare(b.name))
  }, [data])

  const setQty = (i: number, qty: number) =>
    setLines((cur) => (qty <= 0 ? cur.filter((_, k) => k !== i) : cur.map((l, k) => (k === i ? { ...l, qty: Math.min(50, qty) } : l))))

  function addProduct(id: string) {
    const p = products.find((x) => x.id === id)
    if (!p) return
    setLines((cur) => {
      const k = cur.findIndex((l) => l.product_id === p.id)
      if (k >= 0) return cur.map((l, j) => (j === k ? { ...l, qty: Math.min(50, l.qty + 1) } : l))
      return [...cur, { product_id: p.id, name: p.name, qty: 1, price: p.price }]
    })
    setPick('')
  }

  async function save() {
    if (!lines.length) return onError('El pedido debe tener al menos un producto. Si no, elimínalo.')
    setBusy(true)
    onError(null)
    try {
      const updated = await run((t) => api.admin.updateOrder(t, order.id, lines, notes))
      live.setOrders((cur) => cur.map((x) => (x.id === order.id ? { ...x, ...updated } : x)))
      onClose()
    } catch (e) {
      onError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const total = lines.reduce((n, l) => n + l.qty * l.price, 0)
  return (
    <div className="order-editor">
      {lines.map((l, i) => (
        <div className="edit-line" key={`${l.product_id}-${i}`}>
          <span className="grow">{l.name} <small className="muted">{formatCOP(l.price)}</small></span>
          <button className="mini" onClick={() => setQty(i, l.qty - 1)} aria-label="Quitar uno"><Icon name="minus" /></button>
          <strong style={{ minWidth: 24, textAlign: 'center' }}>{l.qty}</strong>
          <button className="mini" onClick={() => setQty(i, l.qty + 1)} aria-label="Agregar uno"><Icon name="plus" /></button>
          <button className="mini danger" onClick={() => setQty(i, 0)} aria-label="Quitar producto"><Icon name="x" /></button>
        </div>
      ))}
      <select className="input" value={pick} onChange={(e) => addProduct(e.target.value)} style={{ marginTop: 8 }}>
        <option value="">+ Agregar producto de la carta…</option>
        {products.map((p) => <option key={p.id} value={p.id}>{p.name} · {formatCOP(p.price)}{p.active === false ? ' (inactivo)' : ''}</option>)}
      </select>
      <textarea className="input" style={{ marginTop: 8 }} placeholder="Notas" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
        <strong className="grow">Nuevo total: {formatCOP(total)}</strong>
        <button className="btn solid sm" onClick={() => void save()} disabled={busy}><Icon name="check" /> Guardar</button>
        <button className="btn ghost sm" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  )
}
