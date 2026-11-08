// Alertas sonoras del panel: un "ding-dong" con Web Audio y una voz en español (Web Speech API).
// Los navegadores solo permiten sonido después de un toque del usuario, por eso hay que "desbloquear".

let ctx: AudioContext | null = null

export function audioUnlocked(): boolean {
  return !!ctx && ctx.state === 'running'
}

/** Llamar dentro de un clic/toque: habilita el audio y la voz para el resto de la sesión. */
export function unlockAudio(): void {
  try {
    ctx ??= new AudioContext()
    void ctx.resume()
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(' ')
      u.volume = 0
      window.speechSynthesis.speak(u)
    }
  } catch { /* navegador sin Web Audio */ }
}

function chime() {
  if (!ctx || ctx.state !== 'running') return
  const now = ctx.currentTime
  ;[[880, 0], [660, 0.22], [880, 0.44], [660, 0.66]].forEach(([freq, at]) => {
    const osc = ctx!.createOscillator()
    const gain = ctx!.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, now + at)
    gain.gain.exponentialRampToValueAtTime(0.5, now + at + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.2)
    osc.connect(gain).connect(ctx!.destination)
    osc.start(now + at)
    osc.stop(now + at + 0.22)
  })
}

function speak(text: string) {
  if (!('speechSynthesis' in window)) return
  const synth = window.speechSynthesis
  const u = new SpeechSynthesisUtterance(text)
  const voices = synth.getVoices()
  u.voice = voices.find((v) => v.lang === 'es-CO') ?? voices.find((v) => v.lang === 'es-US') ?? voices.find((v) => v.lang.startsWith('es')) ?? null
  u.lang = u.voice?.lang ?? 'es-CO'
  u.rate = 1
  u.volume = 1
  synth.cancel()
  synth.speak(u)
}

/** Suena la campana y, al terminar, la voz dice el mensaje. */
export function announce(message: string): void {
  chime()
  window.setTimeout(() => speak(message), 900)
}
