import { describe, expect, it } from 'vitest'
import { nfcRecordsToTexts } from './nfc'

const enc = (s: string) => new TextEncoder().encode(s)

describe('nfcRecordsToTexts', () => {
  it('decodifica registros url y text', () => {
    const texts = nfcRecordsToTexts([
      { recordType: 'url', data: new DataView(enc('https://x.com/#/estrella?k=abc').buffer) },
      { recordType: 'text', encoding: 'utf-8', data: new DataView(enc('hola').buffer) },
      { recordType: 'mime', data: new DataView(enc('ignorado').buffer) },
    ])
    expect(texts).toEqual(['https://x.com/#/estrella?k=abc', 'hola'])
  })
  it('sin datos → lista vacía', () => {
    expect(nfcRecordsToTexts([{ recordType: 'url' }])).toEqual([])
  })
})
