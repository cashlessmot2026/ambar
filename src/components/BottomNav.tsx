import { motion } from 'motion/react'
import { NavLink } from 'react-router-dom'
import { useAppData } from '../context/AppData'
import { useCart } from '../context/Cart'
import { useI18n } from '../i18n/I18n'
import type { Key } from '../i18n/locales/es'
import { isOrderingEnabled } from '../lib/ordering'
import { Icon, type IconName } from './Icon'

const TABS: { to: string; label: Key; icon: IconName; ordering?: boolean }[] = [
  { to: '/', label: 'nav.home', icon: 'home' },
  { to: '/menu', label: 'nav.menu', icon: 'menu' },
  { to: '/pedido', label: 'nav.order', icon: 'bag', ordering: true },
  { to: '/tarjeta', label: 'nav.card', icon: 'card' },
]

export function BottomNav() {
  const { count } = useCart()
  const { data } = useAppData()
  const { t } = useI18n()
  const tabs = TABS.filter((tab) => !tab.ordering || isOrderingEnabled(data?.settings))
  return (
    <nav className="nav" aria-label={t('nav.main')} style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
      {tabs.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end={tab.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
          {({ isActive }) => (
            <>
              {isActive && <motion.span layoutId="nav-pill" className="pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
              <motion.span whileTap={{ scale: 0.85 }} style={{ display: 'grid', placeItems: 'center' }}>
                <Icon name={tab.icon} />
              </motion.span>
              {t(tab.label)}
              {tab.to === '/pedido' && count > 0 && (
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
