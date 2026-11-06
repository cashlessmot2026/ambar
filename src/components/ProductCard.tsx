import { motion } from 'motion/react'
import { useState } from 'react'
import { useCart } from '../context/Cart'
import { formatCOP, mediaUrl } from '../lib/format'
import type { Product } from '../lib/types'
import { Icon } from './Icon'
import { ImageViewer } from './ImageViewer'
import { PlaceholderArt } from './PlaceholderArt'
import { useToast } from './Toast'

function useAdd(product: Product) {
  const { add } = useCart()
  const toast = useToast()
  return () => {
    add(product)
    toast(`${product.name} agregado ✓`)
  }
}

export function ProductCard({ product, highlight }: { product: Product; highlight?: boolean }) {
  const onAdd = useAdd(product)
  const [open, setOpen] = useState(false)
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
      <button className="ph" onClick={() => img && setOpen(true)} aria-label={img ? `Ver fotos de ${product.name}` : product.name}>
        {img ? <motion.img layoutId={layoutId} src={mediaUrl(img)} alt={product.name} loading="lazy" /> : <PlaceholderArt />}
        {product.featured && <span className="tag">Top</span>}
        {product.images.length > 1 && <span className="count">+{product.images.length - 1} fotos</span>}
      </button>
      <div className="body">
        <h3>{product.name}</h3>
        {product.description && <p>{product.description}</p>}
        <span className="price">{formatCOP(product.price)}</span>
        <motion.button className="btn solid sm block" whileTap={{ scale: 0.94 }} whileHover={{ scale: 1.03 }} onClick={onAdd}>
          <Icon name="plus" /> Agregar
        </motion.button>
      </div>
      <ImageViewer open={open} images={product.images} layoutId={layoutId} alt={product.name} onClose={() => setOpen(false)} />
    </motion.article>
  )
}

export function ProductRow({ product, highlight }: { product: Product; highlight?: boolean }) {
  const onAdd = useAdd(product)
  return (
    <motion.div
      id={`p-${product.id}`}
      className="row"
      style={highlight ? { outline: '2px solid var(--gold)' } : undefined}
      initial={{ opacity: 0, x: -10 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
    >
      <div className="txt">
        <h3>{product.name}</h3>
        {product.description && <p>{product.description}</p>}
      </div>
      <span className="price">{formatCOP(product.price)}</span>
      <motion.button className="add-btn" whileTap={{ scale: 0.85 }} whileHover={{ scale: 1.1 }} aria-label={`Agregar ${product.name}`} onClick={onAdd}>
        <Icon name="plus" />
      </motion.button>
    </motion.div>
  )
}
