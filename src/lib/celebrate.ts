import confetti from 'canvas-confetti'

/** Fuegos artificiales tipo fiesta durante `ms` milisegundos. */
export function fireworks(ms = 3000): void {
  if (typeof window === 'undefined') return
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const colors = ['#D4A24C', '#F08A24', '#FFFFFF', '#FFD27A', '#E85D04']
  if (reduced) {
    void confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 }, colors, zIndex: 200 })
    return
  }
  const end = Date.now() + ms
  const timer = window.setInterval(() => {
    const left = end - Date.now()
    if (left <= 0) return window.clearInterval(timer)
    const count = Math.max(12, 50 * (left / ms))
    for (const x of [Math.random() * 0.3 + 0.1, Math.random() * 0.3 + 0.6]) {
      void confetti({
        particleCount: count, startVelocity: 32, spread: 360, ticks: 70, gravity: 0.9, zIndex: 200,
        origin: { x, y: Math.random() * 0.3 + 0.1 }, colors, scalar: 1.05,
      })
    }
  }, 260)
  void confetti({ particleCount: 140, spread: 100, startVelocity: 45, origin: { y: 0.7 }, colors, zIndex: 200 })
}
