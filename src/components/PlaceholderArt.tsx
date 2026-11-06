import { mediaUrl } from '../lib/format'

export function PlaceholderArt() {
  return (
    <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: 'radial-gradient(circle at 30% 20%, color-mix(in srgb, var(--gold) 18%, transparent), transparent 60%), var(--surface-2)' }}>
      <img src={mediaUrl('logo.png')} alt="" style={{ width: '42%', opacity: 0.25 }} />
    </div>
  )
}
