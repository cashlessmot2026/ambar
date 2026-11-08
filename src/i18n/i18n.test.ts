import { describe, expect, it } from 'vitest'
import { detectLang, LANGS, localized, translate } from './I18n'
import { DICTS } from './dicts'
import { es } from './locales/es'
import { extraEs } from './locales/extra'

describe('detectLang', () => {
  it.each([
    [null, ['pt-PT'], 'pt'],
    [null, ['zh-TW', 'en'], 'zh'],
    [null, ['ar-EG'], 'ar'],
    [null, ['xx', 'yy'], 'es'],
    [null, ['xx', 'de-AT'], 'de'],
    [null, [], 'es'],
    ['en', ['de'], 'en'],
    ['xx', ['de'], 'de'],
  ] as const)('guardado=%s navegador=%j → %s', (saved, nav, expected) => {
    expect(detectLang(saved, nav)).toBe(expected)
  })
})

describe('diccionarios', () => {
  it('hay 10 idiomas y el árabe es RTL', () => {
    expect(LANGS.map((l) => l.code)).toEqual(['es', 'en', 'de', 'ru', 'pt', 'it', 'fr', 'zh', 'ko', 'ar'])
    expect(LANGS.find((l) => l.code === 'ar')?.dir).toBe('rtl')
  })
  it('las claves base existen y no están vacías en los 10 idiomas', () => {
    const extra = new Set(Object.keys(extraEs))
    const keys = Object.keys(es).filter((k) => !extra.has(k))
    for (const l of LANGS) {
      const d = DICTS[l.code] as Record<string, string>
      for (const k of keys) expect(d[k]?.trim(), `${l.code}.${k}`).toBeTruthy()
    }
  })
  it('las claves nuevas existen en español e inglés', () => {
    for (const k of Object.keys(extraEs)) {
      expect((DICTS.es as Record<string, string>)[k]?.trim(), `es.${k}`).toBeTruthy()
      expect((DICTS.en as Record<string, string>)[k]?.trim(), `en.${k}`).toBeTruthy()
    }
  })
  it('las variables {x} del español existen en cada traducción presente', () => {
    for (const l of LANGS) {
      const d = DICTS[l.code] as Record<string, string>
      for (const [k, v] of Object.entries(es)) {
        if (!d[k]) continue
        for (const m of v.match(/\{\w+\}/g) ?? []) expect(d[k], `${l.code}.${k} ${m}`).toContain(m)
      }
    }
  })
  it('una clave nueva sin traducir cae a inglés, no a español', () => {
    expect(translate('de', 'acc.logout')).toBe('Log out')
    expect(translate('es', 'acc.logout')).toBe('Cerrar sesión')
  })
})

describe('translate', () => {
  it('traduce e interpola', () => {
    expect(translate('en', 'nav.menu')).not.toBe(translate('es', 'nav.menu'))
    expect(translate('es', 'product.added', { name: 'Rib eye' })).toContain('Rib eye')
  })
})

describe('localized', () => {
  const p = { name: 'Costillas', description: 'Ahumadas', i18n: { en: { name: 'Ribs', description: '' } } }
  it('usa la traducción si existe', () => expect(localized(p, 'name', 'en')).toBe('Ribs'))
  it('cae a español si la traducción está vacía', () => expect(localized(p, 'description', 'en')).toBe('Ahumadas'))
  it('cae a español si no hay idioma', () => expect(localized(p, 'name', 'ar')).toBe('Costillas'))
  it('español devuelve el campo base', () => expect(localized(p, 'name', 'es')).toBe('Costillas'))
  it('campo nulo → cadena vacía', () => expect(localized({ description: null as string | null, i18n: {} }, 'description', 'en')).toBe(''))
})
