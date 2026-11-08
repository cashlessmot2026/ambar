import { useState } from 'react'
import { useI18n } from '../i18n/I18n'
import { getPosition, type GeoError } from '../lib/geo'
import type { Coords } from '../lib/types'

/** Casilla opcional "compartir mi ubicación GPS". Al marcarla pide el permiso del navegador. */
export function GpsToggle({
  value, onChange, label, hint,
}: { value: Coords | null; onChange: (c: Coords | null) => void; label?: string; hint?: string }) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<GeoError | null>(null)

  async function toggle(on: boolean) {
    setError(null)
    if (!on) return onChange(null)
    setBusy(true)
    try {
      onChange(await getPosition())
    } catch (e) {
      setError(e as GeoError)
      onChange(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="gps-toggle">
      <label className="check">
        <input type="checkbox" checked={!!value} disabled={busy} onChange={(e) => void toggle(e.target.checked)} />
        <span>
          📍 {label ?? t('auth.gps')}
          <small className="muted" style={{ display: 'block' }}>
            {busy ? t('auth.gpsLoading') : value ? `${t('auth.gpsOn')} (${value.lat.toFixed(4)}, ${value.lng.toFixed(4)})` : hint ?? t('auth.gpsHint')}
          </small>
        </span>
      </label>
      {error && <p className="error" role="alert">{t(`geo.${error}` as const)}</p>}
    </div>
  )
}
