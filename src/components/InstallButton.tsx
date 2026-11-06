import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/I18n'
import { Icon } from './Icon'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallButton() {
  const { t } = useI18n()
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null)
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setEvt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])
  if (!evt) return null
  return (
    <motion.button
      className="btn ghost"
      whileTap={{ scale: 0.95 }}
      whileHover={{ scale: 1.04 }}
      onClick={async () => {
        await evt.prompt()
        await evt.userChoice
        setEvt(null)
      }}
    >
      <Icon name="install" /> {t('install.button')}
    </motion.button>
  )
}
