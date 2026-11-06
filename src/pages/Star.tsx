import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { RegisterModal } from '../components/RegisterModal'
import { useCustomer } from '../context/Customer'
import { ApiError, api, errorMessage } from '../lib/api'
import { fireworks } from '../lib/celebrate'
import type { ClaimResult } from '../lib/types'

type State =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'done'; result: ClaimResult }
  | { kind: 'error'; message: string }

/** Ruta abierta por el QR o el tag NFC del negocio: /#/estrella?k=<clave>. */
export default function Star() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const key = params.get('k')
  const { customer, token, ready, setCustomer, refresh, logout } = useCustomer()
  const [state, setState] = useState<State>({ kind: 'idle' })
  const [registerOpen, setRegisterOpen] = useState(false)
  // Evita reclamar dos veces el mismo escaneo (doble efecto de StrictMode). Al terminar, la clave
  // se quita de la URL, así que un escaneo nuevo (URL con ?k otra vez) vuelve a reclamar aunque
  // esta pantalla siga abierta.
  const inFlight = useRef(false)
  const scanId = location.key + location.search

  async function claim(t: string) {
    if (!key || inFlight.current) return
    inFlight.current = true
    setState({ kind: 'working' })
    try {
      const result = await api.claimStar(t, key)
      // Quitar la clave de la URL para que recargar no vuelva a sumar.
      navigate('/estrella', { replace: true })
      setState({ kind: 'done', result })
      fireworks(result.action === 'redeem' ? 4500 : 3200)
      void refresh()
    } catch (e) {
      if (e instanceof ApiError && e.code === 'invalid_token') {
        // Se conserva ?k para reclamar tras el nuevo registro.
        logout()
        setRegisterOpen(true)
        setState({ kind: 'idle' })
        return
      }
      navigate('/estrella', { replace: true })
      setState({ kind: 'error', message: errorMessage(e) })
    } finally {
      inFlight.current = false
    }
  }

  useEffect(() => {
    if (!ready || !key) return
    if (customer && token) void claim(token)
    else setRegisterOpen(true)
  }, [ready, key, scanId, customer, token])

  if (state.kind === 'done') {
    const r = state.result
    return (
      <div className="page claim">
        <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 12 }}>
          {r.action === 'redeem' ? <Icon name="gift" className="big-star" /> : <Icon name="star" filled className="big-star" />}
        </motion.div>
        {r.action === 'redeem' ? (
          <>
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>¡Premio canjeado!</motion.h1>
            <p style={{ fontSize: 18 }}>Disfruta tu <strong className="gold">{r.reward.name}</strong> 🎉</p>
            <p className="muted">Muestra esta pantalla al personal. Tu tarjeta vuelve a empezar.</p>
          </>
        ) : (
          <>
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>+1 estrella</motion.h1>
            <p style={{ fontSize: 18 }}>¡Gracias por visitarnos{customer ? `, ${customer.name.split(' ')[0]}` : ''}!</p>
            <p className="muted">Ahora tienes <strong className="gold">{r.stars}</strong> {r.stars === 1 ? 'estrella' : 'estrellas'}.</p>
          </>
        )}
        <Link to="/tarjeta" className="btn solid" style={{ marginTop: 12 }}><Icon name="card" /> Ver mi tarjeta</Link>
      </div>
    )
  }

  return (
    <div className="page claim">
      {!key ? (
        <>
          <Icon name="qr" style={{ width: 80, height: 80, color: 'var(--gold)' }} />
          <h1>Escanea en Ámbar</h1>
          <p className="muted">Para sumar una estrella escanea el QR o acerca tu celular al tag NFC del restaurante.</p>
          <Link to="/tarjeta" className="btn">Ver mi tarjeta</Link>
        </>
      ) : state.kind === 'error' ? (
        <>
          <Icon name="x" style={{ width: 70, height: 70, color: 'var(--danger)' }} />
          <h1>Algo salió mal</h1>
          <p className="muted">{state.message}</p>
          <Link to="/tarjeta" className="btn">Ver mi tarjeta</Link>
        </>
      ) : (
        <>
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}>
            <Icon name="star" filled style={{ width: 80, height: 80, color: 'var(--gold)' }} />
          </motion.div>
          <h1>Sumando tu estrella…</h1>
          {ready && !customer && (
            <>
              <p className="muted">Primero crea tu Tarjeta Ámbar.</p>
              {!registerOpen && (
                <motion.button className="btn solid" whileTap={{ scale: 0.95 }} onClick={() => setRegisterOpen(true)}>
                  <Icon name="star" /> Crear mi tarjeta
                </motion.button>
              )}
            </>
          )}
        </>
      )}
      <RegisterModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        reason="Crea tu Tarjeta Ámbar para recibir tu estrella."
        onDone={(c) => {
          setRegisterOpen(false)
          setCustomer(c)
        }}
      />
    </div>
  )
}
