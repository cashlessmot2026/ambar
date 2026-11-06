import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api, errorMessage } from './api'
import { supabase } from './supabase'

afterEach(() => vi.restoreAllMocks())

describe('api.admin.login', () => {
  it('contraseña incorrecta (RPC devuelve null) → ApiError invalid_password', async () => {
    vi.spyOn(supabase, 'rpc').mockResolvedValue({ data: null, error: null } as never)
    await expect(api.admin.login('mal')).rejects.toMatchObject({ code: 'invalid_password' })
  })
  it('bloqueo por intentos → mensaje claro', async () => {
    vi.spyOn(supabase, 'rpc').mockResolvedValue({ data: null, error: { message: 'too_many_attempts' } } as never)
    const err = await api.admin.login('x').catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(errorMessage(err)).toMatch(/demasiados intentos/i)
  })
})

describe('errorMessage', () => {
  it('teléfono registrado con otro nombre', () => {
    expect(errorMessage(new ApiError('phone_in_use'))).toMatch(/mismo nombre/i)
  })
})
