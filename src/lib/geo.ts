import type { Coords } from './types'

export type GeoError = 'unsupported' | 'denied' | 'unavailable'

/** Pide la ubicación del celular (GPS). Rechaza con un GeoError. */
export function getPosition(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return reject('unsupported' satisfies GeoError)
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: Math.round(p.coords.latitude * 1e6) / 1e6, lng: Math.round(p.coords.longitude * 1e6) / 1e6 }),
      (e) => reject((e.code === e.PERMISSION_DENIED ? 'denied' : 'unavailable') satisfies GeoError),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    )
  })
}

export function mapsLink(c: { lat?: number | null; lng?: number | null } | null | undefined): string | null {
  if (!c || c.lat == null || c.lng == null) return null
  return `https://www.google.com/maps?q=${c.lat},${c.lng}`
}
