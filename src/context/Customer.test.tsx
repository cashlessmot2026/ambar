import { act, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from '../lib/api'
import { CustomerProvider, TOKEN_KEY, useCustomer } from './Customer'

function Probe({ out }: { out: { v?: ReturnType<typeof useCustomer> } }) {
  out.v = useCustomer()
  return null
}

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('useCustomer', () => {
  it('token inválido → limpia la sesión y queda sin cliente', async () => {
    localStorage.setItem(TOKEN_KEY, 'x'.repeat(64))
    vi.spyOn(api, 'getMyCard').mockRejectedValue(new ApiError('invalid_token'))
    const out: { v?: ReturnType<typeof useCustomer> } = {}
    render(<CustomerProvider><Probe out={out} /></CustomerProvider>)
    await waitFor(() => expect(out.v?.ready).toBe(true))
    expect(out.v?.customer).toBeNull()
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  it('error de red → conserva el token', async () => {
    localStorage.setItem(TOKEN_KEY, 'y'.repeat(64))
    vi.spyOn(api, 'getMyCard').mockRejectedValue(new ApiError('network'))
    const out: { v?: ReturnType<typeof useCustomer> } = {}
    render(<CustomerProvider><Probe out={out} /></CustomerProvider>)
    await waitFor(() => expect(out.v?.ready).toBe(true))
    expect(localStorage.getItem(TOKEN_KEY)).toBe('y'.repeat(64))
  })

  it('register guarda token y cliente', async () => {
    vi.spyOn(api, 'register').mockResolvedValue({
      token: 'z'.repeat(64),
      customer: { id: '1', name: 'Ana', address: 'Calle 1', phone: '3001112233', stars: 0, pending_reward_id: null, created_at: '' },
    })
    const out: { v?: ReturnType<typeof useCustomer> } = {}
    render(<CustomerProvider><Probe out={out} /></CustomerProvider>)
    await act(async () => { await out.v!.register('Ana', 'Calle 1', '3001112233', true) })
    expect(out.v?.customer?.name).toBe('Ana')
    expect(localStorage.getItem(TOKEN_KEY)).toBe('z'.repeat(64))
  })
})
