import { LANGS, type Lang } from '../i18n/I18n'
import { formatCOP } from './format'
import { mapsLink } from './geo'
import type { Customer, OrderLine, OrderSummary, Reservation } from './types'

export const DEFAULT_WHATSAPP = '573229089680'

// wa.me redirige y corrompe los emojis de 4 bytes; api.whatsapp.com/send los conserva.
export const waUrl = (phone: string, text: string) =>
  `https://api.whatsapp.com/send?phone=${phone.replace(/\D/g, '')}&text=${encodeURIComponent(text)}`

const langLine = (lang: Lang) =>
  lang !== 'es' ? [`Idioma del cliente: ${LANGS.find((l) => l.code === lang)?.esName ?? lang}`] : []

const dishLines = (items: OrderLine[]) => items.map((i) => `• ${i.qty}x ${i.name} — ${formatCOP(i.qty * i.price)}`)

/** Texto del pedido (siempre en español para el restaurante). */
export function orderText(order: OrderSummary, customer: Customer, lang: Lang = 'es'): string {
  const lines = [
    `*NUEVO PEDIDO · ÁMBAR STEAK HOUSE* #${order.number}`,
    '',
    ...dishLines(order.items),
    '',
    `*Total: ${formatCOP(order.total)}*`,
  ]
  if (order.notes) lines.push('', `Notas: ${order.notes}`)
  lines.push('', `Cliente: ${customer.name}`, `Dirección: ${customer.address}`, `Teléfono: ${customer.phone}`)
  const gps = mapsLink(order)
  if (gps) lines.push(`Ubicación GPS: ${gps}`)
  lines.push(...langLine(lang))
  return lines.join('\n')
}

export function buildWhatsAppUrl(phone: string, order: OrderSummary, customer: Customer, lang: Lang = 'es'): string {
  return waUrl(phone, orderText(order, customer, lang))
}

const when = (iso: string) =>
  new Date(iso).toLocaleString('es-CO', {
    timeZone: 'America/Bogota', weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit',
  })

/** Mensaje de la reserva para el WhatsApp del restaurante. */
export function reservationText(r: Reservation, lang: Lang = 'es'): string {
  const lines = [
    `*NUEVA RESERVA · ÁMBAR STEAK HOUSE* #${r.number}`,
    '',
    `Nombre: ${r.name}`,
    `Fecha y hora: ${when(r.reserved_at)}`,
    `Personas: ${r.people}`,
    `Con bebés: ${r.babies ? 'Sí' : 'No'}`,
    `Teléfono: ${r.phone}`,
    `Correo: ${r.email}`,
  ]
  if (r.notes) lines.push(`Notas: ${r.notes}`)
  if (r.dishes.length) lines.push('', '*Platos elegidos:*', ...dishLines(r.dishes), `*Total estimado: ${formatCOP(r.dishes_total)}*`)
  lines.push(...langLine(lang))
  return lines.join('\n')
}
