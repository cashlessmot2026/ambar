// Recomendado del día: rota cada día entre los platos más costosos de la carta.
// Copia exacta de src/lib/recommend.ts (la app y la Edge Function deben elegir el mismo plato).
export interface PricedProduct { id: string; price: number; name: string }

export const POOL_SIZE = 5

/** Días desde 1970 en la hora de Colombia (UTC-5, sin horario de verano). */
export function bogotaDay(now: Date = new Date()): number {
  return Math.floor((now.getTime() - 5 * 3600_000) / 86_400_000)
}

export function dailyPick<T extends PricedProduct>(products: T[], now: Date = new Date()): T | null {
  const pool = [...products]
    .filter((p) => p.price > 0)
    .sort((a, b) => b.price - a.price || a.name.localeCompare(b.name))
    .slice(0, POOL_SIZE)
  if (!pool.length) return null
  return pool[bogotaDay(now) % pool.length]
}
