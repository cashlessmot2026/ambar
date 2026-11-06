import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { useAppData } from '../context/AppData'
import { applyTheme, FONT_OPTIONS } from '../context/Theme'
import { api, errorMessage } from '../lib/api'
import type { Settings } from '../lib/types'
import { ImageListEditor } from './ImageListEditor'
import { LangTabs } from './LangTabs'
import { useAdmin } from './useAdmin'
import type { Lang } from '../i18n/I18n'

const COLOR_LABELS: Record<keyof Settings['theme']['colors'], string> = {
  bg: 'Fondo', surface: 'Tarjetas', border: 'Bordes', gold: 'Dorado (principal)', amber: 'Ámbar (acento)', text: 'Texto', muted: 'Texto secundario',
}
const DEFAULT_COLORS: Settings['theme']['colors'] = {
  bg: '#0E0E10', surface: '#18181B', border: '#2A2A2E', gold: '#D4A24C', amber: '#F08A24', text: '#F5F5F4', muted: '#A1A1AA',
}

type TrSection = 'landing' | 'business'
const TR_FIELDS: [TrSection, string, string][] = [
  ['landing', 'headline', 'Título de portada'],
  ['landing', 'subheadline', 'Subtítulo de portada'],
  ['business', 'tagline', 'Eslogan'],
  ['business', 'location', 'Ubicación'],
  ['business', 'award', 'Reconocimiento'],
]

function trText(s: Settings, lang: Lang, section: TrSection, field: string): string {
  return (s.i18n?.[lang]?.[section] as Record<string, string> | undefined)?.[field] ?? ''
}

function setTrText(s: Settings, lang: Lang, section: TrSection, field: string, value: string): Settings {
  const i18n = { ...(s.i18n ?? {}) }
  const forLang = { ...(i18n[lang] ?? {}) }
  forLang[section] = { ...(forLang[section] ?? {}), [field]: value }
  i18n[lang] = forLang
  return { ...s, i18n }
}

export default function PageSettings() {
  const { data, run, reload } = useAdmin()
  const pub = useAppData()
  const [s, setS] = useState<Settings | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [trLang, setTrLang] = useState<Lang>('en')

  useEffect(() => { if (data && !s) setS(structuredClone(data.settings)) }, [data, s])
  // Vista previa en vivo de colores y fuentes.
  useEffect(() => { if (s) applyTheme(s.theme) }, [s])
  // Al salir sin guardar, volver al tema publicado.
  useEffect(() => () => applyTheme(pub.data?.settings.theme), []) // eslint-disable-line

  if (!s) return <div className="spinner" />

  const set = <K extends keyof Settings>(section: K, field: keyof Settings[K], value: unknown) =>
    setS({ ...s, [section]: { ...s[section], [field]: value } })

  async function save() {
    if (!s) return
    if (!/^\d{10,13}$/.test(s.contact.whatsapp.replace(/\D/g, ''))) {
      setError('El WhatsApp debe incluir el indicativo, por ejemplo 573229089680.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await run((t) => api.admin.saveSettings(t, { ...s, contact: { ...s.contact, whatsapp: s.contact.whatsapp.replace(/\D/g, '') } }))
      await reload()
      await pub.reload()
      setMsg('Cambios publicados ✓')
      window.setTimeout(() => setMsg(null), 2500)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const text = (section: 'business' | 'contact' | 'landing', field: string, label: string, placeholder?: string) => (
    <div className="field">
      <label>{label}</label>
      <input
        className="input"
        placeholder={placeholder}
        value={String((s[section] as unknown as Record<string, unknown>)[field] ?? '')}
        onChange={(e) => set(section, field as never, e.target.value)}
      />
    </div>
  )

  return (
    <>
      <div className="toolbar">
        <h1 className="grow" style={{ margin: 0 }}>Página</h1>
        {msg && <span className="saved">{msg}</span>}
        <button className="btn solid sm" onClick={() => void save()} disabled={busy}><Icon name="check" /> {busy ? 'Guardando…' : 'Publicar cambios'}</button>
      </div>
      {error && <p className="error">{error}</p>}

      <section className="card panel">
        <h2>Negocio</h2>
        <div className="form-grid">
          {text('business', 'name', 'Nombre')}
          {text('business', 'tagline', 'Eslogan')}
          {text('business', 'chef', 'Chef (usuario)')}
          {text('business', 'chef_url', 'Enlace del chef')}
          {text('business', 'location', 'Ubicación')}
          {text('business', 'award', 'Reconocimiento')}
          {text('business', 'music', 'Música (usuario)')}
          {text('business', 'music_url', 'Enlace de música')}
        </div>
      </section>

      <section className="card panel">
        <h2>Contacto y reseñas</h2>
        <div className="form-grid">
          {text('contact', 'whatsapp', 'WhatsApp de pedidos (con indicativo)', '573229089680')}
          {text('contact', 'instagram_url', 'Instagram')}
          {text('contact', 'google_review_url', 'Enlace reseña Google')}
          {text('contact', 'tripadvisor_url', 'Enlace Tripadvisor')}
          {text('contact', 'maps_url', 'Enlace Google Maps')}
        </div>
      </section>

      <section className="card panel">
        <h2>Portada (landing)</h2>
        <div className="form-grid">
          {text('landing', 'headline', 'Título')}
          {text('landing', 'subheadline', 'Subtítulo')}
        </div>
        <div className="field">
          <label>Video de portada</label>
          <ImageListEditor max={1} accept="video/mp4" label="Subir video" value={s.landing.video ? [s.landing.video] : []} onChange={(v) => set('landing', 'video', v[0] ?? '')} />
        </div>
        <div className="field">
          <label>Galería</label>
          <ImageListEditor max={24} value={s.landing.images} onChange={(v) => set('landing', 'images', v)} />
        </div>
      </section>

      <section className="card panel">
        <h2>Traducciones de textos</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: -6 }}>Lo que escribas aquí ven los clientes que usan la app en ese idioma. Vacío = se muestra en español.</p>
        <LangTabs
          lang={trLang}
          onChange={(l) => setTrLang(l === 'es' ? 'en' : l)}
          missing={(l) => TR_FIELDS.some(([sec, f]) => !!String((s[sec] as unknown as Record<string, unknown>)[f] ?? '').trim() && !trText(s, l, sec, f).trim())}
        />
        <div className="form-grid" style={{ marginTop: 12 }}>
          {TR_FIELDS.map(([sec, f, label]) => (
            <div className="field" key={sec + f}>
              <label>{label} ({trLang.toUpperCase()})</label>
              <input
                className="input"
                dir={trLang === 'ar' ? 'rtl' : 'ltr'}
                placeholder={String((s[sec] as unknown as Record<string, unknown>)[f] ?? '')}
                value={trText(s, trLang, sec, f)}
                onChange={(e) => setS(setTrText(s, trLang, sec, f, e.target.value))}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="card panel">
        <h2>Colores y fuentes</h2>
        <div className="colors">
          {(Object.keys(COLOR_LABELS) as (keyof Settings['theme']['colors'])[]).map((k) => (
            <label key={k} className="color">
              <input type="color" value={s.theme.colors[k]} onChange={(e) => setS({ ...s, theme: { ...s.theme, colors: { ...s.theme.colors, [k]: e.target.value.toUpperCase() } } })} />
              {COLOR_LABELS[k]}
            </label>
          ))}
        </div>
        <div className="form-grid" style={{ marginTop: 14 }}>
          {(['heading', 'body'] as const).map((k) => (
            <div className="field" key={k}>
              <label>{k === 'heading' ? 'Fuente de títulos' : 'Fuente del texto'}</label>
              <select className="input" value={s.theme.fonts[k]} onChange={(e) => setS({ ...s, theme: { ...s.theme, fonts: { ...s.theme.fonts, [k]: e.target.value } } })} style={{ fontFamily: s.theme.fonts[k] }}>
                {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          ))}
        </div>
        <button className="btn ghost sm" onClick={() => setS({ ...s, theme: { colors: { ...DEFAULT_COLORS }, fonts: { heading: 'Montserrat', body: 'Inter' } } })}>
          Restaurar diseño original
        </button>
        <p className="muted" style={{ fontSize: 12 }}>Ves los cambios en vivo; se publican al pulsar “Publicar cambios”.</p>
      </section>
    </>
  )
}
