import type { Menu } from './types'

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** ¿La hora `now` cae dentro de la ventana del menú? Soporta ventanas que cruzan medianoche. */
export function isMenuActiveAt(menu: Menu, now: Date): boolean {
  const t = now.getHours() * 60 + now.getMinutes()
  const start = toMinutes(menu.start_time)
  const end = toMinutes(menu.end_time)
  return start <= end ? t >= start && t <= end : t >= start || t <= end
}

/** Menús ordenados: los que aplican a la hora actual primero, luego por `sort`. */
export function orderMenus(menus: Menu[], now: Date): Menu[] {
  return [...menus].sort((a, b) => {
    const pa = isMenuActiveAt(a, now) ? 0 : 1
    const pb = isMenuActiveAt(b, now) ? 0 : 1
    return pa - pb || a.sort - b.sort
  })
}
