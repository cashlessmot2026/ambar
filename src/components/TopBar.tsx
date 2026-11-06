import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { useAppData } from '../context/AppData'
import { mediaUrl } from '../lib/format'
import { Icon } from './Icon'

export function TopBar({ title }: { title?: string }) {
  const { data } = useAppData()
  return (
    <header className="topbar">
      <Link to="/" className="brand" aria-label="Inicio">
        <img src={mediaUrl('logo.png')} alt="" />
        <span>{title ?? 'ÁMBAR'}</span>
      </Link>
      <motion.a
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.08 }}
        className="icon-btn"
        href={data?.settings.contact.instagram_url ?? '#'}
        target="_blank"
        rel="noreferrer"
        aria-label="Instagram"
      >
        <Icon name="instagram" />
      </motion.a>
    </header>
  )
}
