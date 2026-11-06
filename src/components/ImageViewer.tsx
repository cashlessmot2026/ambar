import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/I18n'
import { mediaUrl } from '../lib/format'
import { Icon } from './Icon'

/** Vista ampliada que continúa la animación desde la miniatura con el mismo `layoutId`. */
export function ImageViewer({
  open, images, layoutId, alt, onClose,
}: { open: boolean; images: string[]; layoutId: string; alt: string; onClose: () => void }) {
  const { t, dir } = useI18n()
  const [index, setIndex] = useState(0)
  useEffect(() => { if (open) setIndex(0) }, [open])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      const next = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight'
      const prev = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft'
      if (e.key === next) setIndex((i) => Math.min(images.length - 1, i + 1))
      if (e.key === prev) setIndex((i) => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, images.length, onClose, dir])

  return (
    <AnimatePresence>
      {open && images.length > 0 && (
        <motion.div className="viewer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <button className="icon-btn viewer-close" onClick={onClose} aria-label={t('common.close')}>
            <Icon name="x" />
          </button>
          <motion.img
            key={index}
            layoutId={index === 0 ? layoutId : undefined}
            src={mediaUrl(images[index])}
            alt={alt}
            className="viewer-img"
            drag={images.length > 1 ? 'x' : false}
            dragSnapToOrigin
            onDragEnd={(_, info) => {
              const dx = dir === 'rtl' ? -info.offset.x : info.offset.x
              if (dx < -60) setIndex((i) => Math.min(images.length - 1, i + 1))
              if (dx > 60) setIndex((i) => Math.max(0, i - 1))
            }}
            onClick={(e) => e.stopPropagation()}
          />
          {images.length > 1 && (
            <div className="viewer-dots">
              {images.map((_, i) => <span key={i} className={i === index ? 'on' : ''} />)}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
