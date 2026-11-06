import { ar } from './locales/ar'
import { de } from './locales/de'
import { en } from './locales/en'
import { es, type Dict } from './locales/es'
import { fr } from './locales/fr'
import { it } from './locales/it'
import { ko } from './locales/ko'
import { pt } from './locales/pt'
import { ru } from './locales/ru'
import { zh } from './locales/zh'

export const DICTS: Record<'es' | 'en' | 'de' | 'ru' | 'pt' | 'it' | 'fr' | 'zh' | 'ko' | 'ar', Dict> = {
  es, en, de, ru, pt, it, fr, zh, ko, ar,
}
