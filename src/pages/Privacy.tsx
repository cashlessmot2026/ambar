import { TopBar } from '../components/TopBar'
import { useAppData } from '../context/AppData'
import { useI18n } from '../i18n/I18n'

export default function Privacy() {
  const { data } = useAppData()
  const { t, lang } = useI18n()
  const phone = data?.settings.contact.whatsapp ?? '573229089680'
  const pretty = `+${phone.slice(0, 2)} ${phone.slice(2, 5)} ${phone.slice(5)}`
  const [before, after] = t('privacy.how').split('{phone}')
  return (
    <>
      <TopBar />
      <article className="page prose" style={{ maxWidth: 720 }}>
        <h1>{t('privacy.title')}</h1>
        {lang !== 'es' && <p className="muted" style={{ fontStyle: 'italic' }}>{t('privacy.prevails')}</p>}
        <p>{t('privacy.intro')}</p>
        <h2>{t('privacy.dataTitle')}</h2>
        <p>{t('privacy.data')}</p>
        <h2>{t('privacy.purposesTitle')}</h2>
        <ul>
          <li>{t('privacy.p1')}</li>
          <li>{t('privacy.p2')}</li>
          <li>{t('privacy.p3')}</li>
        </ul>
        <h2>{t('privacy.rightsTitle')}</h2>
        <p>{t('privacy.rights')}</p>
        <h2>{t('privacy.howTitle')}</h2>
        <p>
          {before}
          <a className="gold" dir="ltr" href={`https://wa.me/${phone}`}>{pretty}</a>
          {after}
        </p>
        <h2>{t('privacy.securityTitle')}</h2>
        <p>{t('privacy.security')}</p>
        <p className="muted">{t('privacy.version')}</p>
      </article>
    </>
  )
}
