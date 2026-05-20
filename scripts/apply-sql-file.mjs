/**
 * Aplica um arquivo .sql arbitrário no Supabase via Management API.
 * Uso: SUPABASE_ACCESS_TOKEN=... node scripts/apply-sql-file.mjs <caminho.sql>
 */
import { readFileSync } from 'node:fs'

const PROJECT_REF = 'ztcwewlnnvujhkneqmam'
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const file = process.argv[2]

if (!ACCESS_TOKEN) {
  console.error('Defina SUPABASE_ACCESS_TOKEN.')
  process.exit(1)
}
if (!file) {
  console.error('Uso: node scripts/apply-sql-file.mjs <arquivo.sql>')
  process.exit(1)
}

const SQL = readFileSync(file, 'utf8')

const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: SQL }),
})

const body = await res.json().catch(() => ({}))
if (!res.ok) {
  console.error('Erro:', JSON.stringify(body, null, 2))
  process.exit(1)
}
console.log('OK — migration aplicada:', file)
