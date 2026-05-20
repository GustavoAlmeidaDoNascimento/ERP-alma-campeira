/**
 * Loga via Supabase (signInWithPassword), grava cookies SSR no formato esperado
 * pelo @supabase/ssr e mede HTTP RSC nas rotas autenticadas.
 *
 * Uso: node scripts/login-and-bench.mjs --label before
 */
import { createClient } from '@supabase/supabase-js'
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
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const PUB_KEY = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const EMAIL = process.env.EMAIL ?? 'cutelariaalmacampeira1@gmail.com'
const PASSWORD = process.env.PASSWORD ?? 'controle1'
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000'
const label = process.argv.includes('--label')
  ? process.argv[process.argv.indexOf('--label') + 1]
  : 'run'

const ROUTES = ['/inicio', '/materias-primas', '/facas', '/fornecedores', '/clientes']

async function login() {
  const sb = createClient(SUPABASE_URL, PUB_KEY)
  const { data, error } = await sb.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
  if (error) throw new Error('Login: ' + error.message)
  return data.session
}

// Formato cookie do @supabase/ssr: nome = `sb-<ref>-auth-token`
function buildCookies(session) {
  const ref = new URL(SUPABASE_URL).hostname.split('.')[0]
  const cookieName = `sb-${ref}-auth-token`
  const value = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: session.token_type,
    user: session.user,
  })
  // @supabase/ssr fatia cookies se forem grandes — testar primeiro como base64 chunked.
  const b64 = 'base64-' + Buffer.from(value).toString('base64')
  // chunking de 3180 chars (limite do ssr)
  const CHUNK = 3180
  const chunks = []
  for (let i = 0; i < b64.length; i += CHUNK) chunks.push(b64.slice(i, i + CHUNK))
  if (chunks.length === 1) return `${cookieName}=${chunks[0]}`
  return chunks.map((c, i) => `${cookieName}.${i}=${c}`).join('; ')
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
  const session = await login()
  const cookie = buildCookies(session)

  // Aquecimento global
  for (const r of ROUTES) await measure(r, cookie)

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
