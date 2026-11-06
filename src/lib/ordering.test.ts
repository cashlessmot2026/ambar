import { describe, expect, it } from 'vitest'
import { isOrderingEnabled } from './ordering'
import type { Settings } from './types'

describe('isOrderingEnabled', () => {
  it('sin settings o sin la clave → activo', () => {
    expect(isOrderingEnabled(undefined)).toBe(true)
    expect(isOrderingEnabled({} as Settings)).toBe(true)
  })
  it('respeta el interruptor', () => {
    expect(isOrderingEnabled({ ordering: { enabled: false } } as Settings)).toBe(false)
    expect(isOrderingEnabled({ ordering: { enabled: true } } as Settings)).toBe(true)
  })
})
