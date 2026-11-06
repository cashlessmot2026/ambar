import { motion } from 'motion/react'
import { useCallback, useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { useAppData } from '../context/AppData'
import { api, errorMessage } from '../lib/api'
import { getSurvey, newQuestionId } from '../lib/survey'
import type { Survey, SurveyResults } from '../lib/types'
import { appBase, FixedQr } from './FixedQr'
import { useAdmin } from './useAdmin'

const fmt = (iso: string) => new Date(iso).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
const stars = (n: number) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n))

export default function SurveyAdmin() {
  const { data, run, reload } = useAdmin()
  const pub = useAppData()
  const [s, setS] = useState<Survey | null>(null)
  const [results, setResults] = useState<SurveyResults | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { if (data && !s) setS(structuredClone(getSurvey(data.settings))) }, [data, s])

  const loadResults = useCallback(async () => {
    try { setResults(await run((t) => api.admin.surveyResults(t))) } catch (e) { setError(errorMessage(e)) }
  }, [run])
  useEffect(() => { void loadResults() }, [loadResults])

  if (!s) return <div className="spinner" />

  const setQ = (i: number, text: string) => setS({ ...s, questions: s.questions.map((q, k) => (k === i ? { ...q, text } : q)) })
  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= s.questions.length) return
    const qs = [...s.questions]
    ;[qs[i], qs[j]] = [qs[j], qs[i]]
    setS({ ...s, questions: qs })
  }

  async function save() {
    if (!s) return
    const questions = s.questions.map((q) => ({ ...q, text: q.text.trim() })).filter((q) => q.text)
    if (questions.length === 0) {
      setError('La encuesta necesita al menos una pregunta.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await run((t) => api.admin.setSurvey(t, { ...s, title: s.title.trim(), intro: s.intro.trim(), questions }))
      setS({ ...s, questions })
      await reload()
      await pub.reload()
      setMsg('Encuesta publicada ✓')
      window.setTimeout(() => setMsg(null), 2500)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const url = `${appBase()}#/encuesta`
  const local = /localhost|127\.0\.0\.1/.test(window.location.hostname)

  return (
    <>
      <h1>Encuesta de satisfacción</h1>
      {local && <p className="error">Estás en un servidor local. Descarga el QR desde el dominio público donde publiques la app.</p>}

      <h2 className="sub">QR de la encuesta</h2>
      <FixedQr url={url} alt="Código QR de la encuesta de satisfacción" filename="ambar-qr-encuesta.png">
        <h2>Cómo funciona</h2>
        <p style={{ fontSize: 14 }}>
          Este QR es único y no cambia: puedes imprimirlo una sola vez. Aunque edites las preguntas, el QR sigue apuntando a la misma encuesta.
          Al terminarla, el cliente ve los botones para dejar su reseña en <strong className="gold">Google</strong> y <strong className="gold">Tripadvisor</strong>.
        </p>
      </FixedQr>

      <h2 className="sub">Preguntas</h2>
      <div className="card panel">
        <div className="field"><label>Título</label><input className="input" value={s.title} maxLength={80} onChange={(e) => setS({ ...s, title: e.target.value })} /></div>
        <div className="field"><label>Mensaje de introducción</label><textarea className="input" maxLength={240} value={s.intro} onChange={(e) => setS({ ...s, intro: e.target.value })} /></div>

        <p className="muted" style={{ fontSize: 13 }}>Cada pregunta se califica con estrellas de 1 a 5.</p>
        {s.questions.map((q, i) => (
          <div key={q.id} className="survey-edit-row">
            <span className="n">{i + 1}</span>
            <input className="input" value={q.text} maxLength={120} placeholder="Escribe la pregunta" aria-label={`Pregunta ${i + 1}`} onChange={(e) => setQ(i, e.target.value)} />
            <button type="button" className="mini" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir pregunta">↑</button>
            <button type="button" className="mini" onClick={() => move(i, 1)} disabled={i === s.questions.length - 1} aria-label="Bajar pregunta">↓</button>
            <button type="button" className="mini" onClick={() => setS({ ...s, questions: s.questions.filter((_, k) => k !== i) })} aria-label="Eliminar pregunta"><Icon name="trash" /></button>
          </div>
        ))}
        <button type="button" className="btn ghost sm" style={{ marginTop: 8 }} disabled={s.questions.length >= 20} onClick={() => setS({ ...s, questions: [...s.questions, { id: newQuestionId(), text: '' }] })}>
          <Icon name="plus" /> Agregar pregunta
        </button>

        <label className="switch" style={{ marginTop: 14 }}>
          <input type="checkbox" checked={s.comment_enabled} onChange={(e) => setS({ ...s, comment_enabled: e.target.checked })} /> Permitir un comentario opcional al final
        </label>

        {error && <p className="error" role="alert">{error}</p>}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 14 }}>
          <motion.button className="btn solid" whileTap={{ scale: 0.96 }} onClick={() => void save()} disabled={busy}><Icon name="check" /> {busy ? 'Guardando…' : 'Guardar encuesta'}</motion.button>
          {msg && <span className="gold">{msg}</span>}
        </div>
        <p className="muted" style={{ fontSize: 12 }}>Las preguntas se muestran en español a todos los clientes, sin importar su idioma.</p>
      </div>

      <h2 className="sub">Resultados</h2>
      {!results && <div className="spinner" />}
      {results && results.total === 0 && <div className="empty"><Icon name="star" /><p>Aún no hay respuestas.</p></div>}
      {results && results.total > 0 && (
        <>
          <div className="card panel survey-summary">
            <div><small>Respuestas</small><strong>{results.total}</strong></div>
            <div><small>Promedio general</small><strong className="gold">{results.average?.toFixed(2)} ★</strong></div>
          </div>
          <div className="card panel">
            <h2>Promedio por pregunta</h2>
            {results.by_question.map((q) => (
              <div key={q.text} className="avg-row">
                <span>{q.text}</span>
                <span className="gold" title={`${q.count} respuestas`}>{stars(q.avg)} <b>{q.avg.toFixed(2)}</b></span>
              </div>
            ))}
          </div>
          <div className="card panel">
            <h2>Últimas respuestas</h2>
            {results.recent.map((r) => (
              <div key={r.id} className="resp">
                <div className="head"><span className="gold">{stars(r.average)} <b>{r.average.toFixed(1)}</b></span><small className="muted">{fmt(r.created_at)}</small></div>
                {r.comment && <p>“{r.comment}”</p>}
                <small className="muted">{r.answers.map((a) => `${a.text}: ${a.rating}`).join(' · ')}</small>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}
