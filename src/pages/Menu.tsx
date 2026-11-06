import { motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { ProductCard, ProductRow } from '../components/ProductCard'
import { TopBar } from '../components/TopBar'
import { useAppData } from '../context/AppData'
import { mediaUrl } from '../lib/format'
import { isMenuActiveAt, orderMenus } from '../lib/menuPriority'
import type { Category } from '../lib/types'

const EMOJI: [RegExp, string][] = [
  [/huevo/i, '🍳'], [/tostad/i, '🥑'], [/s[aá]ndwich/i, '🥪'], [/combo/i, '🍽️'], [/adici/i, '➕'],
  [/bebida|jugo/i, '🧃'], [/entrada/i, '🥟'], [/steak/i, '🥩'], [/picada/i, '🍖'], [/burger|hamburg/i, '🍔'],
  [/kid/i, '🧒'], [/mexican|taco/i, '🌮'], [/cerveza/i, '🍺'], [/soda/i, '🥤'], [/gaseosa/i, '🥤'],
  [/c[oó]ctel/i, '🍹'], [/postre/i, '🍰'], [/vino/i, '🍷'],
]
const emojiFor = (name: string) => EMOJI.find(([re]) => re.test(name))?.[1] ?? '🍴'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function Menu() {
  const { data, loading } = useAppData()
  const [params] = useSearchParams()
  const highlight = params.get('p')
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const menus = useMemo(() => orderMenus(data?.menus ?? [], now), [data, now])
  const [slug, setSlug] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [activeCat, setActiveCat] = useState<string | null>(null)

  // Si llega ?p=<producto>, abrir el menú que lo contiene.
  const highlightMenu = useMemo(
    () => (highlight ? menus.find((m) => m.categories.some((c) => c.products.some((p) => p.id === highlight)))?.slug : undefined),
    [highlight, menus],
  )
  const current = menus.find((m) => m.slug === (slug ?? highlightMenu)) ?? menus[0]

  useEffect(() => {
    if (!highlight) return
    const t = window.setTimeout(() => document.getElementById(`p-${highlight}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 350)
    return () => window.clearTimeout(t)
  }, [highlight, current?.slug])

  const categories: Category[] = useMemo(() => {
    if (!current) return []
    const term = norm(q.trim())
    if (!term) return current.categories.filter((c) => c.products.length > 0)
    return current.categories
      .map((c) => ({ ...c, products: c.products.filter((p) => norm(`${p.name} ${p.description ?? ''} ${c.name}`).includes(term)) }))
      .filter((c) => c.products.length > 0)
  }, [current, q])

  if (!data) return <><TopBar title="MENÚ" />{loading ? <div className="spinner" /> : <div className="empty">No pudimos cargar el menú.</div>}</>

  return (
    <>
      <TopBar title="MENÚ" />
      <div className="page">
        <div className="menu-head">
          <div className="tabs" role="tablist">
            {menus.map((m) => {
              const on = m.slug === current?.slug
              return (
                <button key={m.id} role="tab" aria-selected={on} className={on ? 'on' : ''} onClick={() => { setSlug(m.slug); setActiveCat(null); window.scrollTo({ top: 0 }) }}>
                  {on && <motion.span layoutId="menu-tab" className="tab-bg" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
                  <span>
                    {isMenuActiveAt(m, now) && <i className="now-dot" title="Disponible ahora" />}
                    {m.name}
                  </span>
                </button>
              )
            })}
          </div>
          {current?.subtitle && <div className="menu-sub">{isMenuActiveAt(current, now) ? 'Disponible ahora · ' : ''}{current.subtitle}</div>}
          <label className="search">
            <input className="input" placeholder="Buscar platos, bebidas…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar en el menú" />
            <Icon name="search" />
          </label>
          {!q && (
            <div className="chips">
              {categories.map((c) => (
                <motion.button
                  key={c.id}
                  className={`chip${activeCat === c.id ? ' on' : ''}`}
                  whileTap={{ scale: 0.9 }}
                  whileHover={{ scale: 1.06 }}
                  onClick={() => {
                    setActiveCat(c.id)
                    document.getElementById(`c-${c.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                >
                  <span className="circle">{c.image ? <img src={mediaUrl(c.image)} alt="" /> : emojiFor(c.name)}</span>
                  {c.name}
                </motion.button>
              ))}
            </div>
          )}
        </div>

        {categories.length === 0 && (
          <div className="empty"><Icon name="search" /><p>No encontramos “{q}”.</p></div>
        )}

        {categories.map((c) => {
          const visual = c.products.some((p) => p.images.length > 0) || c.products.some((p) => (p.description ?? '').length > 60)
          return (
            <section key={c.id}>
              <div className="cat-title" id={`c-${c.id}`}>
                <h2>{c.name}</h2>
              </div>
              {visual ? (
                <div className="grid">
                  {c.products.map((p) => <ProductCard key={p.id} product={p} highlight={p.id === highlight} />)}
                </div>
              ) : (
                <div className="rows">
                  {c.products.map((p) => <ProductRow key={p.id} product={p} highlight={p.id === highlight} />)}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </>
  )
}
