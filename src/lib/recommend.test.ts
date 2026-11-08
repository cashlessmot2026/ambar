import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { bogotaDay, dailyPick, POOL_SIZE } from './recommend'

const products = [
  { id: 'a', name: 'Agua', price: 5000 },
  { id: 'b', name: 'Tomahawk', price: 180000 },
  { id: 'c', name: 'Rib eye', price: 120000 },
  { id: 'd', name: 'Picanha', price: 95000 },
  { id: 'e', name: 'Lomo', price: 99000 },
  { id: 'f', name: 'Barkhu', price: 52000 },
  { id: 'g', name: 'Cortesía', price: 0 },
]

describe('dailyPick', () => {
  it('elige solo entre los más costosos', () => {
    const top = ['b', 'c', 'e', 'd', 'f']
    for (let d = 0; d < 20; d++) {
      const pick = dailyPick(products, new Date(Date.UTC(2026, 10, 1 + d, 18)))
      expect(top).toContain(pick?.id)
    }
  })
  it('rota cada día y repite el ciclo', () => {
    const day = (n: number) => new Date(Date.UTC(2026, 10, 1 + n, 18))
    const seen = new Set(Array.from({ length: POOL_SIZE }, (_, n) => dailyPick(products, day(n))?.id))
    expect(seen.size).toBe(POOL_SIZE)
    expect(dailyPick(products, day(0))?.id).toBe(dailyPick(products, day(POOL_SIZE))?.id)
  })
  it('el día cambia a medianoche de Colombia, no de UTC', () => {
    // 23:30 en Bogotá = 04:30 UTC del día siguiente
    expect(bogotaDay(new Date(Date.UTC(2026, 10, 9, 4, 30)))).toBe(bogotaDay(new Date(Date.UTC(2026, 10, 8, 18))))
  })
  it('carta vacía → null', () => expect(dailyPick([])).toBeNull())
  it('la copia de la Edge Function es idéntica', () => {
    const strip = (s: string) => s.split('\n').filter((l) => !l.startsWith('//')).join('\n')
    const app = readFileSync('src/lib/recommend.ts', 'utf8')
    const fn = readFileSync('supabase/functions/mesero-ia/index.ts', 'utf8').replace(/\r\n/g, '\n')
    const edge = fn.slice(fn.indexOf('// <recommend>'), fn.indexOf('// </recommend>'))
    expect(strip(edge).trim()).toBe(strip(app.replace(/\r\n/g, '\n')).trim())
  })
})
