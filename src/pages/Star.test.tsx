import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CustomerProvider } from '../context/Customer'
import Star from './Star'

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('Star (escaneo sin registro)', () => {
  it('si el cliente cierra el registro, puede volver a abrirlo en vez de quedarse esperando', async () => {
    render(
      <MemoryRouter initialEntries={['/estrella?k=clave']}>
        <CustomerProvider>
          <Routes><Route path="/estrella" element={<Star />} /></Routes>
        </CustomerProvider>
      </MemoryRouter>,
    )
    expect(await screen.findByText('Regístrate')).toBeTruthy()
    fireEvent.click(document.querySelector('.sheet-backdrop')!)
    const btn = await screen.findByRole('button', { name: /crear mi tarjeta/i })
    fireEvent.click(btn)
    expect(await screen.findByText('Regístrate')).toBeTruthy()
  })
})
