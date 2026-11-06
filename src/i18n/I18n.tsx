import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { DICTS } from './dicts'
import { es, type Key } from './locales/es'

export type Lang = 'es' | 'en' | 'de' | 'ru' | 'pt' | 'it' | 'fr' | 'zh' | 'ko' | 'ar'

export const LANGS: { code: Lang; name: string; esName: string; flag: string; dir: 'ltr' | 'rtl' }[] = [
  { code: 'es', name: 'Español', esName: 'Español', flag: '🇨🇴', dir: 'ltr' },
  { code: 'en', name: 'English', esName: 'Inglés', flag: '🇺🇸', dir: 'ltr' },
  { code: 'de', name: 'Deutsch', esName: 'Alemán', flag: '🇩🇪', dir: 'ltr' },
  { code: 'ru', name: 'Русский', esName: 'Ruso', flag: '🇷🇺', dir: 'ltr' },
  { code: 'pt', name: 'Português (Brasil)', esName: 'Portugués', flag: '🇧🇷', dir: 'ltr' },
  { code: 'it', name: 'Italiano', esName: 'Italiano', flag: '🇮🇹', dir: 'ltr' },
  { code: 'fr', name: 'Français', esName: 'Francés', flag: '🇫🇷', dir: 'ltr' },
  { code: 'zh', name: '中文', esName: 'Mandarín', flag: '🇨🇳', dir: 'ltr' },
  { code: 'ko', name: '한국어', esName: 'Coreano', flag: '🇰🇷', dir: 'ltr' },
  { code: 'ar', name: 'العربية', esName: 'Árabe', flag: '🇸🇦', dir: 'rtl' },
]

const CODES = LANGS.map((l) => l.code) as string[]
export const LANG_KEY = 'ambar:lang'

const isLang = (v: string | null | undefined): v is Lang => !!v && CODES.includes(v)

/** Idioma guardado si es válido; si no, el primero del navegador que soportemos; si no, español. */
export function detectLang(saved: string | null, navLangs: readonly string[]): Lang {
  if (isLang(saved)) return saved
  for (const n of navLangs) {
    const base = n.toLowerCase().split('-')[0]
    if (isLang(base)) return base
  }
  return 'es'
}

export function translate(lang: Lang, key: Key, vars?: Record<string, string | number>): string {
  let s = (DICTS[lang] as Record<string, string>)[key] || es[key]
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v))
  return s
}

type I18nField = Partial<Record<Lang, Record<string, string | undefined>>>

/** Campo traducido de un registro de la base de datos; vacío o ausente → valor base en español. */
export function localized<T extends { i18n?: I18nField }>(obj: T, field: keyof T & string, lang: Lang): string {
  const tr = lang === 'es' ? undefined : obj.i18n?.[lang]?.[field]
  if (tr && tr.trim()) return tr
  const base = obj[field]
  return typeof base === 'string' ? base : ''
}

interface I18nValue {
  lang: Lang
  dir: 'ltr' | 'rtl'
  setLang: (l: Lang) => void
  t: (key: Key, vars?: Record<string, string | number>) => string
}

const Ctx = createContext<I18nValue>({
  lang: 'es', dir: 'ltr', setLang: () => {}, t: (k, v) => translate('es', k, v),
})

function readSaved(): string | null {
  try { return localStorage.getItem(LANG_KEY) } catch { return null }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() =>
    detectLang(readSaved(), typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : []),
  )
  const dir = LANGS.find((l) => l.code === lang)!.dir

  useEffect(() => {
    const root = document.documentElement
    root.lang = lang === 'zh' ? 'zh-Hans' : lang === 'pt' ? 'pt-BR' : lang
    root.dir = dir
    if (lang === 'ar' && !document.getElementById('font-ar')) {
      const link = document.createElement('link')
      link.id = 'font-ar'
      link.rel = 'stylesheet'
      link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;700;800&display=swap'
      document.head.appendChild(link)
    }
  }, [lang, dir])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try { localStorage.setItem(LANG_KEY, l) } catch { /* sin almacenamiento */ }
  }, [])

  const value = useMemo<I18nValue>(
    () => ({ lang, dir, setLang, t: (k, v) => translate(lang, k, v) }),
    [lang, dir, setLang],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useI18n = () => useContext(Ctx)
