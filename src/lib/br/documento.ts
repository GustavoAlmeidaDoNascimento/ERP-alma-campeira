/** CPF/CNPJ: armazenamento só com dígitos; formatação para exibição. */

export function apenasDigitos(s: string): string {
  return s.replace(/\D/g, '')
}

export function formatarCep(digitos: string): string {
  const d = apenasDigitos(digitos).slice(0, 8)
  if (d.length <= 5) return d
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

export function formatarCpf(digitos: string): string {
  const d = apenasDigitos(digitos).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

export function formatarCnpj(digitos: string): string {
  const d = apenasDigitos(digitos).slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

export function formatarDocumento(tipo: 'cnpj' | 'cpf', digitos: string | null | undefined): string {
  if (!digitos) return ''
  return tipo === 'cpf' ? formatarCpf(digitos) : formatarCnpj(digitos)
}

function cpfInvalidoObvio(d: string): boolean {
  if (d.length !== 11) return true
  if (/^(\d)\1{10}$/.test(d)) return true
  return false
}

export function validarCpf(digitos: string): boolean {
  const d = apenasDigitos(digitos)
  if (cpfInvalidoObvio(d)) return false
  let s = 0
  for (let i = 0; i < 9; i++) s += parseInt(d[i]!, 10) * (10 - i)
  let r = (s * 10) % 11
  if (r === 10) r = 0
  if (r !== parseInt(d[9]!, 10)) return false
  s = 0
  for (let i = 0; i < 10; i++) s += parseInt(d[i]!, 10) * (11 - i)
  r = (s * 10) % 11
  if (r === 10) r = 0
  return r === parseInt(d[10]!, 10)
}

function cnpjInvalidoObvio(d: string): boolean {
  if (d.length !== 14) return true
  if (/^(\d)\1{13}$/.test(d)) return true
  return false
}

export function validarCnpj(digitos: string): boolean {
  const d = apenasDigitos(digitos)
  if (cnpjInvalidoObvio(d)) return false
  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  let s = 0
  for (let i = 0; i < 12; i++) s += parseInt(d[i]!, 10) * pesos1[i]!
  let r = s % 11
  const dv1 = r < 2 ? 0 : 11 - r
  if (dv1 !== parseInt(d[12]!, 10)) return false
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  s = 0
  for (let i = 0; i < 13; i++) s += parseInt(d[i]!, 10) * pesos2[i]!
  r = s % 11
  const dv2 = r < 2 ? 0 : 11 - r
  return dv2 === parseInt(d[13]!, 10)
}
