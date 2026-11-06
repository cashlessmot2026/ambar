import { AnimatePresence, motion } from 'motion/react'
import { lazy, Suspense, type ReactNode } from 'react'
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import { ToastProvider } from './components/Toast'
import { AppDataProvider, useAppData } from './context/AppData'
import { CartProvider } from './context/Cart'
import { CustomerProvider } from './context/Customer'
import { ThemeApplier } from './context/Theme'
import Card from './pages/Card'
import Cart from './pages/Cart'
import Home from './pages/Home'
import Menu from './pages/Menu'
import Privacy from './pages/Privacy'
import Star from './pages/Star'
import Thanks from './pages/Thanks'

// El panel admin solo se descarga si alguien entra a su ruta.
const AdminApp = lazy(() => import('./admin/AdminApp'))

function Page({ children }: { children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
      {children}
    </motion.div>
  )
}

function PublicApp() {
  const location = useLocation()
  const { data } = useAppData()
  return (
    <div className="app">
      <ThemeApplier theme={data?.settings.theme} />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Page><Home /></Page>} />
          <Route path="/menu" element={<Page><Menu /></Page>} />
          <Route path="/pedido" element={<Page><Cart /></Page>} />
          <Route path="/gracias" element={<Page><Thanks /></Page>} />
          <Route path="/tarjeta" element={<Page><Card /></Page>} />
          <Route path="/estrella" element={<Page><Star /></Page>} />
          <Route path="/privacidad" element={<Page><Privacy /></Page>} />
          <Route path="*" element={<Page><Home /></Page>} />
        </Routes>
      </AnimatePresence>
      <BottomNav />
    </div>
  )
}

function Root() {
  const location = useLocation()
  if (location.pathname.startsWith('/ambar-admin')) {
    return (
      <Suspense fallback={<div className="spinner" />}>
        <AdminApp />
      </Suspense>
    )
  }
  return <PublicApp />
}

export default function App() {
  return (
    <HashRouter>
      <AppDataProvider>
        <CustomerProvider>
          <CartProvider>
            <ToastProvider>
              <Root />
            </ToastProvider>
          </CartProvider>
        </CustomerProvider>
      </AppDataProvider>
    </HashRouter>
  )
}
