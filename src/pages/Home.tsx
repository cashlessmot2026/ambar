import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon, type IconName } from '../components/Icon'
import { ImageViewer } from '../components/ImageViewer'
import { InstallButton } from '../components/InstallButton'
import { LangPicker } from '../components/LangPicker'
import { PlaceholderArt } from '../components/PlaceholderArt'
import { useAppData } from '../context/AppData'
import { localized, settingText, useI18n } from '../i18n/I18n'
import { formatCOP, mediaUrl } from '../lib/format'
import type { Product } from '../lib/types'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: 0.08 * i, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } }),
}

export default function Home() {
  const { data, loading } = useAppData()
  const { t, lang } = useI18n()
  const [open, setOpen] = useState<string | null>(null)

  const featured = useMemo<Product[]>(
    () => (data?.menus ?? []).flatMap((m) => m.categories.flatMap((c) => c.products)).filter((p) => p.featured),
    [data],
  )

  if (!data) return loading ? <div className="spinner" /> : <div className="empty">{t('common.loadError')}</div>
  const s = data.settings
  const { business, contact, landing } = s
  const txt = (section: 'landing' | 'business', field: string) => settingText(s, lang, section, field)

  const info: { icon: IconName; label: string; value: string; href?: string }[] = [
    { icon: 'chef', label: t('home.chef'), value: business.chef, href: business.chef_url },
    { icon: 'pin', label: t('home.location'), value: txt('business', 'location'), href: contact.maps_url },
    { icon: 'music', label: t('home.music'), value: business.music, href: business.music_url },
    { icon: 'instagram', label: t('home.instagram'), value: '@' + contact.instagram_url.split('/').filter(Boolean).pop()!.split('?')[0], href: contact.instagram_url },
  ]

  return (
    <>
      <section className="hero">
        {landing.video ? (
          <video src={mediaUrl(landing.video)} poster={mediaUrl(landing.images[0])} autoPlay muted loop playsInline preload="metadata" />
        ) : (
          <img className="hero-fallback" src={mediaUrl(landing.images[0])} alt="" />
        )}
        <div className="hero-top">
          <LangPicker />
        </div>
        <div className="hero-content">
          <motion.img
            className="hero-logo"
            src={mediaUrl('logo.png')}
            alt={business.name}
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          />
          <motion.h1 key={`h-${lang}`} variants={fadeUp} initial="hidden" animate="show" custom={1}>
            {txt('landing', 'headline')}
          </motion.h1>
          <motion.p key={`p-${lang}`} variants={fadeUp} initial="hidden" animate="show" custom={2}>
            {txt('landing', 'subheadline')}
          </motion.p>
          <motion.div className="hero-actions" variants={fadeUp} initial="hidden" animate="show" custom={3}>
            <motion.div whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.05 }}>
              <Link to="/menu" className="btn solid"><Icon name="menu" /> {t('home.viewMenu')}</Link>
            </motion.div>
            <motion.a whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.05 }} className="btn" href={contact.instagram_url} target="_blank" rel="noreferrer">
              <Icon name="instagram" /> {t('home.instagram')}
            </motion.a>
            <InstallButton />
          </motion.div>
        </div>
      </section>

      <div className="page">
        <motion.div className="section award" variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
          <span className="trophy">🏆</span>
          <div>
            <small className="gold upper" style={{ fontSize: 11, fontWeight: 700 }}>🥇 {t('home.winners')}</small>
            <h3>{txt('business', 'award')}</h3>
            <span className="muted" style={{ fontSize: 13 }}>{t('home.awardText')}</span>
          </div>
        </motion.div>

        <div className="section info-grid">
          {info.map((it, i) => (
            <motion.a
              key={it.icon}
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
              <h2>{t('home.featured')}</h2>
              <Link to="/menu">{t('home.seeAll')}</Link>
            </div>
            <div className="hscroll">
              {featured.map((p) => {
                const name = localized(p, 'name', lang)
                return (
                  <motion.div key={p.id} className="card feature-card" whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }}>
                    <Link to={`/menu?p=${p.id}`}>
                      <div className="ph">
                        {p.images[0] ? <img src={mediaUrl(p.images[0])} alt={name} loading="lazy" /> : <PlaceholderArt />}
                      </div>
                      <div className="body">
                        <h3>{name}</h3>
                        <span className="gold" style={{ fontWeight: 700 }}>{formatCOP(p.price)}</span>
                      </div>
                    </Link>
                  </motion.div>
                )
              })}
            </div>
          </section>
        )}

        <section className="section">
          <div className="section-title">
            <h2>{t('home.gallery')}</h2>
            <span className="muted" style={{ fontSize: 12 }}>{t('home.tapToZoom')}</span>
          </div>
          <div className="hscroll">
            {landing.images.map((src, i) => (
              <motion.button
                key={src + i}
                className="gallery-item"
                onClick={() => setOpen(src)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                aria-label={t('home.openPhoto', { n: i + 1 })}
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
              <h3>{t('home.cardTitle')}</h3>
              <span className="muted" style={{ fontSize: 13 }}>{t('home.cardText')}</span>
            </div>
            <Icon name="arrowRight" className="flip-rtl" style={{ width: 22, height: 22, color: 'var(--gold)' }} />
          </Link>
        </motion.div>

        <footer className="footer">
          {business.name} · {txt('business', 'location')}
          <br />
          <Link to="/privacidad">{t('home.privacy')}</Link>
        </footer>
      </div>

      <ImageViewer
        open={open !== null}
        images={open ? [open] : []}
        layoutId={`gallery-${open}`}
        alt={business.name}
        onClose={() => setOpen(null)}
      />
    </>
  )
}
