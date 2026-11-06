// Web NFC (solo Chrome en Android). iPhone lee los tags por sí mismo y abre la URL grabada.

interface NfcRecord {
  recordType: string
  encoding?: string
  data?: DataView
}

interface NdefReaderLike {
  scan: (opts?: { signal?: AbortSignal }) => Promise<void>
  onreading: ((e: { message: { records: NfcRecord[] } }) => void) | null
  onreadingerror: (() => void) | null
}

export function nfcSupported(): boolean {
  return typeof window !== 'undefined' && 'NDEFReader' in window
}

/** Textos legibles (URL o texto) de los registros de un tag. */
export function nfcRecordsToTexts(records: NfcRecord[]): string[] {
  const out: string[] = []
  for (const r of records) {
    if (!r.data || (r.recordType !== 'url' && r.recordType !== 'absolute-url' && r.recordType !== 'text')) continue
    out.push(new TextDecoder(r.encoding || 'utf-8').decode(r.data))
  }
  return out
}

/** Escucha tags NFC hasta que `signal` se aborte. Llama a `onTexts` con los textos de cada tag leído. */
export async function listenNfc(signal: AbortSignal, onTexts: (texts: string[]) => void, onError: () => void): Promise<void> {
  const Reader = (window as unknown as { NDEFReader: new () => NdefReaderLike }).NDEFReader
  const reader = new Reader()
  reader.onreading = (e) => onTexts(nfcRecordsToTexts(e.message.records))
  reader.onreadingerror = onError
  await reader.scan({ signal })
}
