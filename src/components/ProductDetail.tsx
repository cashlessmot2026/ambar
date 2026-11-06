import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { localized, useI18n } from '../i18n/I18n'
import { formatCOP, mediaUrl } from '../lib/format'
import type { Product } from '../lib/types'
import { Icon } from './Icon'
import { PlaceholderArt } from './PlaceholderArt'

/** Tarjeta ampliada que se superpone a la página, con foto(s) y la descripción completa. */
export function ProductDetail({
  product, open, canOrder, onAdd, onClose,
}: { product: Product; open: boolean; canOrder: boolean; onAdd: () => void; onClose: () => void }) {
  const { t, lang } = useI18n()
  const name = localized(product, 'name', lang)
  const description = localized(product, 'description', lang)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="detail-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="detail-card"
            role="dialog"
            aria-modal="true"
            aria-label={name}
            initial={{ opacity: 0, scale: 0.9, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="icon-btn detail-close" onClick={onClose} aria-label={t('common.close')}>
              <Icon name="x" />
            </button>
            <div className="detail-media">
              {product.images.length > 0
                ? product.images.map((src, i) => <img key={src + i} src={mediaUrl(src)} alt={name} loading="lazy" />)
                : <PlaceholderArt />}
              {product.featured && <span className="tag">{t('product.top')}</span>}
            </div>
            {product.images.length > 1 && (
              <span className="detail-hint">{t('product.morePhotos', { n: product.images.length - 1 })}</span>
            )}
            <div className="detail-body">
              <h3>{name}</h3>
              <span className="price">{formatCOP(product.price)}</span>
              {description && <p>{description}</p>}
              {canOrder && (
                <motion.button className="btn solid block" whileTap={{ scale: 0.95 }} onClick={onAdd}>
                  <Icon name="plus" /> {t('product.add')}
                </motion.button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
