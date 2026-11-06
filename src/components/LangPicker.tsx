import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { LANGS, useI18n } from '../i18n/I18n'
import { Icon } from './Icon'

/** Botón 🌐 + hoja con los 10 idiomas, cada uno escrito en su propio idioma. */
export function LangPicker() {
  const { lang, setLang, t } = useI18n()
  const [open, setOpen] = useState(false)
  const current = LANGS.find((l) => l.code === lang)!
  return (
    <>
      <motion.button
        className="icon-btn lang-btn"
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.08 }}
        onClick={() => setOpen(true)}
        aria-label={t('lang.button')}
        aria-haspopup="dialog"
      >
        <span aria-hidden="true">{current.flag}</span>
        <small>{current.code.toUpperCase()}</small>
      </motion.button>
      {/* Portal: la barra superior usa backdrop-filter, que recortaría una hoja position:fixed dentro de ella. */}
      {createPortal(
      <AnimatePresence>
        {open && (
          <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
            <motion.div
              className="sheet"
              role="dialog"
              aria-label={t('lang.title')}
              onClick={(e) => e.stopPropagation()}
              initial={{ y: 80 }}
              animate={{ y: 0 }}
              exit={{ y: 80 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            >
              <div className="grab" />
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="globe" style={{ width: 22, color: 'var(--gold)' }} /> {t('lang.title')}</h2>
              <div className="lang-grid">
                {LANGS.map((l, i) => (
                  <motion.button
                    key={l.code}
                    lang={l.code}
                    dir={l.dir}
                    className={`lang-opt${l.code === lang ? ' on' : ''}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setLang(l.code)
                      setOpen(false)
                    }}
                  >
                    <span className="flag" aria-hidden="true">{l.flag}</span>
                    <span>{l.name}</span>
                    {l.code === lang && <Icon name="check" className="tick" />}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body,
      )}
    </>
  )
}
