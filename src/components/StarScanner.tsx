import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../i18n/I18n'
import type { Key } from '../i18n/locales/es'
import { haptic } from '../lib/haptics'
import { listenNfc } from '../lib/nfc'
import { extractStarKey } from '../lib/scan'
import { Icon } from './Icon'

interface BarcodeDetectorLike {
  detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]>
}
type BarcodeDetectorCtor = new (opts: { formats: string[] }) => BarcodeDetectorLike

/** Detector nativo si el navegador lo trae (Chrome/Android); si no, jsQR cargado bajo demanda. */
async function makeDecoder(): Promise<(video: HTMLVideoElement, canvas: HTMLCanvasElement) => Promise<string | null>> {
  const BD = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor & { getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector
  if (BD) {
    try {
      const formats = (await BD.getSupportedFormats?.()) ?? ['qr_code']
      if (formats.includes('qr_code')) {
        const det = new BD({ formats: ['qr_code'] })
        return async (video) => (await det.detect(video))[0]?.rawValue ?? null
      }
    } catch { /* usar jsQR */ }
  }
  const jsQR = (await import('jsqr')).default
  return async (video, canvas) => {
    const w = video.videoWidth
    const h = video.videoHeight
    if (!w || !h) return null
    const scale = Math.min(1, 640 / Math.max(w, h))
    canvas.width = Math.round(w * scale)
    canvas.height = Math.round(h * scale)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
    return jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data ?? null
  }
}

function cameraErrorKey(e: unknown): Key {
  const name = (e as { name?: string })?.name
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'scan.denied'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'scan.noCamera'
  return 'scan.cameraError'
}

/** Vista de cámara que busca el QR de Ámbar. Llama a onKey una sola vez y apaga la cámara al salir. */
export function QrScanner({ onKey, onClose }: { onKey: (key: string) => void; onClose: () => void }) {
  const { t } = useI18n()
  const video = useRef<HTMLVideoElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<Key | null>(null)
  const [wrong, setWrong] = useState(false)

  useEffect(() => {
    let stream: MediaStream | null = null
    let stopped = false
    let raf = 0
    let busy = false
    let lastWrong = 0

    const stop = () => {
      stopped = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((tr) => tr.stop())
    }

    ;(async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('no media'), { name: 'NotFoundError' })
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        if (stopped) return stop()
        const v = video.current
        if (!v) return
        v.srcObject = stream
        v.setAttribute('playsinline', 'true')
        await v.play()
        const decode = await makeDecoder()
        const tick = async () => {
          if (stopped) return
          if (!busy && v.readyState >= 2) {
            busy = true
            try {
              const text = await decode(v, canvas.current!)
              if (text && !stopped) {
                const key = extractStarKey(text)
                if (key) {
                  haptic(30)
                  stop()
                  onKey(key)
                  return
                }
                if (Date.now() - lastWrong > 2500) {
                  lastWrong = Date.now()
                  setWrong(true)
                  window.setTimeout(() => setWrong(false), 2500)
                }
              }
            } catch { /* fotograma no legible */ }
            busy = false
          }
          raf = requestAnimationFrame(() => void tick())
        }
        raf = requestAnimationFrame(() => void tick())
      } catch (e) {
        if (!stopped) setError(cameraErrorKey(e))
      }
    })()

    return stop
  }, [onKey])

  return (
    <div className="scanner">
      <video ref={video} muted playsInline className="scanner-video" />
      <canvas ref={canvas} hidden />
      <div className="scanner-frame" aria-hidden="true">
        <motion.span className="scanner-line" animate={{ top: ['8%', '88%', '8%'] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }} />
      </div>
      <div className="scanner-msg" role="status">
        {error ? t(error) : wrong ? t('scan.notAmbar') : t('scan.aim')}
      </div>
      <button className="btn ghost scanner-close" onClick={onClose}><Icon name="x" /> {t('scan.cancel')}</button>
    </div>
  )
}

/** Lector NFC (Web NFC, Chrome Android). */
function NfcReader({ onKey, onClose }: { onKey: (key: string) => void; onClose: () => void }) {
  const { t } = useI18n()
  const [msg, setMsg] = useState<Key>('scan.nfcWaiting')

  useEffect(() => {
    const ctrl = new AbortController()
    listenNfc(
      ctrl.signal,
      (texts) => {
        const key = texts.map(extractStarKey).find((k): k is string => !!k)
        if (key) {
          haptic(30)
          ctrl.abort()
          onKey(key)
        } else setMsg('scan.notAmbar')
      },
      () => setMsg('scan.nfcError'),
    ).catch((e) => {
      if (ctrl.signal.aborted) return
      setMsg((e as { name?: string })?.name === 'NotAllowedError' ? 'scan.denied' : 'scan.nfcError')
    })
    return () => ctrl.abort()
  }, [onKey])

  return (
    <div className="scanner nfc">
      <motion.div className="nfc-pulse" animate={{ scale: [1, 1.25, 1], opacity: [0.9, 0.4, 0.9] }} transition={{ duration: 1.6, repeat: Infinity }}>
        <Icon name="nfc" />
      </motion.div>
      <div className="scanner-msg" role="status">{t(msg)}</div>
      <button className="btn ghost scanner-close" onClick={onClose}><Icon name="x" /> {t('scan.cancel')}</button>
    </div>
  )
}

/** Hoja a pantalla completa con la cámara o el lector NFC. */
export function ScanSheet({ mode, onKey, onClose }: { mode: 'qr' | 'nfc' | null; onKey: (key: string) => void; onClose: () => void }) {
  return createPortal(
    <AnimatePresence>
      {mode && (
        <motion.div className="scan-sheet" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          {mode === 'qr' ? <QrScanner onKey={onKey} onClose={onClose} /> : <NfcReader onKey={onKey} onClose={onClose} />}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
