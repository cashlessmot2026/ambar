import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { Icon } from '../components/Icon'
import { useAppData } from '../context/AppData'
import { api, errorMessage } from '../lib/api'
import { mediaUrl } from '../lib/format'
import type { Reward } from '../lib/types'
import { ConfirmButton } from './ConfirmButton'
import { ImageListEditor } from './ImageListEditor'
import { LangTabs, trGet, trMissing, trSet } from './LangTabs'
import { useAdmin } from './useAdmin'
import type { Lang } from '../i18n/I18n'

type Draft = Partial<Reward> & { name: string; stars_required: number }
const EMPTY: Draft = { name: '', description: '', stars_required: 5, image: null, active: true }

export default function Rewards() {
  const { data, run, reload } = useAdmin()
  const pub = useAppData()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [draftLang, setDraftLang] = useState<Lang>('es')

  async function save() {
    if (!draft) return
    if (!draft.name.trim() || draft.stars_required < 1) {
      setDraftLang('es')
      setError('Escribe un nombre y al menos 1 estrella.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await run((t) => api.admin.upsert(t, 'rewards', { ...draft, name: draft.name.trim(), stars_required: Math.round(draft.stars_required) }))
      setDraft(null)
      await reload()
      void pub.reload()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    try {
      await run((t) => api.admin.remove(t, 'rewards', id))
      await reload()
      void pub.reload()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <>
      <div className="toolbar">
        <h1 className="grow" style={{ margin: 0 }}>Premios</h1>
        <motion.button className="btn solid sm" whileTap={{ scale: 0.95 }} onClick={() => { setDraftLang('es'); setDraft({ ...EMPTY, i18n: {} }) }}><Icon name="plus" /> Nuevo premio</motion.button>
      </div>
      <p className="muted" style={{ fontSize: 13, marginTop: -6 }}>
        Cada visita escaneada suma 1 estrella. Al canjear un premio (escaneando de nuevo el QR/NFC) las estrellas del cliente vuelven a 0.
      </p>
      {error && <p className="error">{error}</p>}

      <AnimatePresence>
        {draft && (
          <motion.div className="card panel" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <h2>{draft.id ? 'Editar premio' : 'Nuevo premio'}</h2>
            <LangTabs lang={draftLang} onChange={setDraftLang} missing={(l) => trMissing(draft as never, ['name', 'description'], l)} />
            <div className="form-grid" style={{ marginTop: 12 }}>
              <div className="field"><label>Nombre{draftLang !== 'es' ? ` (${draftLang.toUpperCase()})` : ''}</label><input className="input" dir={draftLang === 'ar' ? 'rtl' : 'ltr'} value={trGet(draft as never, 'name', draftLang)} onChange={(e) => setDraft(trSet(draft, 'name', draftLang, e.target.value))} placeholder={draftLang === 'es' ? 'Ej: Postre de la casa' : draft.name} /></div>
              <div className="field"><label>Estrellas necesarias</label><input className="input" type="number" min={1} max={100} value={draft.stars_required} onChange={(e) => setDraft({ ...draft, stars_required: Number(e.target.value) })} /></div>
            </div>
            <div className="field"><label>Descripción{draftLang !== 'es' ? ` (${draftLang.toUpperCase()})` : ''}</label><input className="input" dir={draftLang === 'ar' ? 'rtl' : 'ltr'} placeholder={draftLang !== 'es' ? (draft.description ?? '') : undefined} value={trGet(draft as never, 'description', draftLang)} onChange={(e) => setDraft(trSet(draft, 'description', draftLang, e.target.value))} /></div>
            <div className="field"><label>Imagen</label><ImageListEditor max={1} value={draft.image ? [draft.image] : []} onChange={(v) => setDraft({ ...draft, image: v[0] ?? null })} label="Subir imagen" /></div>
            <label className="switch"><input type="checkbox" checked={draft.active !== false} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Activo</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button className="btn solid sm" onClick={() => void save()} disabled={busy}><Icon name="check" /> Guardar</button>
              <button className="btn ghost sm" onClick={() => setDraft(null)}>Cancelar</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!data && <div className="spinner" />}
      {data && data.rewards.length === 0 && <div className="empty"><Icon name="gift" /><p>Aún no hay premios.</p></div>}
      {data && data.rewards.length > 0 && (
        <div className="card">
          {data.rewards.map((r) => (
            <div key={r.id} className={`list-item${r.active === false ? ' off' : ''}`}>
              <div className="thumb">{r.image ? <img src={mediaUrl(r.image)} alt="" /> : <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--gold)' }}><Icon name="gift" style={{ width: 24 }} /></div>}</div>
              <div className="txt">
                <strong>{r.name}</strong>
                <small>{r.stars_required} ★ {r.active === false ? '· inactivo' : ''} {r.description ? `· ${r.description}` : ''}</small>
              </div>
              <button className="mini" onClick={() => setDraft({ ...r, description: r.description ?? '' })} aria-label="Editar"><Icon name="edit" /></button>
              <ConfirmButton onConfirm={() => void remove(r.id)} />
            </div>
          ))}
        </div>
      )}
    </>
  )
}
