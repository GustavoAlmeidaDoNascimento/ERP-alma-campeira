/**
 * Faz login pelo fluxo local (/api/auth/login), reutiliza o cookie `erp-session`
 * retornado pela API e mede HTTP RSC nas rotas autenticadas.
 *
 * Uso: node scripts/login-and-bench.mjs --label before
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnv() {
  const file = resolve(process.cwd(), '.env.local')
  const text = readFileSync(file, 'utf8')
  const env = {}
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\r$/, '').trim()
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return env
}

const env = loadEnv()
const EMAIL = process.env.EMAIL ?? 'cutelariaalmacampeira1@gmail.com'
const PASSWORD = process.env.PASSWORD ?? 'controle1'
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000'
const label = process.argv.includes('--label')
  ? process.argv[process.argv.indexOf('--label') + 1]
  : 'run'

const ROUTES = ['/inicio', '/materias-primas', '/facas', '/fornecedores', '/clientes']

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error('Login: ' + (body?.error ?? res.statusText))
  const raw = res.headers.get('set-cookie')
  if (!raw) throw new Error('Login: resposta sem cookie de sessão')
  const cookie = raw.split(',').find((part) => part.includes('erp-session=')) ?? raw
  return cookie.split(';')[0]
}

async function measure(path, cookie) {
  const url = `${BASE}${path}`
  const start = performance.now()
  const res = await fetch(url, {
    redirect: 'manual',
    headers: cookie ? { cookie, 'rsc': '1' } : {},
  })
  await res.arrayBuffer().catch(() => null)
  const ms = Math.round(performance.now() - start)
  return { path, status: res.status, ms }
}

async function main() {
  console.log(`\n=== Bench [${label}] ${BASE} (login: ${EMAIL}) ===`)
  const cookie = await login()

  // Simula fluxo do usuário: 1ª hit dispara ErpLayout (que prefetcha as listas).
  // Aguarda 800ms pra dar tempo do prefetch popular os caches em background.
  console.log('\nFLUXO REAL (login → /inicio → cada rota):')
  console.log('  warming layout...')
  await measure('/inicio', cookie)
  await new Promise((r) => setTimeout(r, 1500))
  for (const r of ROUTES) {
    const t = await measure(r, cookie)
    const icon = t.ms <= 700 ? '✓' : t.ms <= 2000 ? '~' : '✗'
    console.log(`${icon} ${r.padEnd(20)} ${String(t.ms).padStart(5)}ms (status ${t.status})`)
  }

  // Primeira hit sem warmup nenhum (cache global zerado) — pior caso teórico
  console.log('\nCOLD ABSOLUTO (sem nenhum warmup — apenas pra referência):')
  // Não dá pra realmente zerar o cache em runtime, mas após o fluxo acima
  // as caches estão populadas pela vida útil de revalidate (60s).

  console.log('\nWARM (3 amostras após warmup):')
  const results = []
  for (const r of ROUTES) {
    const samples = []
    for (let i = 0; i < 3; i++) samples.push((await measure(r, cookie)).ms)
    const min = Math.min(...samples)
    const med = samples.sort((a, b) => a - b)[1]
    results.push({ path: r, min, med, samples })
    const icon = med <= 700 ? '✓' : med <= 2000 ? '~' : '✗'
    console.log(`${icon} ${r.padEnd(20)} med=${String(med).padStart(5)}ms min=${String(min).padStart(5)}ms  [${samples.join(', ')}]`)
  }
  const avg = Math.round(results.reduce((s, r) => s + r.med, 0) / results.length)
  const max = Math.max(...results.map((r) => r.med))
  console.log(`\nMediana média: ${avg}ms | Pior mediana: ${max}ms | Meta: ≤700ms\n`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
