import { describe, expect, it } from 'vitest'
import { extractStarKey } from './scan'

const KEY = 'c0ffee1234567890abcdef1234567890ab12'

describe('extractStarKey', () => {
  it('lee la clave de la URL del QR/NFC de Ámbar', () => {
    expect(extractStarKey(`https://cashlessmot2026.github.io/ambar/#/estrella?k=${KEY}`)).toBe(KEY)
    expect(extractStarKey(`http://localhost:5173/#/estrella?k=${KEY}&x=1`)).toBe(KEY)
    expect(extractStarKey(`  https://otro-dominio.com/#/estrella?k=${KEY}\n`)).toBe(KEY)
  })
  it('rechaza QR que no son de Ámbar', () => {
    expect(extractStarKey('https://instagram.com/ambarsteakhouse_')).toBeNull()
    expect(extractStarKey('WIFI:S:Ambar;T:WPA;P:1234;;')).toBeNull()
    expect(extractStarKey('https://x.com/#/estrella?k=')).toBeNull()
    expect(extractStarKey('https://x.com/#/estrella?k=<script>')).toBeNull()
    expect(extractStarKey('')).toBeNull()
  })
})
