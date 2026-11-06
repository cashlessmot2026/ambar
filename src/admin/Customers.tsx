import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { api, errorMessage } from '../lib/api'
import type { AdminCustomer } from '../lib/types'
import { useAdmin } from './useAdmin'

const KIND: Record<string, string> = { earn: 'Visita (+1)', redeem: 'Canje', adjust: 'Ajuste manual' }
const when = (iso: string) => new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function Customers() {
  const { run } = useAdmin()
  const [list, setList] = useState<AdminCustomer[] | null>(null)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setList(await run((t) => api.admin.customers(t)))
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [run])
  useEffect(() => { void load() }, [load])

  async function adjust(c: AdminCustomer, delta: number) {
    try {
      const updated = await run((t) => api.admin.adjustStars(t, c.id, delta))
      setList((cur) => cur?.map((x) => (x.id === c.id ? { ...x, stars: updated.stars } : x)) ?? null)
      void load()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const term = q.trim().toLowerCase()
  const shown = (list ?? []).filter((c) => !term || c.name.toLowerCase().includes(term) || c.phone.includes(term))

  return (
    <>
      <div className="toolbar">
        <h1 className="grow" style={{ margin: 0 }}>Clientes {list && <span className="muted" style={{ fontSize: 14 }}>({list.length})</span>}</h1>
        <input className="input grow" placeholder="Buscar por nombre o teléfono" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {error && <p className="error">{error}</p>}
      {!list && <div className="spinner" />}
      {list && shown.length === 0 && <div className="empty"><Icon name="users" /><p>Sin clientes.</p></div>}
      {shown.length > 0 && (
        <div className="card">
          {shown.map((c) => (
            <div key={c.id}>
              <div className="list-item">
                <button className="txt" style={{ textAlign: 'left' }} onClick={() => setOpen(open === c.id ? null : c.id)}>
                  <strong>{c.name}</strong>
                  <small>{c.phone} · {c.address} · {c.orders} pedidos</small>
                </button>
                <button className="mini" onClick={() => void adjust(c, -1)} aria-label="Quitar estrella" disabled={c.stars === 0}><Icon name="minus" /></button>
                <span style={{ minWidth: 46, textAlign: 'center', fontWeight: 800 }} className="gold">{c.stars} ★</span>
                <button className="mini" onClick={() => void adjust(c, 1)} aria-label="Agregar estrella"><Icon name="plus" /></button>
              </div>
              <AnimatePresence>
                {open === c.id && (
                  <motion.div className="events" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                    {c.events.length === 0 && <div>Sin movimientos.</div>}
                    {c.events.map((e, i) => (
                      <div key={i}>
                        <span>{KIND[e.kind]}{e.reward_name ? `: ${e.reward_name}` : ''} ({e.delta > 0 ? '+' : ''}{e.delta})</span>
                        <span>{when(e.created_at)}</span>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
