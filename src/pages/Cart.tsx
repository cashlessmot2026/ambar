import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { PlaceholderArt } from '../components/PlaceholderArt'
import { RegisterModal } from '../components/RegisterModal'
import { TopBar } from '../components/TopBar'
import { useAppData } from '../context/AppData'
import { useCart } from '../context/Cart'
import { useCustomer } from '../context/Customer'
import { ApiError, api, errorMessage } from '../lib/api'
import { formatCOP, mediaUrl } from '../lib/format'
import type { Customer, Product } from '../lib/types'
import { buildWhatsAppUrl } from '../lib/whatsapp'

export const LAST_ORDER_KEY = 'ambar:last-order'

export default function Cart() {
  const { items, setQty, remove, clear } = useCart()
  const { data, reload } = useAppData()
  const { customer, token, logout } = useCustomer()
  const navigate = useNavigate()
  const [notes, setNotes] = useState('')
  const [registerOpen, setRegisterOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Precios y disponibilidad siempre desde los datos actuales del menú.
  const catalog = useMemo(() => {
    const map = new Map<string, Product>()
    data?.menus.forEach((m) => m.categories.forEach((c) => c.products.forEach((p) => map.set(p.id, p))))
    return map
  }, [data])
  const lines = items.map((i) => {
    const p = catalog.get(i.product_id)
    return { ...i, available: !!p || !data, price: p?.price ?? i.price, name: p?.name ?? i.name, image: p?.images[0] ?? i.image }
  })
  const unavailable = lines.filter((l) => !l.available)
  const total = lines.filter((l) => l.available).reduce((n, l) => n + l.price * l.qty, 0)

  async function placeOrder(c: Customer, t: string) {
    setBusy(true)
    setError(null)
    // Abrimos la ventana en el mismo gesto del usuario para que el navegador no la bloquee.
    const win = window.open('about:blank', '_blank')
    try {
      const order = await api.placeOrder(t, lines.filter((l) => l.available).map((l) => ({ product_id: l.product_id, qty: l.qty })), notes)
      const url = buildWhatsAppUrl(data?.settings.contact.whatsapp ?? '573229089680', order, c)
      try { sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify({ order, url })) } catch { /* sin almacenamiento */ }
      if (win) win.location.href = url
      clear()
      navigate('/gracias')
    } catch (e) {
      win?.close()
      if (e instanceof ApiError && e.code === 'invalid_token') {
        logout()
        setRegisterOpen(true)
      }
      if (e instanceof ApiError && e.code === 'product_unavailable') void reload()
      setError(errorMessage(e))
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

  if (items.length === 0) {
    return (
      <>
        <TopBar title="PEDIDO" />
        <div className="page empty">
          <Icon name="bag" />
          <h2 style={{ fontSize: 18, marginBottom: 6 }}>Tu pedido está vacío</h2>
          <p>Explora el menú y agrega tus favoritos.</p>
          <Link to="/menu" className="btn solid" style={{ marginTop: 12 }}><Icon name="menu" /> Ver menú</Link>
        </div>
      </>
    )
  }

  return (
    <>
      <TopBar title="PEDIDO" />
      <div className="page">
        <div className="section-title" style={{ marginTop: 18 }}>
          <h2>Tu pedido</h2>
          <button onClick={clear}>Vaciar</button>
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
                exit={{ opacity: 0, x: -60 }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={{ left: 0.5, right: 0 }}
                onDragEnd={(_, info) => { if (info.offset.x < -100) remove(l.product_id) }}
              >
                <div className="thumb">{l.image ? <img src={mediaUrl(l.image)} alt="" /> : <PlaceholderArt />}</div>
                <div className="txt">
                  <h3>{l.name}</h3>
                  <span className={l.available ? 'gold' : 'error'} style={{ fontSize: 13, fontWeight: 700 }}>
                    {l.available ? formatCOP(l.price * l.qty) : 'No disponible'}
                  </span>
                </div>
                <div className="qty">
                  <motion.button whileTap={{ scale: 0.85 }} onClick={() => setQty(l.product_id, l.qty - 1)} aria-label="Quitar uno"><Icon name="minus" /></motion.button>
                  <span>{l.qty}</span>
                  <motion.button whileTap={{ scale: 0.85 }} onClick={() => setQty(l.product_id, l.qty + 1)} aria-label="Agregar uno" disabled={!l.available}><Icon name="plus" /></motion.button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <p className="muted" style={{ fontSize: 12, textAlign: 'center' }}>Desliza un producto a la izquierda para quitarlo.</p>
        {unavailable.length > 0 && (
          <p className="error">Algunos productos ya no están disponibles y no se incluirán en el pedido.</p>
        )}

        <div className="field" style={{ marginTop: 18 }}>
          <label htmlFor="notes">Notas para la cocina</label>
          <textarea id="notes" className="input" placeholder="Término de la carne, sin cebolla, mesa…" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
        </div>

        {customer && (
          <div className="card who">
            <span className="ico"><Icon name="pin" /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong>{customer.name}</strong>
              <div className="muted" style={{ fontSize: 13 }}>{customer.address} · {customer.phone}</div>
            </div>
            <button className="gold" style={{ fontSize: 13, fontWeight: 600 }} onClick={() => setRegisterOpen(true)}>Editar</button>
          </div>
        )}

        <div className="card summary" style={{ marginTop: 14 }}>
          <span className="muted upper" style={{ fontSize: 12, fontWeight: 700 }}>Total</span>
          <strong>{formatCOP(total)}</strong>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <motion.button
          className="btn solid block"
          style={{ marginTop: 14, height: 54 }}
          whileTap={{ scale: 0.96 }}
          whileHover={{ scale: 1.02 }}
          onClick={onConfirm}
          disabled={busy || total === 0}
        >
          <Icon name="whatsapp" /> {busy ? 'Enviando…' : customer ? 'Confirmar pedido' : 'Regístrate y pide'}
        </motion.button>
        <p className="muted" style={{ fontSize: 12, textAlign: 'center' }}>Tu pedido llega al restaurante y se abre WhatsApp para confirmarlo.</p>
      </div>

      <RegisterModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        reason="Para hacer tu pedido regístrate con tu nombre, dirección y teléfono."
        onDone={() => setRegisterOpen(false)}
      />
    </>
  )
}
