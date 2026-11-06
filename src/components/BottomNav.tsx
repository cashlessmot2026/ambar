import { motion } from 'motion/react'
import { NavLink } from 'react-router-dom'
import { useCart } from '../context/Cart'
import { Icon, type IconName } from './Icon'

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Inicio', icon: 'home' },
  { to: '/menu', label: 'Menú', icon: 'menu' },
  { to: '/pedido', label: 'Pedido', icon: 'bag' },
  { to: '/tarjeta', label: 'Tarjeta', icon: 'card' },
]

export function BottomNav() {
  const { count } = useCart()
  return (
    <nav className="nav" aria-label="Navegación principal">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
          {({ isActive }) => (
            <>
              {isActive && <motion.span layoutId="nav-pill" className="pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
              <motion.span whileTap={{ scale: 0.85 }} style={{ display: 'grid', placeItems: 'center' }}>
                <Icon name={t.icon} />
              </motion.span>
              {t.label}
              {t.to === '/pedido' && count > 0 && (
                <motion.span key={count} className="badge" initial={{ scale: 0.4 }} animate={{ scale: 1 }}>
                  {count}
                </motion.span>
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
