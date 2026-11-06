import { describe, expect, it } from 'vitest'
import { orderMenus } from './menuPriority'
import { formatCOP } from './format'
import { buildWhatsAppUrl } from './whatsapp'
import { rewardProgress } from './rewards'
import type { Menu, Reward } from './types'

const menu = (slug: string, start: string, end: string, sort: number): Menu => ({
  id: slug, slug, name: slug, subtitle: null, start_time: start, end_time: end, sort, categories: [],
})
const menus = [menu('ambar', '11:00', '03:59', 2), menu('desayuno', '04:00', '10:59', 1)]
const at = (h: number, m: number) => new Date(2026, 10, 6, h, m)

describe('orderMenus', () => {
  it.each([[4, 0], [7, 30], [10, 59]])('%i:%i → desayuno primero', (h, m) => {
    expect(orderMenus(menus, at(h, m)).map((x) => x.slug)).toEqual(['desayuno', 'ambar'])
  })
  it.each([[11, 0], [11, 5], [23, 30], [0, 0], [3, 59]])('%i:%i → ámbar primero', (h, m) => {
    expect(orderMenus(menus, at(h, m)).map((x) => x.slug)).toEqual(['ambar', 'desayuno'])
  })
  it('hueco sin menú activo (10:59:30 no aplica; usa sort)', () => {
    const gap = [menu('b', '12:00', '13:00', 2), menu('a', '14:00', '15:00', 1)]
    expect(orderMenus(gap, at(9, 0)).map((x) => x.slug)).toEqual(['a', 'b'])
  })
  it('no muta la entrada', () => {
    const copy = [...menus]
    orderMenus(menus, at(8, 0))
    expect(menus).toEqual(copy)
  })
})

describe('formatCOP', () => {
  it('formatea con punto de miles', () => {
    expect(formatCOP(140000)).toBe('$140.000')
    expect(formatCOP(3500)).toBe('$3.500')
    expect(formatCOP(0)).toBe('$0')
  })
})

describe('buildWhatsAppUrl', () => {
  it('arma el mensaje del pedido', () => {
    const url = buildWhatsAppUrl(
      '573229089680',
      { id: 'abc', number: 42, total: 190000, notes: 'Término medio', created_at: '', items: [{ product_id: 'p', name: 'Rib eye', qty: 2, price: 95000 }] },
      { id: 'c', name: 'Ana Pérez', address: 'Calle 1 #2-3', phone: '3001112233', stars: 0, pending_reward_id: null, created_at: '' },
    )
    // wa.me redirige y corrompe emojis; se usa api.whatsapp.com/send directamente.
    expect(url.startsWith('https://api.whatsapp.com/send?phone=573229089680&text=')).toBe(true)
    const text = decodeURIComponent(url.split('&text=')[1])
    // Sin emojis de 4 bytes (pares sustitutos): WhatsApp Web los muestra como "�".
    expect(/[\uD800-\uDFFF]/.test(text)).toBe(false)
    expect(text).toContain('#42')
    expect(text).toContain('2x Rib eye — $190.000')
    expect(text).toContain('Total: $190.000')
    expect(text).toContain('Ana Pérez')
    expect(text).toContain('Calle 1 #2-3')
    expect(text).toContain('3001112233')
    expect(text).toContain('Término medio')
  })
})

describe('rewardProgress', () => {
  const rewards: Reward[] = [
    { id: 'a', name: 'Postre', description: null, stars_required: 5, image: null },
    { id: 'b', name: 'Burger', description: null, stars_required: 10, image: null },
  ]
  it('calcula porcentaje y listo', () => {
    const p = rewardProgress(5, rewards)
    expect(p[0]).toMatchObject({ pct: 100, ready: true })
    expect(p[1]).toMatchObject({ pct: 50, ready: false })
  })
  it('tope 100', () => {
    expect(rewardProgress(25, rewards)[1].pct).toBe(100)
  })
})

describe('buildWhatsAppUrl idioma del cliente', () => {
  const order = { id: 'a', number: 7, total: 1000, notes: null, created_at: '', items: [{ product_id: 'p', name: 'Café', qty: 1, price: 1000 }] }
  const customer = { id: 'c', name: 'John', address: 'Hotel', phone: '3001112233', stars: 0, pending_reward_id: null, created_at: '' }
  it('agrega el idioma del cliente en español cuando no es español', () => {
    const text = decodeURIComponent(buildWhatsAppUrl('573229089680', order, customer, 'en').split('&text=')[1])
    expect(text).toContain('Idioma del cliente: Inglés')
  })
  it('no agrega la línea si el cliente usa español', () => {
    const text = decodeURIComponent(buildWhatsAppUrl('573229089680', order, customer, 'es').split('&text=')[1])
    expect(text).not.toContain('Idioma del cliente')
  })
})

describe('apiErrorKey', () => {
  it('mapea códigos conocidos y cae a genérico', async () => {
    const { apiErrorKey } = await import('../i18n/I18n')
    expect(apiErrorKey('phone_in_use')).toBe('err.phone_in_use')
    expect(apiErrorKey('algo_raro')).toBe('err.generic')
  })
})
