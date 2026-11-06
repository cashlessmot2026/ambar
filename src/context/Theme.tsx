import { useEffect } from 'react'
import type { Settings } from '../lib/types'

export const FONT_OPTIONS = [
  'Montserrat', 'Inter', 'Poppins', 'Playfair Display', 'Oswald', 'Bebas Neue',
  'Raleway', 'Lato', 'Roboto', 'DM Sans', 'Cormorant Garamond', 'Archivo',
]

const VARS: Record<string, string> = {
  bg: '--bg', surface: '--surface', border: '--border', gold: '--gold', amber: '--amber', text: '--text', muted: '--muted',
}

/** Aplica colores y fuentes de `settings.theme` como variables CSS y carga las fuentes de Google Fonts. */
export function applyTheme(theme: Settings['theme'] | undefined) {
  if (!theme) return
  const root = document.documentElement
  for (const [k, v] of Object.entries(theme.colors ?? {})) {
    if (VARS[k] && /^#[0-9a-fA-F]{3,8}$/.test(v)) root.style.setProperty(VARS[k], v)
  }
  if (theme.colors?.surface) {
    root.style.setProperty('--surface-2', `color-mix(in srgb, ${theme.colors.surface} 85%, #ffffff 4%)`)
  }
  const fonts = [theme.fonts?.heading, theme.fonts?.body].filter((f): f is string => !!f && FONT_OPTIONS.includes(f))
  if (fonts.length) {
    const href = `https://fonts.googleapis.com/css2?${[...new Set(fonts)]
      .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;500;600;700;800`)
      .join('&')}&display=swap`
    let link = document.getElementById('theme-fonts') as HTMLLinkElement | null
    if (!link) {
      link = document.createElement('link')
      link.id = 'theme-fonts'
      link.rel = 'stylesheet'
      document.head.appendChild(link)
    }
    if (link.href !== href) link.href = href
  }
  if (theme.fonts?.heading) root.style.setProperty('--font-heading', `'${theme.fonts.heading}', system-ui, sans-serif`)
  if (theme.fonts?.body) root.style.setProperty('--font-body', `'${theme.fonts.body}', system-ui, sans-serif`)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta && theme.colors?.bg) meta.setAttribute('content', theme.colors.bg)
}

export function ThemeApplier({ theme }: { theme: Settings['theme'] | undefined }) {
  useEffect(() => applyTheme(theme), [theme])
  return null
}
