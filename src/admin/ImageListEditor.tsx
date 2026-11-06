import { motion, Reorder } from 'motion/react'
import { useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { errorMessage, uploadImage } from '../lib/api'
import { mediaUrl } from '../lib/format'
import { useAdmin } from './useAdmin'

/** Lista de imágenes editable: subir varias, quitar y reordenar arrastrando (la primera es la portada). */
export function ImageListEditor({
  value, onChange, max = 12, accept = 'image/*', label = 'Agregar fotos',
}: { value: string[]; onChange: (v: string[]) => void; max?: number; accept?: string; label?: string }) {
  const { run } = useAdmin()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onFiles(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    setError(null)
    const urls: string[] = []
    try {
      for (const f of Array.from(files).slice(0, max - value.length)) {
        urls.push(await run((t) => uploadImage(t, f)))
      }
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      if (urls.length) onChange([...value, ...urls])
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  const isVideo = (u: string) => /\.mp4($|\?)/i.test(u)

  return (
    <div>
      <Reorder.Group axis="x" values={value} onReorder={onChange} className="imgs" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {value.map((src, i) => (
          <Reorder.Item key={src} value={src} className="img-tile" whileDrag={{ scale: 1.1, zIndex: 5 }}>
            {isVideo(src) ? <video src={mediaUrl(src)} muted /> : <img src={mediaUrl(src)} alt="" draggable={false} />}
            {i === 0 && max > 1 && <span className="first">Portada</span>}
            <div className="acts">
              <button type="button" onClick={() => onChange(value.filter((v) => v !== src))} aria-label="Quitar">
                <Icon name="trash" />
              </button>
            </div>
          </Reorder.Item>
        ))}
        {value.length < max && (
          <motion.li style={{ listStyle: 'none' }} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <label className="img-add">
              <span>
                <Icon name={busy ? 'download' : 'plus'} />
                {busy ? 'Subiendo…' : label}
              </span>
              <input ref={input} type="file" accept={accept} multiple={max > 1} hidden disabled={busy} onChange={(e) => void onFiles(e.target.files)} />
            </label>
          </motion.li>
        )}
      </Reorder.Group>
      {max > 1 && value.length > 1 && <small className="muted">Arrastra para reordenar. La primera es la portada.</small>}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
