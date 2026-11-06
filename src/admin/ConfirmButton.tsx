import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'

/** Botón de borrar en dos pasos (sin diálogos del navegador). */
export function ConfirmButton({ onConfirm, label = 'Eliminar' }: { onConfirm: () => void; label?: string }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = window.setTimeout(() => setArmed(false), 3000)
    return () => window.clearTimeout(t)
  }, [armed])
  return armed ? (
    <button type="button" className="btn sm" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={() => { setArmed(false); onConfirm() }}>
      ¿{label}?
    </button>
  ) : (
    <button type="button" className="mini danger" onClick={() => setArmed(true)} aria-label={label}>
      <Icon name="trash" />
    </button>
  )
}
