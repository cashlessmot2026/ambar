import { supabase } from './supabase'

export interface ChangePing { table: 'orders' | 'reservations'; op?: 'INSERT' | 'UPDATE' | 'DELETE'; id: string }

/**
 * Escucha los "pings" que la base de datos difunde al cambiar pedidos o reservas (sin datos personales).
 * Quien escucha vuelve a pedir los datos por RPC con su token. Devuelve la función para cancelar.
 */
export function onChanges(topic: string, cb: (p: ChangePing) => void): () => void {
  const ch = supabase
    .channel(topic, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'change' }, (msg) => cb(msg.payload as ChangePing))
    .subscribe()
  return () => { void supabase.removeChannel(ch) }
}
