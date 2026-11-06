import { LANGS, type Lang } from '../i18n/I18n'
import type { I18nMap } from '../lib/types'

const SHORT: Record<Lang, string> = {
  es: 'ES', en: 'EN', de: 'DE', ru: 'RU', pt: 'PT', it: 'IT', fr: 'FR', zh: '中文', ko: '한국어', ar: 'عربي',
}

/** Pestañas ES · EN · … para editar el contenido en cada idioma. Un punto marca los idiomas sin texto (usan español). */
export function LangTabs({ lang, onChange, missing }: { lang: Lang; onChange: (l: Lang) => void; missing?: (l: Lang) => boolean }) {
  return (
    <div className="seg lang-tabs" role="tablist" aria-label="Idioma de edición">
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          role="tab"
          aria-selected={l.code === lang}
          className={l.code === lang ? 'on' : ''}
          onClick={() => onChange(l.code)}
          title={l.esName + (missing?.(l.code) ? ' · sin traducir (se muestra en español)' : '')}
        >
          {SHORT[l.code]}
          {l.code !== 'es' && missing?.(l.code) && <i className="lang-missing" aria-hidden="true" />}
        </button>
      ))}
    </div>
  )
}

/** Valor de un campo en el idioma de edición: el campo base en español o la traducción. */
export function trGet(obj: { i18n?: I18nMap } & Record<string, unknown>, field: string, lang: Lang): string {
  if (lang === 'es') return String(obj[field] ?? '')
  return obj.i18n?.[lang]?.[field] ?? ''
}

/** Copia del objeto con el campo actualizado en el idioma de edición. */
export function trSet<T extends { i18n?: I18nMap }>(obj: T, field: string, lang: Lang, value: string): T {
  if (lang === 'es') return { ...obj, [field]: value }
  const i18n = { ...(obj.i18n ?? {}) }
  i18n[lang] = { ...(i18n[lang] ?? {}), [field]: value }
  return { ...obj, i18n }
}

/** ¿Falta la traducción de alguno de los campos con texto en español? */
export function trMissing(obj: { i18n?: I18nMap } & Record<string, unknown>, fields: string[], lang: Lang): boolean {
  if (lang === 'es') return false
  return fields.some((f) => String(obj[f] ?? '').trim() !== '' && !(obj.i18n?.[lang]?.[f] ?? '').trim())
}
