import { formatCOP, mediaUrl } from './format'
import type { Customer, OrderSummary } from './types'

const W = 720
const PAD = 48

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((ok) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => ok(img)
    img.onerror = () => ok(null)
    img.src = src
  })
}

/** Corta el texto en líneas que caben en `max` px. */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const out: string[] = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > max && line) {
      out.push(line)
      line = word
    } else line = test
  }
  if (line) out.push(line)
  return out
}

/** Dibuja el ticket del pedido como imagen PNG (para descargar o compartir por WhatsApp). */
export async function renderTicket(order: OrderSummary, customer: Customer, business = 'ÁMBAR STEAK HOUSE'): Promise<Blob> {
  const scale = 2
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const font = (size: number, weight = 400) => `${weight} ${size}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`
  const date = new Date(order.created_at).toLocaleString('es-CO', {
    timeZone: 'America/Bogota', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  const gps = order.lat != null && order.lng != null ? `${order.lat.toFixed(5)}, ${order.lng.toFixed(5)}` : null

  // Primero medimos para saber el alto.
  ctx.font = font(22)
  const itemRows = order.items.map((i) => ({ left: wrap(ctx, `${i.qty} × ${i.name}`, W - PAD * 2 - 170), right: formatCOP(i.qty * i.price) }))
  const notes = order.notes ? wrap(ctx, `Notas: ${order.notes}`, W - PAD * 2) : []
  const info = [
    `Cliente: ${customer.name}`,
    `Teléfono: ${customer.phone}`,
    ...wrap(ctx, `Dirección: ${customer.address}`, W - PAD * 2),
    ...(gps ? [`GPS: ${gps}`] : []),
  ]
  const H = 250 + itemRows.reduce((n, r) => n + r.left.length * 32 + 8, 0) + 110 + notes.length * 30 + info.length * 32 + 120

  canvas.width = W * scale
  canvas.height = H * scale
  ctx.scale(scale, scale)
  ctx.fillStyle = '#121212'
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = '#d4a24c'
  ctx.lineWidth = 3
  ctx.strokeRect(14, 14, W - 28, H - 28)

  const logo = await loadImage(mediaUrl('logo.png'))
  let y = 40
  if (logo) {
    const h = 80
    const w = (logo.width / logo.height) * h
    ctx.drawImage(logo, (W - w) / 2, y, w, h)
    y += h + 16
  } else y += 30
  ctx.textAlign = 'center'
  ctx.fillStyle = '#d4a24c'
  ctx.font = font(28, 800)
  ctx.fillText(business, W / 2, y + 10)
  ctx.fillStyle = '#bdbdbd'
  ctx.font = font(20)
  ctx.fillText(`Pedido #${order.number} · ${date}`, W / 2, y + 44)
  y += 76

  const rule = () => {
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 2
    ctx.setLineDash([8, 8])
    ctx.beginPath()
    ctx.moveTo(PAD, y)
    ctx.lineTo(W - PAD, y)
    ctx.stroke()
    ctx.setLineDash([])
    y += 24
  }
  rule()

  ctx.font = font(22)
  for (const r of itemRows) {
    ctx.fillStyle = '#f2f2f2'
    ctx.textAlign = 'left'
    r.left.forEach((l, i) => ctx.fillText(l, PAD, y + 22 + i * 32))
    ctx.textAlign = 'right'
    ctx.fillStyle = '#d4a24c'
    ctx.fillText(r.right, W - PAD, y + 22)
    y += r.left.length * 32 + 8
  }
  y += 8
  rule()
  ctx.textAlign = 'left'
  ctx.fillStyle = '#f2f2f2'
  ctx.font = font(26, 800)
  ctx.fillText('TOTAL', PAD, y + 24)
  ctx.textAlign = 'right'
  ctx.fillStyle = '#d4a24c'
  ctx.fillText(formatCOP(order.total), W - PAD, y + 24)
  y += 56

  ctx.textAlign = 'left'
  ctx.font = font(20)
  ctx.fillStyle = '#d0d0d0'
  for (const n of notes) { ctx.fillText(n, PAD, y + 20); y += 30 }
  if (notes.length) y += 10
  rule()
  for (const l of info) { ctx.fillText(l, PAD, y + 20); y += 32 }

  ctx.textAlign = 'center'
  ctx.fillStyle = '#8a8a8a'
  ctx.font = font(18)
  ctx.fillText('¡Gracias por tu pedido!', W / 2, H - 44)

  return await new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error('png'))), 'image/png'))
}
