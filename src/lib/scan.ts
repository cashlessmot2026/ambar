/** Extrae la clave del negocio de un texto leído por QR o NFC (URL `…#/estrella?k=<clave>`). Si no es de Ámbar, null. */
export function extractStarKey(text: string): string | null {
  const m = /#\/estrella\?(?:[^#]*&)?k=([0-9a-fA-F]{16,64})(?:[&#\s]|$)/.exec(text.trim())
  return m ? m[1] : null
}
