import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { useAppData } from '../context/AppData'
import { api, errorMessage } from '../lib/api'
import { formatCOP, mediaUrl } from '../lib/format'
import type { Category, Menu, Product } from '../lib/types'
import { ConfirmButton } from './ConfirmButton'
import { ImageListEditor } from './ImageListEditor'
import { LangTabs, trGet, trMissing, trSet } from './LangTabs'
import { useAdmin } from './useAdmin'
import type { Lang } from '../i18n/I18n'

type ProductDraft = Omit<Product, 'id' | 'sort'> & { id?: string; sort?: number; category_id: string }
type CategoryDraft = { id?: string; menu_id: string; name: string; image: string | null; active: boolean; sort: number; i18n: Category['i18n'] }

export default function Products() {
  const { data, run, reload } = useAdmin()
  const pub = useAppData()
  const [menuId, setMenuId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ProductDraft | null>(null)
  const [catDraft, setCatDraft] = useState<CategoryDraft | null>(null)
  const [catLang, setCatLang] = useState<Lang>('es')
  // Idioma en el que se editan los textos de menús y categorías (los productos tienen sus propias pestañas).
  const [editLang, setEditLang] = useState<Lang>('es')
  const [draftLang, setDraftLang] = useState<Lang>('es')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const menus = data?.menus ?? []
  const menu = menus.find((m) => m.id === menuId) ?? menus[0]
  useEffect(() => { if (!menuId && menus[0]) setMenuId(menus[0].id) }, [menuId, menus])

  async function op(fn: (t: string) => Promise<unknown>, msg = 'Guardado ✓') {
    setError(null)
    try {
      await run(fn)
      await reload()
      void pub.reload()
      setSaved(msg)
      window.setTimeout(() => setSaved(null), 2000)
      return true
    } catch (e) {
      setError(errorMessage(e))
      return false
    }
  }

  async function saveProduct() {
    if (!draft) return
    if (!draft.name.trim() || !(draft.price >= 0)) {
      setDraftLang('es')
      setError('El producto necesita nombre y precio.')
      return
    }
    const ok = await op((t) => api.admin.upsert(t, 'products', {
      ...draft, name: draft.name.trim(), price: Math.round(draft.price), description: draft.description?.trim() || null,
    }))
    if (ok) setDraft(null)
  }

  async function saveCategory() {
    if (!catDraft) return
    if (!catDraft.name.trim()) {
      setCatLang('es')
      setError('La categoría necesita un nombre.')
      return
    }
    const ok = await op((t) => api.admin.upsert(t, 'categories', { ...catDraft, name: catDraft.name.trim() }),
      catDraft.id ? 'Categoría guardada ✓' : 'Categoría creada ✓')
    if (ok) setCatDraft(null)
  }
  const newCategory = (m: Menu) => {
    setCatLang('es')
    setCatDraft({ menu_id: m.id, name: '', image: null, active: true, sort: m.categories.length + 1, i18n: {} })
  }
  const editCategory = (c: Category, m: Menu) => {
    setCatLang(editLang)
    setCatDraft({ id: c.id, menu_id: c.menu_id ?? m.id, name: c.name, image: c.image, active: c.active !== false, sort: c.sort, i18n: c.i18n ?? {} })
  }
  const toggleCategory = (c: Category) =>
    op((t) => api.admin.upsert(t, 'categories', { id: c.id, active: c.active === false }),
      c.active === false ? 'Categoría activada ✓' : 'Categoría suspendida')

  const saveMenu = (m: Menu, patch: Partial<Menu>) =>
    op((t) => api.admin.upsert(t, 'menus', { id: m.id, ...patch }))
  /** Guarda un texto en el idioma de edición: campo base (es) o dentro de i18n. */
  const saveText = <T extends Menu | Category>(table: 'menus' | 'categories', obj: T, field: string, value: string) => {
    const next = trSet(obj, field, editLang, value)
    return op((t) => api.admin.upsert(t, table, editLang === 'es' ? { id: obj.id, [field]: value } : { id: obj.id, i18n: next.i18n ?? {} }))
  }
  const moveCategory = (cats: Category[], i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= cats.length) return
    void op(async (t) => {
      await api.admin.upsert(t, 'categories', { id: cats[i].id, sort: j + 1 })
      await api.admin.upsert(t, 'categories', { id: cats[j].id, sort: i + 1 })
    }, 'Orden actualizado ✓')
  }

  if (!data) return <div className="spinner" />

  return (
    <>
      <div className="toolbar">
        <h1 className="grow" style={{ margin: 0 }}>Menús y productos</h1>
        {saved && <span className="saved">{saved}</span>}
        {menu && (
          <button className="btn solid sm" onClick={() => newCategory(menu)}>
            <Icon name="plus" /> Categoría
          </button>
        )}
        <button className="btn ghost sm" onClick={() => void op((t) => api.admin.upsert(t, 'menus', { name: 'Nuevo menú', sort: menus.length + 1 }), 'Menú creado ✓')}>
          <Icon name="plus" /> Menú
        </button>
      </div>
      <div className="seg" style={{ marginBottom: 14 }}>
        {menus.map((m) => (
          <button key={m.id} className={m.id === menu?.id ? 'on' : ''} onClick={() => setMenuId(m.id)}>{m.name}{m.active === false ? ' (oculto)' : ''}</button>
        ))}
      </div>
      <div className="toolbar" style={{ marginBottom: 10 }}>
        <span className="muted" style={{ fontSize: 13 }}>Idioma de los textos:</span>
        <LangTabs
          lang={editLang}
          onChange={setEditLang}
          missing={(l) => !!menu && [menu, ...menu.categories].some((o) => trMissing(o as never, ['name'], l))}
        />
      </div>
      {editLang !== 'es' && <p className="muted" style={{ fontSize: 12, marginTop: -4 }}>Editando la traducción. Si un campo queda vacío, los clientes ven el texto en español.</p>}
      {error && <p className="error">{error}</p>}

      {menu && (
        <div className="card panel" key={menu.id + editLang}>
          <h2>Menú: {menu.name}</h2>
          <div className="form-grid">
            <div className="field"><label>Nombre</label><input className="input" placeholder={editLang !== 'es' ? menu.name : undefined} defaultValue={trGet(menu as never, 'name', editLang)} onBlur={(e) => e.target.value !== trGet(menu as never, 'name', editLang) && (editLang !== 'es' || e.target.value.trim()) && void saveText('menus', menu, 'name', e.target.value)} /></div>
            <div className="field"><label>Subtítulo</label><input className="input" placeholder={editLang !== 'es' ? (menu.subtitle ?? '') : undefined} defaultValue={trGet(menu as never, 'subtitle', editLang)} onBlur={(e) => e.target.value !== trGet(menu as never, 'subtitle', editLang) && void saveText('menus', menu, 'subtitle', e.target.value)} /></div>
            <div className="field"><label>Se muestra primero desde</label><input className="input" type="time" defaultValue={menu.start_time} onBlur={(e) => e.target.value !== menu.start_time && void saveMenu(menu, { start_time: e.target.value })} /></div>
            <div className="field"><label>hasta</label><input className="input" type="time" defaultValue={menu.end_time} onBlur={(e) => e.target.value !== menu.end_time && void saveMenu(menu, { end_time: e.target.value })} /></div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <label className="switch"><input type="checkbox" checked={menu.active !== false} onChange={(e) => void saveMenu(menu, { active: e.target.checked })} /> Visible</label>
            <span className="grow" />
            <ConfirmButton label="Eliminar menú" onConfirm={() => void op((t) => api.admin.remove(t, 'menus', menu.id), 'Menú eliminado').then(() => setMenuId(null))} />
          </div>
        </div>
      )}

      {menu?.categories.map((c, i, cats) => (
        <div className={`card cat-block${c.active === false ? ' cat-off' : ''}`} key={c.id + editLang}>
          <div className="cat-block-head">
            <span className="cat-thumb">{c.image ? <img src={mediaUrl(c.image)} alt="" /> : <Icon name="menu" />}</span>
            <input className="input" placeholder={editLang !== 'es' ? c.name : undefined} defaultValue={trGet(c as never, 'name', editLang)} onBlur={(e) => e.target.value !== trGet(c as never, 'name', editLang) && (editLang !== 'es' || e.target.value.trim()) && void saveText('categories', c, 'name', e.target.value.trim())} aria-label="Nombre de la categoría" />
            <button className="mini" onClick={() => moveCategory(cats, i, -1)} aria-label="Subir"><Icon name="arrowLeft" style={{ transform: 'rotate(90deg)' }} /></button>
            <button className="mini" onClick={() => moveCategory(cats, i, 1)} aria-label="Bajar"><Icon name="arrowRight" style={{ transform: 'rotate(90deg)' }} /></button>
          </div>
          <div className="cat-actions">
            {c.active === false && <span className="status cancelado">Suspendida · no sale en la carta</span>}
            <span className="muted" style={{ fontSize: 12 }}>{c.products.length} productos</span>
            <span className="grow" />
            <button className="btn ghost sm" onClick={() => editCategory(c, menu)}><Icon name="edit" /> Editar</button>
            <button className={`btn sm ${c.active === false ? 'solid' : 'ghost'}`} onClick={() => void toggleCategory(c)}>
              {c.active === false ? <><Icon name="check" /> Activar</> : <><Icon name="lock" /> Suspender</>}
            </button>
            <ConfirmButton
              label={c.products.length ? `Eliminar categoría y sus ${c.products.length} productos` : 'Eliminar categoría'}
              onConfirm={() => void op((t) => api.admin.remove(t, 'categories', c.id), 'Categoría eliminada')}
            />
          </div>
          {c.products.map((p) => (
            <div key={p.id} className={`list-item${p.active === false ? ' off' : ''}`}>
              <div className="thumb">{p.images[0] ? <img src={mediaUrl(p.images[0])} alt="" /> : null}</div>
              <div className="txt">
                <strong>{trGet(p as never, 'name', editLang) || p.name} {p.featured ? '⭐' : ''}</strong>
                <small>{formatCOP(p.price)} · {p.images.length} fotos{p.active === false ? ' · oculto' : ''}</small>
              </div>
              <button className="mini" onClick={() => { setDraftLang(editLang); setDraft({ ...p, category_id: c.id, description: p.description ?? '' }) }} aria-label={`Editar ${p.name}`}><Icon name="edit" /></button>
              <ConfirmButton onConfirm={() => void op((t) => api.admin.remove(t, 'products', p.id), 'Producto eliminado')} />
            </div>
          ))}
          <div style={{ padding: 12 }}>
            <button className="btn sm" onClick={() => { setDraftLang('es'); setDraft({ category_id: c.id, name: '', description: '', price: 0, images: [], featured: false, active: true, sort: c.products.length + 1, i18n: {} }) }}>
              <Icon name="plus" /> Producto
            </button>
          </div>
        </div>
      ))}

      {menu && (
        <button className="btn block cat-add" onClick={() => newCategory(menu)}>
          <Icon name="plus" /> Nueva categoría en “{menu.name}”
        </button>
      )}

      <AnimatePresence>
        {catDraft && (
          <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCatDraft(null)}>
            <motion.div className="sheet" onClick={(e) => e.stopPropagation()} initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }}>
              <div className="grab" />
              <h2>{catDraft.id ? 'Editar categoría' : 'Nueva categoría'}</h2>
              <LangTabs lang={catLang} onChange={setCatLang} missing={(l) => trMissing(catDraft as never, ['name'], l)} />
              <div className="field" style={{ marginTop: 12 }}>
                <label>Nombre{catLang !== 'es' ? ` (${catLang.toUpperCase()})` : ''}</label>
                <input
                  className="input" dir={catLang === 'ar' ? 'rtl' : 'ltr'} autoFocus maxLength={60}
                  placeholder={catLang !== 'es' ? catDraft.name : 'Ej. Postres'}
                  value={trGet(catDraft as never, 'name', catLang)}
                  onChange={(e) => setCatDraft(trSet(catDraft, 'name', catLang, e.target.value))}
                />
              </div>
              <div className="field">
                <label>Menú</label>
                <select className="input" value={catDraft.menu_id} onChange={(e) => setCatDraft({ ...catDraft, menu_id: e.target.value })}>
                  {menus.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Imagen del círculo (opcional)</label>
                <ImageListEditor value={catDraft.image ? [catDraft.image] : []} onChange={(imgs) => setCatDraft({ ...catDraft, image: imgs[imgs.length - 1] ?? null })} />
              </div>
              <label className="switch">
                <input type="checkbox" checked={catDraft.active} onChange={(e) => setCatDraft({ ...catDraft, active: e.target.checked })} />
                {catDraft.active ? 'Activa: se muestra en la carta' : 'Suspendida: oculta en la carta y no se puede pedir'}
              </label>
              {error && <p className="error">{error}</p>}
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button className="btn solid" onClick={() => void saveCategory()}><Icon name="check" /> Guardar</button>
                <button className="btn ghost" onClick={() => setCatDraft(null)}>Cancelar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {draft && (
          <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDraft(null)}>
            <motion.div className="sheet" onClick={(e) => e.stopPropagation()} initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }}>
              <div className="grab" />
              <h2>{draft.id ? 'Editar producto' : 'Nuevo producto'}</h2>
              <LangTabs lang={draftLang} onChange={setDraftLang} missing={(l) => trMissing(draft as never, ['name', 'description'], l)} />
              <div className="field" style={{ marginTop: 12 }}>
                <label>Nombre{draftLang !== 'es' ? ` (${draftLang.toUpperCase()})` : ''}</label>
                <input className="input" dir={draftLang === 'ar' ? 'rtl' : 'ltr'} placeholder={draftLang !== 'es' ? draft.name : undefined} value={trGet(draft as never, 'name', draftLang)} onChange={(e) => setDraft(trSet(draft, 'name', draftLang, e.target.value))} autoFocus />
              </div>
              <div className="field">
                <label>Descripción{draftLang !== 'es' ? ` (${draftLang.toUpperCase()})` : ''}</label>
                <textarea className="input" dir={draftLang === 'ar' ? 'rtl' : 'ltr'} placeholder={draftLang !== 'es' ? (draft.description ?? '') : undefined} value={trGet(draft as never, 'description', draftLang)} onChange={(e) => setDraft(trSet(draft, 'description', draftLang, e.target.value))} />
              </div>
              <div className="form-grid">
                <div className="field"><label>Precio (COP)</label><input className="input" type="number" min={0} step={500} value={draft.price} onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })} /></div>
                <div className="field">
                  <label>Categoría</label>
                  <select className="input" value={draft.category_id} onChange={(e) => setDraft({ ...draft, category_id: e.target.value })}>
                    {menus.map((m) => (
                      <optgroup key={m.id} label={m.name}>
                        {m.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field"><label>Fotos</label><ImageListEditor value={draft.images} onChange={(images) => setDraft({ ...draft, images })} /></div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <label className="switch"><input type="checkbox" checked={draft.active !== false} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Visible</label>
                <label className="switch"><input type="checkbox" checked={draft.featured} onChange={(e) => setDraft({ ...draft, featured: e.target.checked })} /> Destacado</label>
              </div>
              {error && <p className="error">{error}</p>}
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button className="btn solid" onClick={() => void saveProduct()}><Icon name="check" /> Guardar</button>
                <button className="btn ghost" onClick={() => setDraft(null)}>Cancelar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
