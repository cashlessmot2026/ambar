import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QrScanner } from './StarScanner'

afterEach(() => vi.restoreAllMocks())

function mockCamera(impl: () => Promise<MediaStream>) {
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(impl) } })
}

describe('QrScanner', () => {
  it('permiso de cámara negado → explica cómo activarlo', async () => {
    mockCamera(() => Promise.reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' })))
    render(<QrScanner onKey={() => {}} onClose={() => {}} />)
    expect(await screen.findByText(/Permite el acceso a la cámara/)).toBeTruthy()
  })
  it('sin cámara → mensaje', async () => {
    mockCamera(() => Promise.reject(Object.assign(new Error('none'), { name: 'NotFoundError' })))
    render(<QrScanner onKey={() => {}} onClose={() => {}} />)
    expect(await screen.findByText(/No encontramos una cámara/)).toBeTruthy()
  })
  it('al cerrar apaga la cámara', async () => {
    const stop = vi.fn()
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream
    mockCamera(() => Promise.resolve(stream))
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    const { unmount } = render(<QrScanner onKey={() => {}} onClose={() => {}} />)
    await screen.findByText(/Apunta la cámara/)
    await new Promise((r) => setTimeout(r, 20))
    unmount()
    expect(stop).toHaveBeenCalled()
  })
})
