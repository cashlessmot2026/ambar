import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { useAppData } from '../context/AppData'
import { useI18n } from '../i18n/I18n'
import { mediaUrl } from '../lib/format'
import { Icon } from './Icon'
import { LangPicker } from './LangPicker'

export function TopBar({ title }: { title?: string }) {
  const { data } = useAppData()
  const { t } = useI18n()
  return (
    <header className="topbar">
      <Link to="/" className="brand" aria-label={t('nav.home')}>
        <img src={mediaUrl('logo.png')} alt="" />
        <span>{title ?? 'ÁMBAR'}</span>
      </Link>
      <div className="topbar-actions">
        <LangPicker />
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
      </div>
    </header>
  )
}
