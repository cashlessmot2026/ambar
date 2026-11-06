export function formatCOP(n: number): string {
  return '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/** Resuelve rutas relativas de /public y URLs absolutas por igual. */
export function mediaUrl(path: string | null | undefined): string {
  if (!path) return ''
  if (/^(https?:|data:|blob:)/.test(path)) return path
  return import.meta.env.BASE_URL + path.replace(/^\.?\//, '')
}
