import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { LoyaltyCard } from '../components/LoyaltyCard'
import { RegisterModal } from '../components/RegisterModal'
import { TopBar } from '../components/TopBar'
import { useAppData } from '../context/AppData'
import { useCustomer } from '../context/Customer'
import { errKey, localized, useI18n } from '../i18n/I18n'
import { api } from '../lib/api'
import { mediaUrl } from '../lib/format'
import { rewardProgress } from '../lib/rewards'

export default function Card() {
  const { data } = useAppData()
  const { customer, token, ready, refresh, setCustomer } = useCustomer()
  const { t, lang } = useI18n()
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
      setError(t(errKey(e)))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <TopBar title={t('card.title')} />
      <div className="page" style={{ maxWidth: 560 }}>
        {!customer ? (
          ready ? (
            <motion.div className="empty" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Icon name="card" />
              <h2 style={{ fontSize: 20, color: 'var(--text)', marginBottom: 6 }}>{t('card.yourCard')}</h2>
              <p>{t('card.pitch')}</p>
              <motion.button className="btn solid" style={{ marginTop: 14 }} whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.04 }} onClick={() => setRegisterOpen(true)}>
                <Icon name="star" /> {t('card.create')}
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
            <p className="muted" style={{ textAlign: 'center', fontSize: 12, marginTop: 10 }}>{t('card.drag')}</p>

            <div className="stars-count">
              <motion.strong key={customer.stars} initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                {customer.stars}
              </motion.strong>
              <div className="muted upper" style={{ fontSize: 12, fontWeight: 700 }}>{t(customer.stars === 1 ? 'card.starOne' : 'card.starMany')}</div>
            </div>

            <AnimatePresence>
              {pending && (
                <motion.div className="pending section" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <Icon name="qr" style={{ width: 36, height: 36, color: 'var(--gold)' }} />
                  <h3 style={{ fontSize: 16, margin: '6px 0' }}>{t('card.pendingTitle', { name: localized(pending, 'name', lang) })}</h3>
                  <p className="muted" style={{ fontSize: 13, margin: '0 0 12px' }}>
                    {t('card.pendingText')}
                  </p>
                  <button className="btn sm ghost" onClick={() => arm(null)} disabled={busy !== null}>{t('card.cancelRedeem')}</button>
                </motion.div>
              )}
            </AnimatePresence>

            {progress.length > 0 && (
              <section className="section">
                <div className="section-title"><h2>{t('card.rewards')}</h2></div>
                <div className="card">
                  {progress.map(({ reward, pct, ready: ok }) => (
                    <div className="reward" key={reward.id}>
                      <div className="reward-head">
                        <span className="ico">{reward.image ? <img src={mediaUrl(reward.image)} alt="" /> : <Icon name="gift" />}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <strong>{localized(reward, 'name', lang)}</strong>
                          <div className="muted" style={{ fontSize: 12 }}>
                            {localized(reward, 'description', lang)} {Math.min(customer.stars, reward.stars_required)}/{reward.stars_required} ⭐
                          </div>
                        </div>
                        {ok && customer.pending_reward_id !== reward.id && (
                          <motion.button className="btn solid sm" whileTap={{ scale: 0.92 }} whileHover={{ scale: 1.05 }} onClick={() => arm(reward.id)} disabled={busy !== null}>
                            {t('card.redeem')}
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
              <div className="section-title"><h2>{t('card.how')}</h2></div>
              <div className="how">
                <div className="card"><span className="n">1</span>{t('card.step1')}</div>
                <div className="card"><span className="n">2</span>{t('card.step2')}</div>
                <div className="card"><span className="n">3</span>{t('card.step3')}</div>
              </div>
            </section>
          </>
        )}
      </div>
      <RegisterModal open={registerOpen} onClose={() => setRegisterOpen(false)} onDone={() => setRegisterOpen(false)} reason={t('card.registerReason')} />
    </>
  )
}
