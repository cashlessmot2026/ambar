import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { ReviewButtons } from '../components/ReviewButtons'
import { TopBar } from '../components/TopBar'
import { useAppData } from '../context/AppData'
import { errKey, useI18n } from '../i18n/I18n'
import { api } from '../lib/api'
import { fireworks } from '../lib/celebrate'
import { haptic } from '../lib/haptics'
import { getSurvey, isComplete } from '../lib/survey'

function Stars({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  const { t } = useI18n()
  return (
    <div className="stars" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <motion.button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={t('survey.star', { n })}
          className={`star-btn${n <= value ? ' on' : ''}`}
          whileTap={{ scale: 0.8 }}
          whileHover={{ scale: 1.12 }}
          onClick={() => { haptic(); onChange(n) }}
        >
          <Icon name="star" filled={n <= value} />
        </motion.button>
      ))}
    </div>
  )
}

export default function Survey() {
  const { data, loading } = useAppData()
  const { t } = useI18n()
  const survey = useMemo(() => getSurvey(data?.settings), [data])
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  if (!data) return <><TopBar />{loading ? <div className="spinner" /> : <div className="empty">{t('common.loadError')}</div>}</>

  const complete = isComplete(survey, ratings)

  async function submit() {
    if (!complete || busy) return
    setBusy(true)
    setError(null)
    try {
      await api.submitSurvey(
        survey.questions.map((q) => ({ id: q.id, text: q.text, rating: ratings[q.id] })),
        survey.comment_enabled ? comment.trim() : '',
      )
      setDone(true)
      fireworks(900)
      window.scrollTo({ top: 0 })
    } catch (e) {
      setError(t(errKey(e)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <TopBar />
      <div className="page" style={{ maxWidth: 560 }}>
        <AnimatePresence mode="wait">
          {!done ? (
            <motion.form
              key="form"
              className="survey"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              onSubmit={(e) => { e.preventDefault(); void submit() }}
            >
              <div style={{ textAlign: 'center', padding: '24px 0 12px' }}>
                <div style={{ fontSize: 44 }}>🥩</div>
                <h1 style={{ fontSize: 24 }} className="upper">{survey.title}</h1>
                {survey.intro && <p className="muted">{survey.intro}</p>}
              </div>

              {survey.questions.map((q, i) => (
                <motion.div
                  key={q.id}
                  className="card survey-q"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i }}
                >
                  <strong>{q.text}</strong>
                  <Stars value={ratings[q.id] ?? 0} onChange={(n) => setRatings((r) => ({ ...r, [q.id]: n }))} label={q.text} />
                </motion.div>
              ))}

              {survey.comment_enabled && (
                <div className="field" style={{ marginTop: 16 }}>
                  <label htmlFor="survey-comment">{t('survey.comment')}</label>
                  <textarea id="survey-comment" className="input" maxLength={1000} placeholder={t('survey.commentPh')} value={comment} onChange={(e) => setComment(e.target.value)} />
                </div>
              )}

              {error && <p className="error" role="alert">{error}</p>}
              {!complete && <p className="muted" style={{ fontSize: 13, textAlign: 'center' }}>{t('survey.pending')}</p>}
              <motion.button className="btn solid block" style={{ height: 54, marginTop: 8 }} whileTap={{ scale: 0.96 }} disabled={!complete || busy}>
                <Icon name="check" /> {busy ? t('survey.sending') : t('survey.submit')}
              </motion.button>
            </motion.form>
          ) : (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
              <div style={{ textAlign: 'center', padding: '28px 0 8px' }}>
                <div style={{ fontSize: 56 }}>🎉</div>
                <h1 style={{ fontSize: 24 }} className="upper">{t('survey.thanksTitle')}</h1>
                <p className="muted">{t('survey.thanksText')}</p>
              </div>
              <ReviewButtons contact={data.settings.contact} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
