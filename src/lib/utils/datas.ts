/** Converte ISO (yyyy-mm-dd) para exibição dd/mm/aaaa. */
export function isoParaBR(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** Converte dd/mm/aaaa para ISO; retorna null se inválido. */
export function brParaIso(br: string): string | null {
  const m = br.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  const [, d, mo, y] = m
  const day = Number(d)
  const month = Number(mo)
  const year = Number(y)
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) return null
  return `${y}-${mo}-${d}`
}

/** Máscara progressiva dd/mm/aaaa enquanto o usuário digita. */
export function mascararDataBR(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}
