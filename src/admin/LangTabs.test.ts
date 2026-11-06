import { describe, expect, it } from 'vitest'
import { trGet, trMissing, trSet } from './LangTabs'

describe('trGet / trSet / trMissing', () => {
  const p = { name: 'Costillas', description: 'Ahumadas', i18n: { en: { name: 'Ribs' } } }

  it('lee el campo base en español y la traducción en otro idioma', () => {
    expect(trGet(p, 'name', 'es')).toBe('Costillas')
    expect(trGet(p, 'name', 'en')).toBe('Ribs')
    expect(trGet(p, 'description', 'en')).toBe('')
  })

  it('escribe sin mutar y sin borrar otros idiomas ni campos', () => {
    const q = trSet(p, 'description', 'en', 'Smoked')
    expect(q.i18n.en).toEqual({ name: 'Ribs', description: 'Smoked' })
    expect(p.i18n.en).toEqual({ name: 'Ribs' })
    const r = trSet(q, 'name', 'fr', 'Côtes')
    expect(r.i18n).toEqual({ en: { name: 'Ribs', description: 'Smoked' }, fr: { name: 'Côtes' } })
    expect(trSet(p, 'name', 'es', 'Costillas BBQ').name).toBe('Costillas BBQ')
  })

  it('detecta traducciones faltantes solo cuando hay texto en español', () => {
    expect(trMissing(p, ['name', 'description'], 'en')).toBe(true)
    expect(trMissing(p, ['name'], 'en')).toBe(false)
    expect(trMissing({ name: 'X', description: null }, ['description'], 'de')).toBe(false)
    expect(trMissing(p, ['name'], 'es')).toBe(false)
  })
})
