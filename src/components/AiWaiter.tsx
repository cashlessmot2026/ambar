import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppData } from '../context/AppData'
import { useCart } from '../context/Cart'
import { errKey, localized, useI18n } from '../i18n/I18n'
import { api } from '../lib/api'
import { formatCOP, mediaUrl } from '../lib/format'
import { isOrderingEnabled } from '../lib/ordering'
import { dailyPick } from '../lib/recommend'
import type { Product } from '../lib/types'
import { Icon } from './Icon'
import { PlaceholderArt } from './PlaceholderArt'
import { useToast } from './Toast'

interface Msg { role: 'user' | 'model'; text: string; products?: string[]; error?: boolean }

const KEY = 'ambar:ai-chat'
const load = (): Msg[] => {
  try { return JSON.parse(sessionStorage.getItem(KEY) ?? '[]') as Msg[] } catch { return [] }
}

/** Botón flotante "Tu mesero IA" (Gemini vía Edge Function `mesero-ia`). */
export function AiWaiter() {
  const { data } = useAppData()
  const { items, add, count } = useCart()
  const { t, lang } = useI18n()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>(load)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef<HTMLDivElement>(null)

  const catalog = useMemo(() => {
    const map = new Map<string, Product>()
    data?.menus.forEach((m) => m.categories.forEach((c) => c.products.forEach((p) => map.set(p.id, p))))
    return map
  }, [data])
  const pick = useMemo(() => dailyPick([...catalog.values()]), [catalog])
  const canOrder = isOrderingEnabled(data?.settings)

  useEffect(() => { try { sessionStorage.setItem(KEY, JSON.stringify(msgs.slice(-30))) } catch { /* sin almacenamiento */ } }, [msgs])
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [msgs, busy, open])

  async function send(q: string) {
    const question = q.trim()
    if (!question || busy) return
    const history: Msg[] = [...msgs.filter((m) => !m.error), { role: 'user', text: question }]
    setMsgs((m) => [...m, { role: 'user', text: question }])
    setText('')
    setBusy(true)
    try {
      const res = await api.askWaiter(
        history.map(({ role, text }) => ({ role, text })),
        items.map((i) => ({ product_id: i.product_id, qty: i.qty })),
        lang,
      )
      setMsgs((m) => [...m, { role: 'model', text: res.reply, products: res.products }])
    } catch (e) {
      setMsgs((m) => [...m, { role: 'model', text: t(errKey(e)), error: true }])
    } finally {
      setBusy(false)
    }
  }

  function addProduct(p: Product) {
    add(p)
    toast(t('product.added', { name: localized(p, 'name', lang) }))
  }

  const productCard = (p: Product, badge?: string) => (
    <div key={p.id} className="ai-product">
      <div className="thumb">{p.images[0] ? <img src={mediaUrl(p.images[0])} alt="" loading="lazy" /> : <PlaceholderArt />}</div>
      <div className="txt">
        {badge && <small className="gold upper">{badge}</small>}
        <strong>{localized(p, 'name', lang)}</strong>
        <span className="gold">{formatCOP(p.price)}</span>
      </div>
      {canOrder && (
        <motion.button className="btn solid sm" whileTap={{ scale: 0.9 }} onClick={() => addProduct(p)} aria-label={t('product.addAria', { name: localized(p, 'name', lang) })}>
          <Icon name="plus" />
        </motion.button>
      )}
    </div>
  )

  if (!data) return null

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            className="ai-fab"
            onClick={() => setOpen(true)}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.06 }}
            aria-label={t('ai.button')}
          >
            <span className="ai-fab-ico">🤵</span>
            <span className="ai-fab-label">{t('ai.button')}</span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
            <motion.section
              className="sheet ai-sheet"
              role="dialog"
              aria-label={t('ai.button')}
              onClick={(e) => e.stopPropagation()}
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            >
              <header className="ai-head">
                <span className="ai-avatar">🤵</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2>{t('ai.button')}</h2>
                  <small className="muted">{t('ai.subtitle')}</small>
                </div>
                <button className="icon-btn" onClick={() => setOpen(false)} aria-label={t('common.close')}><Icon name="x" /></button>
              </header>

              <div className="ai-body">
                {pick && productCard(pick, `⭐ ${t('ai.recommended')}`)}
                <div className="ai-msg model">{t('ai.hello')}</div>
                {msgs.map((m, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                    <div className={`ai-msg ${m.role}${m.error ? ' err' : ''}`}>{m.text}</div>
                    {m.products?.map((id) => catalog.get(id)).filter((p): p is Product => !!p).map((p) => productCard(p))}
                  </motion.div>
                ))}
                {busy && <div className="ai-msg model typing"><span /><span /><span /></div>}
                <div ref={end} />
              </div>

              {msgs.length === 0 && (
                <div className="ai-quick">
                  {(['ai.quick1', 'ai.quick2', 'ai.quick3', 'ai.quick4'] as const).map((k) => (
                    <button key={k} onClick={() => void send(t(k))}>{t(k)}</button>
                  ))}
                </div>
              )}
              {count > 0 && canOrder && (
                <Link to="/pedido" className="ai-cart-link" onClick={() => setOpen(false)}>
                  <Icon name="bag" /> {t('ai.viewOrder')} ({count})
                </Link>
              )}
              <form className="ai-input" onSubmit={(e) => { e.preventDefault(); void send(text) }}>
                <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('ai.placeholder')} maxLength={500} aria-label={t('ai.placeholder')} />
                <motion.button className="btn solid" whileTap={{ scale: 0.9 }} disabled={busy || !text.trim()} aria-label={t('ai.send')}>
                  <Icon name="arrowRight" className="flip-rtl" />
                </motion.button>
              </form>
              <p className="muted ai-disclaimer">{t('ai.disclaimer')}</p>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
