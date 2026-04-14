import { randomBytes } from 'crypto'

// Alfabeto Crockford base32 sem caracteres ambíguos (I, L, O, U).
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/**
 * Gera um código "forte" no formato `PREFIX-XXXXXXXX`, onde o sufixo é
 * uma string aleatória de `length` caracteres (padrão 8) em base32.
 *
 * Usado para gerar códigos não-sequenciais e difíceis de adivinhar para
 * novas entidades (facas, matérias-primas, consumíveis, pedidos, OCs, etc.).
 * Registros antigos com códigos sequenciais permanecem intactos.
 */
export function gerarCodigoForte(prefix: string, length = 8): string {
  const bytes = randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length]
  }
  return `${prefix}-${out}`
}
