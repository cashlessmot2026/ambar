import type { Settings } from './types'

/** ¿Los clientes pueden pedir por la app? Si la clave no existe, sí. */
export function isOrderingEnabled(settings: Settings | undefined | null): boolean {
  return settings?.ordering?.enabled !== false
}
