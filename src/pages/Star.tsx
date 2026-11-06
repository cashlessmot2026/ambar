import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { RegisterModal } from '../components/RegisterModal'
import { useCustomer } from '../context/Customer'
import { errKey, localized, useI18n } from '../i18n/I18n'
import type { Key } from '../i18n/locales/es'
import { ApiError, api } from '../lib/api'
import { fireworks } from '../lib/celebrate'
import { haptic } from '../lib/haptics'
import type { ClaimResult } from '../lib/types'
import { useAppData } from '../context/AppData'

type State =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'done'; result: ClaimResult }
  | { kind: 'error'; key: Key }

/** Ruta abierta por el QR o el tag NFC del negocio: /#/estrella?k=<clave>. */
export default function Star() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const key = params.get('k')
  const { customer, token, ready, setCustomer, refresh, logout } = useCustomer()
  const { data } = useAppData()
  const { t, lang } = useI18n()
  const [state, setState] = useState<State>({ kind: 'idle' })
  const [registerOpen, setRegisterOpen] = useState(false)
  // Evita reclamar dos veces el mismo escaneo (doble efecto de StrictMode). Al terminar, la clave
  // se quita de la URL, así que un escaneo nuevo (URL con ?k otra vez) vuelve a reclamar aunque
  // esta pantalla siga abierta.
  const inFlight = useRef(false)
  const scanId = location.key + location.search

  async function claim(tok: string) {
    if (!key || inFlight.current) return
    inFlight.current = true
    setState({ kind: 'working' })
    try {
      const result = await api.claimStar(tok, key)
      // Quitar la clave de la URL para que recargar no vuelva a sumar.
      navigate('/estrella', { replace: true })
      setState({ kind: 'done', result })
      haptic(40)
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
      setState({ kind: 'error', key: errKey(e) })
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
    // El nombre del premio, en el idioma del cliente si está traducido.
    const reward = r.action === 'redeem' ? data?.rewards.find((x) => x.id === r.reward.id) : undefined
    const rewardName = r.action === 'redeem' ? (reward ? localized(reward, 'name', lang) : r.reward.name) : ''
    const first = customer?.name.split(' ')[0]
    return (
      <div className="page claim">
        <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 12 }}>
          {r.action === 'redeem' ? <Icon name="gift" className="big-star" /> : <Icon name="star" filled className="big-star" />}
        </motion.div>
        {r.action === 'redeem' ? (
          <>
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>{t('star.redeemed')}</motion.h1>
            <p style={{ fontSize: 18 }} className="gold">{t('star.enjoy', { name: rewardName })}</p>
            <p className="muted">{t('star.showStaff')}</p>
          </>
        ) : (
          <>
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>{t('star.plusOne')}</motion.h1>
            <p style={{ fontSize: 18 }}>{first ? t('star.thanksName', { name: first }) : t('star.thanks')}</p>
            <p className="muted">{t(r.stars === 1 ? 'star.nowOne' : 'star.nowMany', { n: r.stars })}</p>
          </>
        )}
        <Link to="/tarjeta" className="btn solid" style={{ marginTop: 12 }}><Icon name="card" /> {t('star.viewCard')}</Link>
      </div>
    )
  }

  return (
    <div className="page claim">
      {!key ? (
        <>
          <Icon name="qr" style={{ width: 80, height: 80, color: 'var(--gold)' }} />
          <h1>{t('star.scanTitle')}</h1>
          <p className="muted">{t('star.scanText')}</p>
          <Link to="/tarjeta" className="btn">{t('star.viewCard')}</Link>
        </>
      ) : state.kind === 'error' ? (
        <>
          <Icon name="x" style={{ width: 70, height: 70, color: 'var(--danger)' }} />
          <h1>{t('star.errorTitle')}</h1>
          <p className="muted">{t(state.key)}</p>
          <Link to="/tarjeta" className="btn">{t('star.viewCard')}</Link>
        </>
      ) : (
        <>
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}>
            <Icon name="star" filled style={{ width: 80, height: 80, color: 'var(--gold)' }} />
          </motion.div>
          <h1>{t('star.adding')}</h1>
          {ready && !customer && (
            <>
              <p className="muted">{t('star.createFirst')}</p>
              {!registerOpen && (
                <motion.button className="btn solid" whileTap={{ scale: 0.95 }} onClick={() => setRegisterOpen(true)}>
                  <Icon name="star" /> {t('card.create')}
                </motion.button>
              )}
            </>
          )}
        </>
      )}
      <RegisterModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        reason={t('star.registerReason')}
        onDone={(c) => {
          setRegisterOpen(false)
          setCustomer(c)
        }}
      />
    </div>
  )
}
