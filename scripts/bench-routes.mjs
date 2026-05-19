/**
 * Mede tempo de resposta HTTP de rotas do ERP (requer sessão em .bench-cookies.txt).
 *
 * Gerar cookies: faça login no navegador e exporte, ou use PLAYWRIGHT com storageState.
 *
 * Uso:
 *   node scripts/bench-routes.mjs
 *   node scripts/bench-routes.mjs --label after
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const BASE = process.env.BENCH_BASE_URL ?? 'http://127.0.0.1:3000'
const COOKIE_FILE = resolve(process.cwd(), '.bench-cookies.txt')
const label = process.argv.includes('--label')
  ? process.argv[process.argv.indexOf('--label') + 1]
  : 'run'

const ROUTES = [
  '/inicio',
  '/materias-primas',
  '/facas',
  '/fornecedores',
  '/clientes',
]

function cookieHeader() {
  if (!existsSync(COOKIE_FILE)) {
    console.warn('⚠ Sem .bench-cookies.txt — medições sem auth (redirecionam para /login).')
    return ''
  }
  return readFileSync(COOKIE_FILE, 'utf8').trim()
}

async function measureRoute(path, cookie) {
  const url = `${BASE}${path}`
  const start = performance.now()
  const res = await fetch(url, {
    redirect: 'manual',
    headers: cookie ? { cookie } : {},
  })
  const ms = Math.round(performance.now() - start)
  // Consumir corpo para tempo completo de transferência
  await res.arrayBuffer().catch(() => null)
  return { path, status: res.status, ms }
}

async function main() {
  const cookie = cookieHeader()
  console.log(`\n=== Bench [${label}] ${BASE} ===\n`)
  const results = []
  for (const path of ROUTES) {
    // 2 tentativas: 1ª aquece compilação, 2ª mede steady-state
    await measureRoute(path, cookie)
    const r = await measureRoute(path, cookie)
    results.push(r)
    const icon = r.ms <= 700 ? '✓' : r.ms <= 2000 ? '~' : '✗'
    console.log(`${icon} ${path} → ${r.status} em ${r.ms}ms`)
  }
  const avg = Math.round(results.reduce((s, r) => s + r.ms, 0) / results.length)
  const max = Math.max(...results.map((r) => r.ms))
  console.log(`\nMédia: ${avg}ms | Pior: ${max}ms | Meta: ≤700ms\n`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
