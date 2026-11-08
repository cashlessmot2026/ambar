import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GpsToggle } from '../components/GpsToggle'
import { Icon } from '../components/Icon'
import { PlaceholderArt } from '../components/PlaceholderArt'
import { RegisterModal } from '../components/RegisterModal'
import { useToast } from '../components/Toast'
import { TopBar } from '../components/TopBar'
import { useAppData } from '../context/AppData'
import { useCart } from '../context/Cart'
import { useCustomer } from '../context/Customer'
import { errKey, localized, useI18n } from '../i18n/I18n'
import { ApiError, api } from '../lib/api'
import { formatCOP, mediaUrl } from '../lib/format'
import { isOrderingEnabled } from '../lib/ordering'
import { readDraft, writeDraft, type ReservationDraft } from '../lib/reservationDraft'
import type { Coords, Customer, Product } from '../lib/types'
import { buildWhatsAppUrl, DEFAULT_WHATSAPP, reservationText, waUrl } from '../lib/whatsapp'

export const LAST_ORDER_KEY = 'ambar:last-order'

/** Reserva a la que se están eligiendo platos (se actualiza si cambia en otra pestaña). */
export function useReservationDraft(): ReservationDraft | null {
  const [draft, setDraft] = useState(readDraft)
  useEffect(() => {
    const sync = () => setDraft(readDraft())
    window.addEventListener('ambar:draft', sync)
    window.addEventListener('storage', sync)
    return () => { window.removeEventListener('ambar:draft', sync); window.removeEventListener('storage', sync) }
  }, [])
  return draft
}

export default function Cart() {
  const { items, setQty, remove, clear } = useCart()
  const { data, reload } = useAppData()
  const { customer, token, logout } = useCustomer()
  const { t, lang, dir } = useI18n()
  const toast = useToast()
  const navigate = useNavigate()
  const draft = useReservationDraft()
  const [notes, setNotes] = useState('')
  const [registerOpen, setRegisterOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [coords, setCoords] = useState<Coords | null>(null)
  const whatsapp = data?.settings.contact.whatsapp ?? DEFAULT_WHATSAPP

  // Precargar la ubicación guardada en el perfil (el cliente puede quitarla o actualizarla).
  useEffect(() => {
    if (customer?.lat != null && customer?.lng != null) setCoords({ lat: customer.lat, lng: customer.lng })
  }, [customer?.lat, customer?.lng])

  // Precios y disponibilidad siempre desde los datos actuales del menú.
  const catalog = useMemo(() => {
    const map = new Map<string, Product>()
    data?.menus.forEach((m) => m.categories.forEach((c) => c.products.forEach((p) => map.set(p.id, p))))
    return map
  }, [data])
  const lines = items.map((i) => {
    const p = catalog.get(i.product_id)
    return {
      ...i,
      available: !!p || !data,
      price: p?.price ?? i.price,
      name: p ? localized(p, 'name', lang) : i.name,
      image: p?.images[0] ?? i.image,
    }
  })
  const unavailable = lines.filter((l) => !l.available)
  const total = lines.filter((l) => l.available).reduce((n, l) => n + l.price * l.qty, 0)

  async function placeOrder(c: Customer, tok: string) {
    setBusy(true)
    setError(null)
    // Abrimos la ventana en el mismo gesto del usuario para que el navegador no la bloquee.
    const win = window.open('about:blank', '_blank')
    try {
      const order = await api.placeOrder(tok, lines.filter((l) => l.available).map((l) => ({ product_id: l.product_id, qty: l.qty })), notes, coords)
      const url = buildWhatsAppUrl(whatsapp, order, c, lang)
      try { sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify({ order, url, customer: c })) } catch { /* sin almacenamiento */ }
      if (win) win.location.href = url
      clear()
      navigate('/gracias')
    } catch (e) {
      win?.close()
      if (e instanceof ApiError && e.code === 'invalid_token') {
        logout()
        setRegisterOpen(true)
      }
      if (e instanceof ApiError && (e.code === 'product_unavailable' || e.code === 'ordering_disabled')) void reload()
      setError(t(errKey(e)))
    } finally {
      setBusy(false)
    }
  }

  function onConfirm() {
    if (!customer || !token) {
      setRegisterOpen(true)
      return
    }
    void placeOrder(customer, token)
  }

  /** Adjunta los platos a la reserva y abre WhatsApp con la reserva completa. */
  async function sendToReservation(d: ReservationDraft) {
    setBusy(true)
    setError(null)
    const win = window.open('about:blank', '_blank')
    try {
      const r = await api.setReservationDishes(d.id, d.key, lines.filter((l) => l.available).map((l) => ({ product_id: l.product_id, qty: l.qty })))
      const url = waUrl(whatsapp, reservationText(r, lang))
      if (win) win.location.href = url
      clear()
      writeDraft(null)
      toast(t('res.dishesSent', { n: r.number }))
      navigate(customer ? '/cuenta' : '/')
    } catch (e) {
      win?.close()
      if (e instanceof ApiError && (e.code === 'invalid_token' || e.code === 'reservation_closed')) writeDraft(null)
      if (e instanceof ApiError && e.code === 'product_unavailable') void reload()
      setError(t(errKey(e)))
    } finally {
      setBusy(false)
    }
  }

  const draftBanner = draft && (
    <div className="card draft-banner">
      <Icon name="receipt" />
      <span style={{ flex: 1 }}>{t('res.banner', { n: draft.number })}</span>
      <button className="gold" style={{ fontSize: 12, fontWeight: 700 }} onClick={() => writeDraft(null)}>{t('res.cancelDraft')}</button>
    </div>
  )

  if (data && !isOrderingEnabled(data.settings)) {
    return (
      <>
        <TopBar title={t('cart.title')} />
        <div className="page empty">
          <Icon name="menu" />
          <h2 style={{ fontSize: 18, marginBottom: 6 }}>{t('cart.offTitle')}</h2>
          <p>{t('cart.offText')}</p>
          <Link to="/menu" className="btn solid" style={{ marginTop: 12 }}><Icon name="menu" /> {t('home.viewMenu')}</Link>
        </div>
      </>
    )
  }

  if (items.length === 0) {
    return (
      <>
        <TopBar title={t('cart.title')} />
        {draft && <div className="page" style={{ paddingBottom: 0 }}>{draftBanner}</div>}
        <div className="page empty">
          <Icon name="bag" />
          <h2 style={{ fontSize: 18, marginBottom: 6 }}>{t('cart.emptyTitle')}</h2>
          <p>{t('cart.emptyText')}</p>
          <Link to="/menu" className="btn solid" style={{ marginTop: 12 }}><Icon name="menu" /> {t('home.viewMenu')}</Link>
        </div>
      </>
    )
  }

  // Deslizar hacia el borde final (izquierda en LTR, derecha en RTL) quita el producto.
  const swipeOut = (dx: number) => (dir === 'rtl' ? dx > 100 : dx < -100)

  return (
    <>
      <TopBar title={t('cart.title')} />
      <div className="page">
        {draftBanner}
        <div className="section-title" style={{ marginTop: 18 }}>
          <h2>{t('cart.yourOrder')}</h2>
          <button onClick={clear}>{t('cart.clear')}</button>
        </div>
        <div className="card">
          <AnimatePresence initial={false}>
            {lines.map((l) => (
              <motion.div
                key={l.product_id}
                className={`line${l.available ? '' : ' off'}`}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, x: dir === 'rtl' ? 60 : -60 }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={dir === 'rtl' ? { left: 0, right: 0.5 } : { left: 0.5, right: 0 }}
                onDragEnd={(_, info) => { if (swipeOut(info.offset.x)) remove(l.product_id) }}
              >
                <div className="thumb">{l.image ? <img src={mediaUrl(l.image)} alt="" /> : <PlaceholderArt />}</div>
                <div className="txt">
                  <h3>{l.name}</h3>
                  <span className={l.available ? 'gold' : 'error'} style={{ fontSize: 13, fontWeight: 700 }}>
                    {l.available ? formatCOP(l.price * l.qty) : t('cart.unavailable')}
                  </span>
                </div>
                <div className="qty">
                  <motion.button whileTap={{ scale: 0.85 }} onClick={() => setQty(l.product_id, l.qty - 1)} aria-label={t('cart.removeOne')}><Icon name="minus" /></motion.button>
                  <span>{l.qty}</span>
                  <motion.button whileTap={{ scale: 0.85 }} onClick={() => setQty(l.product_id, l.qty + 1)} aria-label={t('cart.addOne')} disabled={!l.available}><Icon name="plus" /></motion.button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <p className="muted" style={{ fontSize: 12, textAlign: 'center' }}>{t('cart.swipeHint')}</p>
        {unavailable.length > 0 && <p className="error">{t('cart.someUnavailable')}</p>}

        <div className="field" style={{ marginTop: 18 }}>
          <label htmlFor="notes">{t('cart.notes')}</label>
          <textarea id="notes" className="input" placeholder={t('cart.notesPlaceholder')} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
        </div>

        {customer && !draft && (
          <div className="card who">
            <span className="ico"><Icon name="pin" /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong>{customer.name}</strong>
              <div className="muted" style={{ fontSize: 13 }}>{customer.address} · <span dir="ltr">{customer.phone}</span></div>
            </div>
            <Link className="gold" style={{ fontSize: 13, fontWeight: 600 }} to="/cuenta">{t('cart.edit')}</Link>
          </div>
        )}
        {!draft && (
          <div className="card" style={{ padding: '12px 16px', marginTop: 12 }}>
            <GpsToggle value={coords} onChange={setCoords} label={t('cart.gps')} hint={t('auth.gpsHint')} />
          </div>
        )}

        <div className="card summary" style={{ marginTop: 14 }}>
          <span className="muted upper" style={{ fontSize: 12, fontWeight: 700 }}>{t('cart.total')}</span>
          <strong>{formatCOP(total)}</strong>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        {draft ? (
          <motion.button
            className="btn solid block"
            style={{ marginTop: 14, height: 54 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => void sendToReservation(draft)}
            disabled={busy || total === 0}
          >
            <Icon name="whatsapp" /> {busy ? t('cart.sending') : t('res.sendDishes')}
          </motion.button>
        ) : (
          <>
            <motion.button
              className="btn solid block"
              style={{ marginTop: 14, height: 54 }}
              whileTap={{ scale: 0.96 }}
              whileHover={{ scale: 1.02 }}
              onClick={onConfirm}
              disabled={busy || total === 0}
            >
              <Icon name="whatsapp" /> {busy ? t('cart.sending') : customer ? t('cart.confirm') : t('cart.registerAndOrder')}
            </motion.button>
            <p className="muted" style={{ fontSize: 12, textAlign: 'center' }}>{t('cart.footnote')}</p>
          </>
        )}
      </div>

      <RegisterModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        reason={t('cart.registerReason')}
        onDone={() => setRegisterOpen(false)}
      />
    </>
  )
}
