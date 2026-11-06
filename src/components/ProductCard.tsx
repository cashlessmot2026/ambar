import { motion } from 'motion/react'
import { useState } from 'react'
import { useCart } from '../context/Cart'
import { localized, useI18n } from '../i18n/I18n'
import { formatCOP, mediaUrl } from '../lib/format'
import { haptic } from '../lib/haptics'
import type { Product } from '../lib/types'
import { Icon } from './Icon'
import { ImageViewer } from './ImageViewer'
import { PlaceholderArt } from './PlaceholderArt'
import { useToast } from './Toast'

function useAdd(product: Product, name: string) {
  const { add } = useCart()
  const toast = useToast()
  const { t } = useI18n()
  return () => {
    add(product)
    haptic()
    toast(t('product.added', { name }))
  }
}

export function ProductCard({ product, highlight, canOrder = true }: { product: Product; highlight?: boolean; canOrder?: boolean }) {
  const { t, lang } = useI18n()
  const name = localized(product, 'name', lang)
  const description = localized(product, 'description', lang)
  const onAdd = useAdd(product, name)
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const img = product.images[0]
  const layoutId = `product-${product.id}`

  return (
    <motion.article
      id={`p-${product.id}`}
      className={`card product${highlight ? ' hl' : ''}`}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      whileHover={{ y: -4 }}
    >
      <button className="ph" onClick={() => img && setOpen(true)} aria-label={img ? t('product.viewPhotos', { name }) : name}>
        {img ? <motion.img layoutId={layoutId} src={mediaUrl(img)} alt={name} loading="lazy" /> : <PlaceholderArt />}
        {product.featured && <span className="tag">{t('product.top')}</span>}
        {product.images.length > 1 && <span className="count">{t('product.morePhotos', { n: product.images.length - 1 })}</span>}
      </button>
      <div
        className={`body${description ? ' expandable' : ''}`}
        role={description ? 'button' : undefined}
        tabIndex={description ? 0 : undefined}
        aria-expanded={description ? expanded : undefined}
        onClick={() => description && setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (description && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setExpanded((v) => !v) }
        }}
      >
        <h3>{name}</h3>
        {description && <p className={expanded ? 'open' : undefined}>{description}</p>}
        <span className="price">{formatCOP(product.price)}</span>
        {canOrder && (
          <motion.button className="btn solid sm block" whileTap={{ scale: 0.94 }} whileHover={{ scale: 1.03 }} onClick={(e) => { e.stopPropagation(); onAdd() }}>
            <Icon name="plus" /> {t('product.add')}
          </motion.button>
        )}
      </div>
      <ImageViewer open={open} images={product.images} layoutId={layoutId} alt={name} onClose={() => setOpen(false)} />
    </motion.article>
  )
}

export function ProductRow({ product, highlight, canOrder = true }: { product: Product; highlight?: boolean; canOrder?: boolean }) {
  const { t, lang } = useI18n()
  const name = localized(product, 'name', lang)
  const description = localized(product, 'description', lang)
  const onAdd = useAdd(product, name)
  return (
    <motion.div
      id={`p-${product.id}`}
      className="row"
      style={highlight ? { outline: '2px solid var(--gold)' } : undefined}
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
    >
      <div className="txt">
        <h3>{name}</h3>
        {description && <p>{description}</p>}
      </div>
      <span className="price">{formatCOP(product.price)}</span>
      {canOrder && (
        <motion.button className="add-btn" whileTap={{ scale: 0.85 }} whileHover={{ scale: 1.1 }} aria-label={t('product.addAria', { name })} onClick={onAdd}>
          <Icon name="plus" />
        </motion.button>
      )}
    </motion.div>
  )
}
