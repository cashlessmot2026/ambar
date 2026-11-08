import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api, errorMessage } from '../lib/api'
import { onChanges } from '../lib/realtime'
import type { AdminOrder, Reservation } from '../lib/types'
import { announce, audioUnlocked, unlockAudio } from './alerts'
import { useAdmin } from './useAdmin'

interface LiveValue {
  orders: AdminOrder[] | null
  reservations: Reservation[] | null
  error: string | null
  /** IDs que llegaron mientras el panel estaba abierto y aún no se han atendido. */
  freshOrders: Set<string>
  freshReservations: Set<string>
  seen: (kind: 'order' | 'reservation', id: string) => void
  reload: () => Promise<void>
  setOrders: (fn: (cur: AdminOrder[]) => AdminOrder[]) => void
  setReservations: (fn: (cur: Reservation[]) => Reservation[]) => void
  soundReady: boolean
  enableSound: () => void
}

const Ctx = createContext<LiveValue | null>(null)

/**
 * Pedidos y reservas del panel en tiempo real: escucha los avisos de Supabase Realtime y, por si falla,
 * vuelve a consultar cada 20 s. Cuando entra algo nuevo suena una alerta y una voz lo anuncia.
 */
export function LiveProvider({ children }: { children: ReactNode }) {
  const { run, token } = useAdmin()
  const [orders, setOrdersState] = useState<AdminOrder[] | null>(null)
  const [reservations, setResState] = useState<Reservation[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [freshOrders, setFreshOrders] = useState<Set<string>>(new Set())
  const [freshReservations, setFreshRes] = useState<Set<string>>(new Set())
  const [soundReady, setSoundReady] = useState(audioUnlocked)
  const known = useRef<{ o: Set<string>; r: Set<string> } | null>(null)
  const baseTitle = useRef(document.title)

  const reload = useCallback(async () => {
    try {
      const [o, r] = await Promise.all([run((t) => api.admin.orders(t, 200)), run((t) => api.admin.reservations(t))])
      if (known.current) {
        const newO = o.filter((x) => !known.current!.o.has(x.id)).map((x) => x.id)
        const newR = r.filter((x) => !known.current!.r.has(x.id)).map((x) => x.id)
        if (newO.length) setFreshOrders((f) => new Set([...f, ...newO]))
        if (newR.length) setFreshRes((f) => new Set([...f, ...newR]))
        if (newR.length) announce(newR.length > 1 ? `Tienes ${newR.length} nuevas reservas` : 'Tienes una nueva reserva')
        else if (newO.length) announce(newO.length > 1 ? `Tienes ${newO.length} nuevos pedidos` : 'Tienes un nuevo pedido')
      }
      known.current = { o: new Set(o.map((x) => x.id)), r: new Set(r.map((x) => x.id)) }
      setOrdersState(o)
      setResState(r)
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [run])

  useEffect(() => {
    if (!token) return
    void reload()
    let timer: number | undefined
    // Varios avisos seguidos → una sola recarga.
    const off = onChanges('ambar-admin', () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => void reload(), 400)
    })
    const id = window.setInterval(() => void reload(), 20_000)
    return () => { off(); window.clearInterval(id); window.clearTimeout(timer) }
  }, [token, reload])

  // El primer toque en cualquier parte del panel habilita el sonido.
  useEffect(() => {
    if (soundReady) return
    const on = () => { unlockAudio(); window.setTimeout(() => setSoundReady(audioUnlocked()), 50) }
    window.addEventListener('pointerdown', on)
    return () => window.removeEventListener('pointerdown', on)
  }, [soundReady])

  // Contador en el título de la pestaña.
  useEffect(() => {
    const n = freshOrders.size + freshReservations.size
    document.title = n ? `(${n}) ${baseTitle.current}` : baseTitle.current
  }, [freshOrders, freshReservations])
  useEffect(() => () => { document.title = baseTitle.current }, [])

  const seen = useCallback((kind: 'order' | 'reservation', id: string) => {
    const drop = (f: Set<string>) => { if (!f.has(id)) return f; const n = new Set(f); n.delete(id); return n }
    if (kind === 'order') setFreshOrders(drop)
    else setFreshRes(drop)
  }, [])

  const value = useMemo<LiveValue>(() => ({
    orders, reservations, error, freshOrders, freshReservations, seen, reload, soundReady,
    setOrders: (fn) => setOrdersState((cur) => (cur ? fn(cur) : cur)),
    setReservations: (fn) => setResState((cur) => (cur ? fn(cur) : cur)),
    enableSound: () => { unlockAudio(); setSoundReady(true); announce('Alertas activadas') },
  }), [orders, reservations, error, freshOrders, freshReservations, seen, reload, soundReady])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useLive(): LiveValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useLive fuera de LiveProvider')
  return v
}
