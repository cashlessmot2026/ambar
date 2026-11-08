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

  const ana = { id: '1', name: 'Ana', address: 'Calle 1', phone: '3001112233', stars: 0, pending_reward_id: null, created_at: '' }

  it('signUp guarda token y cliente', async () => {
    vi.spyOn(api, 'registerAccount').mockResolvedValue({ token: 'z'.repeat(64), customer: ana })
    const out: { v?: ReturnType<typeof useCustomer> } = {}
    render(<CustomerProvider><Probe out={out} /></CustomerProvider>)
    await act(async () => {
      await out.v!.signUp({
        name: 'Ana', email: 'ana@x.co', phone: '3001112233', birthday: '1990-01-01', address: 'Calle 1',
        pin: '1234', consent: true, coords: null,
      })
    })
    expect(out.v?.customer?.name).toBe('Ana')
    expect(localStorage.getItem(TOKEN_KEY)).toBe('z'.repeat(64))
  })

  it('signIn con PIN incorrecto no inicia sesión', async () => {
    vi.spyOn(api, 'login').mockRejectedValue(new ApiError('invalid_credentials'))
    const out: { v?: ReturnType<typeof useCustomer> } = {}
    render(<CustomerProvider><Probe out={out} /></CustomerProvider>)
    await expect(out.v!.signIn('ana@x.co', '0000')).rejects.toThrow('invalid_credentials')
    expect(out.v?.customer).toBeNull()
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  it('signOut borra la sesión local y avisa al servidor', async () => {
    localStorage.setItem(TOKEN_KEY, 'w'.repeat(64))
    vi.spyOn(api, 'getMyCard').mockResolvedValue(ana)
    const logoutSpy = vi.spyOn(api, 'logout').mockResolvedValue(undefined)
    const out: { v?: ReturnType<typeof useCustomer> } = {}
    render(<CustomerProvider><Probe out={out} /></CustomerProvider>)
    await waitFor(() => expect(out.v?.customer?.name).toBe('Ana'))
    act(() => out.v!.signOut())
    expect(logoutSpy).toHaveBeenCalledWith('w'.repeat(64))
    expect(out.v?.customer).toBeNull()
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })
})
