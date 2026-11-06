/** Vibración corta (Android). iOS Safari no la soporta y se ignora. Respeta "reducir movimiento". */
export function haptic(ms = 15): void {
  try {
    if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    navigator.vibrate(ms)
  } catch {
    /* sin vibración */
  }
}
