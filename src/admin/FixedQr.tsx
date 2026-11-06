import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'

/** URL pública de la app (sin el hash), p. ej. https://ambar.ejemplo.com/ */
export function appBase(): string {
  return window.location.origin + window.location.pathname
}

/** QR fijo (la URL no cambia nunca) con descarga en PNG y copia del enlace. */
export function FixedQr({ url, alt, filename, children }: { url: string; alt: string; filename: string; children?: React.ReactNode }) {
  const [png, setPng] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    void QRCode.toDataURL(url, { width: 1024, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#0E0E10', light: '#FFFFFF' } }).then(setPng)
  }, [url])

  return (
    <div className="qr-box">
      <div>
        {png && <img src={png} alt={alt} />}
        {png && (
          <a className="btn solid block" style={{ marginTop: 12 }} href={png} download={filename}>
            <Icon name="download" /> Descargar PNG
          </a>
        )}
      </div>
      <div className="card panel">
        {children}
        <h2 style={{ marginTop: 16 }}>Enlace</h2>
        <div className="code">{url}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <button
            className="btn sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url)
                setCopied(true)
                window.setTimeout(() => setCopied(false), 2000)
              } catch { /* sin portapapeles */ }
            }}
          >
            <Icon name={copied ? 'check' : 'qr'} /> {copied ? 'Copiado' : 'Copiar enlace'}
          </button>
          <a className="btn ghost sm" href={url} target="_blank" rel="noreferrer"><Icon name="arrowRight" /> Abrir</a>
        </div>
      </div>
    </div>
  )
}
