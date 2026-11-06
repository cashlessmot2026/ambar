import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { LoyaltyCard } from '../components/LoyaltyCard'
import { RegisterModal } from '../components/RegisterModal'
import { TopBar } from '../components/TopBar'
import { useAppData } from '../context/AppData'
import { useCustomer } from '../context/Customer'
import { api, errorMessage } from '../lib/api'
import { mediaUrl } from '../lib/format'
import { rewardProgress } from '../lib/rewards'

export default function Card() {
  const { data } = useAppData()
  const { customer, token, ready, refresh, setCustomer } = useCustomer()
  const [registerOpen, setRegisterOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { void refresh() }, [refresh])

  const rewards = data?.rewards ?? []
  const progress = customer ? rewardProgress(customer.stars, rewards) : []
  const goal = rewards.length ? Math.min(...rewards.map((r) => r.stars_required)) : 5
  const pending = rewards.find((r) => r.id === customer?.pending_reward_id)

  async function arm(rewardId: string | null) {
    if (!token) return
    setBusy(rewardId ?? 'cancel')
    setError(null)
    try {
      setCustomer(await api.armRedeem(token, rewardId))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <TopBar title="TARJETA" />
      <div className="page" style={{ maxWidth: 560 }}>
        {!customer ? (
          ready ? (
            <motion.div className="empty" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Icon name="card" />
              <h2 style={{ fontSize: 20, color: 'var(--text)', marginBottom: 6 }}>Tu Tarjeta Ámbar</h2>
              <p>Regístrate gratis, gana una estrella en cada visita y canjéalas por premios.</p>
              <motion.button className="btn solid" style={{ marginTop: 14 }} whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.04 }} onClick={() => setRegisterOpen(true)}>
                <Icon name="star" /> Crear mi tarjeta
              </motion.button>
            </motion.div>
          ) : (
            <div className="spinner" />
          )
        ) : (
          <>
            <div style={{ marginTop: 22 }}>
              <LoyaltyCard customer={customer} goal={goal} />
            </div>
            <p className="muted" style={{ textAlign: 'center', fontSize: 12, marginTop: 10 }}>Arrastra tu tarjeta ✦</p>

            <div className="stars-count">
              <motion.strong key={customer.stars} initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                {customer.stars}
              </motion.strong>
              <div className="muted upper" style={{ fontSize: 12, fontWeight: 700 }}>{customer.stars === 1 ? 'estrella' : 'estrellas'}</div>
            </div>

            <AnimatePresence>
              {pending && (
                <motion.div className="pending section" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <Icon name="qr" style={{ width: 36, height: 36, color: 'var(--gold)' }} />
                  <h3 style={{ fontSize: 16, margin: '6px 0' }}>Canje listo: {pending.name}</h3>
                  <p className="muted" style={{ fontSize: 13, margin: '0 0 12px' }}>
                    Escanea el QR o acerca tu celular al tag NFC de Ámbar para recibir tu premio. Tus estrellas volverán a 0.
                  </p>
                  <button className="btn sm ghost" onClick={() => arm(null)} disabled={busy !== null}>Cancelar canje</button>
                </motion.div>
              )}
            </AnimatePresence>

            {progress.length > 0 && (
              <section className="section">
                <div className="section-title"><h2>Premios</h2></div>
                <div className="card">
                  {progress.map(({ reward, pct, ready: ok }) => (
                    <div className="reward" key={reward.id}>
                      <div className="reward-head">
                        <span className="ico">{reward.image ? <img src={mediaUrl(reward.image)} alt="" /> : <Icon name="gift" />}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <strong>{reward.name}</strong>
                          <div className="muted" style={{ fontSize: 12 }}>
                            {reward.description ?? ''} {Math.min(customer.stars, reward.stars_required)}/{reward.stars_required} ⭐
                          </div>
                        </div>
                        {ok && customer.pending_reward_id !== reward.id && (
                          <motion.button className="btn solid sm" whileTap={{ scale: 0.92 }} whileHover={{ scale: 1.05 }} onClick={() => arm(reward.id)} disabled={busy !== null}>
                            Canjear
                          </motion.button>
                        )}
                      </div>
                      <div className="bar">
                        <motion.span initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9, ease: 'easeOut' }} />
                      </div>
                    </div>
                  ))}
                </div>
                {error && <p className="error">{error}</p>}
              </section>
            )}

            <section className="section">
              <div className="section-title"><h2>¿Cómo funciona?</h2></div>
              <div className="how">
                <div className="card"><span className="n">1</span>Visítanos en Ámbar</div>
                <div className="card"><span className="n">2</span>Escanea el QR o el tag NFC</div>
                <div className="card"><span className="n">3</span>Suma estrellas y canjea premios</div>
              </div>
            </section>
          </>
        )}
      </div>
      <RegisterModal open={registerOpen} onClose={() => setRegisterOpen(false)} onDone={() => setRegisterOpen(false)} reason="Crea tu Tarjeta Ámbar con tu nombre, dirección y teléfono." />
    </>
  )
}
