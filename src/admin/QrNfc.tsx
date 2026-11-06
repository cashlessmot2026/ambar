import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { useAdmin } from './useAdmin'

/** URL pública de la app (sin el hash), p. ej. https://ambar.ejemplo.com/ */
function appBase(): string {
  return window.location.origin + window.location.pathname
}

export default function QrNfc() {
  const { data } = useAdmin()
  const [png, setPng] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const url = data ? `${appBase()}#/estrella?k=${data.business_key}` : ''

  useEffect(() => {
    if (!url) return
    void QRCode.toDataURL(url, { width: 1024, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#0E0E10', light: '#FFFFFF' } }).then(setPng)
  }, [url])

  if (!data) return <div className="spinner" />
  const local = /localhost|127\.0\.0\.1/.test(window.location.hostname)

  return (
    <>
      <h1>QR y tag NFC</h1>
      {local && (
        <p className="error">Estás en un servidor local. Genera e imprime el QR desde el dominio público donde publiques la app, para que apunte a la dirección correcta.</p>
      )}
      <div className="qr-box">
        <div>
          {png && <img src={png} alt="Código QR para sumar estrellas" />}
          {png && (
            <a className="btn solid block" style={{ marginTop: 12 }} href={png} download="ambar-qr-estrellas.png">
              <Icon name="download" /> Descargar PNG
            </a>
          )}
        </div>
        <div className="card panel">
          <h2>Cómo funciona</h2>
          <p style={{ fontSize: 14 }}>
            Este QR es único y fijo para Ámbar. Cuando un cliente lo escanea (o acerca su celular al tag NFC), se abre la app y se le suma
            <strong className="gold"> 1 estrella</strong>. Si el cliente tocó “Canjear” en su tarjeta, ese escaneo canjea el premio y sus estrellas vuelven a 0.
          </p>
          <h2 style={{ marginTop: 16 }}>URL para el tag NFC</h2>
          <div className="code">{url}</div>
          <button
            className="btn sm"
            style={{ marginTop: 10 }}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url)
                setCopied(true)
                window.setTimeout(() => setCopied(false), 2000)
              } catch { /* sin portapapeles */ }
            }}
          >
            <Icon name={copied ? 'check' : 'nfc'} /> {copied ? 'Copiada' : 'Copiar URL'}
          </button>
          <ol className="muted" style={{ fontSize: 13, paddingLeft: 18, marginTop: 14 }}>
            <li>Instala una app para grabar NFC (por ejemplo “NFC Tools”).</li>
            <li>Elige Escribir → Agregar registro → URL/URI y pega la URL de arriba.</li>
            <li>Acerca el tag NTAG213/215 al celular para grabarlo. Opcional: bloquéalo para que nadie lo cambie.</li>
          </ol>
          <p className="muted" style={{ fontSize: 12 }}>No compartas esta URL públicamente: quien la tenga puede sumar estrellas.</p>
        </div>
      </div>
    </>
  )
}
