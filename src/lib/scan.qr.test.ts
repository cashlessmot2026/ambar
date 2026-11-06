import jsQR from 'jsqr'
import QRCode from 'qrcode'
import { describe, expect, it } from 'vitest'
import { extractStarKey } from './scan'

/** Dibuja un QR como imagen RGBA (como la que entrega la cámara) a partir de su matriz de módulos. */
function render(text: string, scale = 8, margin = 4) {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' })
  const n = qr.modules.size
  const size = (n + margin * 2) * scale
  const data = new Uint8ClampedArray(size * size * 4).fill(255)
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      if (qr.modules.get(y, x))
        for (let dy = 0; dy < scale; dy++)
          for (let dx = 0; dx < scale; dx++) {
            const i = (((y + margin) * scale + dy) * size + (x + margin) * scale + dx) * 4
            data[i] = data[i + 1] = data[i + 2] = 0
          }
  return { data, size }
}

describe('QR de Ámbar → jsQR → clave', () => {
  it('lee la clave del QR que genera el panel', () => {
    const key = 'c0ffee1234567890abcdef1234567890ab12'
    const { data, size } = render(`https://cashlessmot2026.github.io/ambar/#/estrella?k=${key}`)
    const decoded = jsQR(data, size, size)
    expect(decoded?.data).toContain('#/estrella?k=')
    expect(extractStarKey(decoded!.data)).toBe(key)
  })
  it('un QR ajeno se lee pero no da clave', () => {
    const { data, size } = render('https://instagram.com/ambarsteakhouse_')
    expect(extractStarKey(jsQR(data, size, size)!.data)).toBeNull()
  })
})
