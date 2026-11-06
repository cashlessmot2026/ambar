import { LANGS, type Lang } from '../i18n/I18n'
import { formatCOP } from './format'
import type { Customer, OrderSummary } from './types'

/** El mensaje al restaurante siempre va en español; si el cliente usa otro idioma, se indica cuál. */
export function buildWhatsAppUrl(phone: string, order: OrderSummary, customer: Customer, lang: Lang = 'es'): string {
  const lines = [
    `*NUEVO PEDIDO · ÁMBAR STEAK HOUSE* #${order.number}`,
    '',
    ...order.items.map((i) => `• ${i.qty}x ${i.name} — ${formatCOP(i.qty * i.price)}`),
    '',
    `*Total: ${formatCOP(order.total)}*`,
  ]
  if (order.notes) lines.push('', `Notas: ${order.notes}`)
  lines.push('', `Cliente: ${customer.name}`, `Dirección: ${customer.address}`, `Teléfono: ${customer.phone}`)
  if (lang !== 'es') lines.push(`Idioma del cliente: ${LANGS.find((l) => l.code === lang)?.esName ?? lang}`)
  const text = lines.join('\n')
  // wa.me redirige y corrompe los emojis de 4 bytes; api.whatsapp.com/send los conserva.
  return `https://api.whatsapp.com/send?phone=${phone.replace(/\D/g, '')}&text=${encodeURIComponent(text)}`
}
