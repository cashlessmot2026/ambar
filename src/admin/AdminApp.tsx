import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { Icon, type IconName } from '../components/Icon'
import { useAppData } from '../context/AppData'
import { ThemeApplier } from '../context/Theme'
import { errorMessage } from '../lib/api'
import { mediaUrl } from '../lib/format'
import './admin.css'
import Customers from './Customers'
import Orders from './Orders'
import PageSettings from './PageSettings'
import Products from './Products'
import QrNfc from './QrNfc'
import Rewards from './Rewards'
import Security from './Security'
import SurveyAdmin from './SurveyAdmin'
import { AdminProvider, useAdmin } from './useAdmin'

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: 'pedidos', label: 'Pedidos', icon: 'receipt' },
  { to: 'clientes', label: 'Clientes', icon: 'users' },
  { to: 'premios', label: 'Premios', icon: 'gift' },
  { to: 'menus', label: 'Menús', icon: 'menu' },
  { to: 'pagina', label: 'Página', icon: 'palette' },
  { to: 'encuesta', label: 'Encuesta', icon: 'star' },
  { to: 'qr', label: 'QR / NFC', icon: 'qr' },
  { to: 'seguridad', label: 'Seguridad', icon: 'lock' },
]

function Login() {
  const { login } = useAdmin()
  const [pw, setPw] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  return (
    <div className="login">
      <motion.form
        className="card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setError(null)
          try {
            await login(pw)
          } catch (err) {
            setError(errorMessage(err))
            setPw('')
          } finally {
            setBusy(false)
          }
        }}
      >
        <img src={mediaUrl('logo.png')} alt="Ámbar" />
        <h1 style={{ fontSize: 18, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>Panel de administración</h1>
        <div className="field" style={{ textAlign: 'left' }}>
          <label htmlFor="admin-pw">Contraseña</label>
          <input id="admin-pw" className="input" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <motion.button className="btn solid block" whileTap={{ scale: 0.96 }} disabled={busy || !pw}>
          <Icon name="lock" /> {busy ? 'Verificando…' : 'Entrar'}
        </motion.button>
      </motion.form>
    </div>
  )
}

function Shell() {
  const { token, logout } = useAdmin()
  if (!token) return <Login />
  return (
    <div className="admin">
      <header className="admin-head">
        <div className="admin-bar">
          <span className="brand"><img src={mediaUrl('logo.png')} alt="" /> PANEL ÁMBAR</span>
          <button className="btn ghost sm" onClick={logout}><Icon name="logout" /> Salir</button>
        </div>
        <nav className="admin-tabs">
          {TABS.map((t) => (
            <NavLink key={t.to} to={`/ambar-admin/${t.to}`} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon name={t.icon} /> {t.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="admin-main">
        <Routes>
          <Route path="pedidos" element={<Orders />} />
          <Route path="clientes" element={<Customers />} />
          <Route path="premios" element={<Rewards />} />
          <Route path="menus" element={<Products />} />
          <Route path="pagina" element={<PageSettings />} />
          <Route path="encuesta" element={<SurveyAdmin />} />
          <Route path="qr" element={<QrNfc />} />
          <Route path="seguridad" element={<Security />} />
          <Route path="*" element={<Navigate to="pedidos" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function AdminApp() {
  const { data } = useAppData()
  // El panel siempre va en español y de izquierda a derecha, aunque el cliente haya elegido otro idioma.
  useEffect(() => {
    const root = document.documentElement
    const prev = { lang: root.lang, dir: root.dir }
    root.lang = 'es'
    root.dir = 'ltr'
    return () => { root.lang = prev.lang; root.dir = prev.dir }
  }, [])
  return (
    <AdminProvider>
      <ThemeApplier theme={data?.settings.theme} />
      <Routes>
        <Route path="/ambar-admin/*" element={<Shell />} />
      </Routes>
    </AdminProvider>
  )
}
