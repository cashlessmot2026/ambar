import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon, type IconName } from '../components/Icon'
import { ImageViewer } from '../components/ImageViewer'
import { InstallButton } from '../components/InstallButton'
import { PlaceholderArt } from '../components/PlaceholderArt'
import { useAppData } from '../context/AppData'
import { formatCOP, mediaUrl } from '../lib/format'
import type { Product } from '../lib/types'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: 0.08 * i, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } }),
}

export default function Home() {
  const { data, loading } = useAppData()
  const [open, setOpen] = useState<string | null>(null)

  const featured = useMemo<Product[]>(
    () => (data?.menus ?? []).flatMap((m) => m.categories.flatMap((c) => c.products)).filter((p) => p.featured),
    [data],
  )

  if (!data) return loading ? <div className="spinner" /> : <div className="empty">No pudimos cargar la información. Revisa tu conexión.</div>
  const { business, contact, landing } = data.settings

  const info: { icon: IconName; label: string; value: string; href?: string }[] = [
    { icon: 'chef', label: 'Chef', value: business.chef, href: business.chef_url },
    { icon: 'pin', label: 'Ubicación', value: business.location, href: contact.maps_url },
    { icon: 'music', label: 'Música', value: business.music, href: business.music_url },
    { icon: 'instagram', label: 'Instagram', value: '@' + contact.instagram_url.split('/').filter(Boolean).pop()!.split('?')[0], href: contact.instagram_url },
  ]

  return (
    <>
      <section className="hero">
        {landing.video ? (
          <video src={mediaUrl(landing.video)} poster={mediaUrl(landing.images[0])} autoPlay muted loop playsInline preload="metadata" />
        ) : (
          <img className="hero-fallback" src={mediaUrl(landing.images[0])} alt="" />
        )}
        <div className="hero-content">
          <motion.img
            className="hero-logo"
            src={mediaUrl('logo.png')}
            alt={business.name}
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          />
          <motion.h1 variants={fadeUp} initial="hidden" animate="show" custom={1}>
            {landing.headline}
          </motion.h1>
          <motion.p variants={fadeUp} initial="hidden" animate="show" custom={2}>
            {landing.subheadline}
          </motion.p>
          <motion.div className="hero-actions" variants={fadeUp} initial="hidden" animate="show" custom={3}>
            <motion.div whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.05 }}>
              <Link to="/menu" className="btn solid"><Icon name="menu" /> Ver menú</Link>
            </motion.div>
            <motion.a whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.05 }} className="btn" href={contact.instagram_url} target="_blank" rel="noreferrer">
              <Icon name="instagram" /> Instagram
            </motion.a>
            <InstallButton />
          </motion.div>
        </div>
      </section>

      <div className="page">
        <motion.div className="section award" variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
          <span className="trophy">🏆</span>
          <div>
            <small className="gold upper" style={{ fontSize: 11, fontWeight: 700 }}>🥇 Ganadores</small>
            <h3>{business.award}</h3>
            <span className="muted" style={{ fontSize: 13 }}>Prueba la Barkhu, la burger campeona de la isla.</span>
          </div>
        </motion.div>

        <div className="section info-grid">
          {info.map((it, i) => (
            <motion.a
              key={it.label}
              className="info"
              href={it.href}
              target="_blank"
              rel="noreferrer"
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              custom={i}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.97 }}
            >
              <span className="ico"><Icon name={it.icon} /></span>
              <small>{it.label}</small>
              <strong>{it.value}</strong>
            </motion.a>
          ))}
        </div>

        {featured.length > 0 && (
          <section className="section">
            <div className="section-title">
              <h2>Platos destacados</h2>
              <Link to="/menu">Ver todo</Link>
            </div>
            <div className="hscroll">
              {featured.map((p) => (
                <motion.div key={p.id} className="card feature-card" whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }}>
                  <Link to={`/menu?p=${p.id}`}>
                    <div className="ph">
                      {p.images[0] ? <img src={mediaUrl(p.images[0])} alt={p.name} loading="lazy" /> : <PlaceholderArt />}
                    </div>
                    <div className="body">
                      <h3>{p.name}</h3>
                      <span className="gold" style={{ fontWeight: 700 }}>{formatCOP(p.price)}</span>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        <section className="section">
          <div className="section-title">
            <h2>Galería</h2>
            <span className="muted" style={{ fontSize: 12 }}>Toca para ampliar</span>
          </div>
          <div className="hscroll">
            {landing.images.map((src, i) => (
              <motion.button
                key={src + i}
                className="gallery-item"
                onClick={() => setOpen(src)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                aria-label={`Abrir foto ${i + 1}`}
              >
                <motion.img layoutId={`gallery-${src}`} src={mediaUrl(src)} alt="" loading="lazy" />
              </motion.button>
            ))}
          </div>
        </section>

        <motion.div className="section" variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
          <Link to="/tarjeta" className="promo">
            <span className="info ico" style={{ border: 0, padding: 0, width: 52, height: 52 }}><Icon name="star" filled /></span>
            <div style={{ flex: 1 }}>
              <h3>Tarjeta Ámbar</h3>
              <span className="muted" style={{ fontSize: 13 }}>Gana una estrella por cada visita y reclama premios.</span>
            </div>
            <Icon name="arrowRight" style={{ width: 22, height: 22, color: 'var(--gold)' }} />
          </Link>
        </motion.div>

        <footer className="footer">
          {business.name} · {business.location}
          <br />
          <Link to="/privacidad">Política de tratamiento de datos</Link>
        </footer>
      </div>

      <ImageViewer
        open={open !== null}
        images={open ? [open] : []}
        layoutId={`gallery-${open}`}
        alt="Foto de Ámbar"
        onClose={() => setOpen(null)}
      />
    </>
  )
}
