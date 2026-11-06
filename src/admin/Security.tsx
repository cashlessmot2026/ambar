import { useState } from 'react'
import { Icon } from '../components/Icon'
import { api, errorMessage } from '../lib/api'
import { useAdmin } from './useAdmin'

export default function Security() {
  const { run, logout } = useAdmin()
  const [oldPw, setOld] = useState('')
  const [newPw, setNew] = useState('')
  const [again, setAgain] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (newPw !== again) return setError('Las contraseñas nuevas no coinciden.')
    if (newPw.length < 4) return setError('La nueva contraseña debe tener al menos 4 caracteres.')
    setError(null)
    try {
      await run((t) => api.admin.changePassword(t, oldPw, newPw))
      setOld(''); setNew(''); setAgain('')
      setMsg('Contraseña actualizada ✓. Las demás sesiones abiertas se cerraron.')
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <>
      <h1>Seguridad</h1>
      <form className="card panel" style={{ maxWidth: 440 }} onSubmit={submit}>
        <h2>Cambiar contraseña</h2>
        <div className="field"><label>Contraseña actual</label><input className="input" type="password" autoComplete="current-password" value={oldPw} onChange={(e) => setOld(e.target.value)} /></div>
        <div className="field"><label>Nueva contraseña</label><input className="input" type="password" autoComplete="new-password" value={newPw} onChange={(e) => setNew(e.target.value)} /></div>
        <div className="field"><label>Repite la nueva contraseña</label><input className="input" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} /></div>
        {error && <p className="error">{error}</p>}
        {msg && <p className="saved">{msg}</p>}
        <button className="btn solid" disabled={!oldPw || !newPw}><Icon name="lock" /> Actualizar</button>
      </form>
      <p className="muted" style={{ fontSize: 13 }}>
        La contraseña se guarda cifrada en la base de datos y nunca aparece en el código de la app. Las sesiones duran 12 horas.
      </p>
      <button className="btn ghost sm" onClick={logout}><Icon name="logout" /> Cerrar sesión</button>
    </>
  )
}
