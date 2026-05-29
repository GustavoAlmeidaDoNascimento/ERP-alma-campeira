/**
 * Cliente Supabase para uso em Server Components, Server Actions e Route Handlers.
 *
 * Aponta para o PostgREST local (porta 3001) que expõe o banco PostgreSQL
 * como uma API REST idêntica à API do Supabase, portanto todo o código de
 * consulta (.from().select()...) permanece sem alterações.
 *
 * O JWT da sessão é lido do cookie `erp-session` e passado como Authorization
 * header para que o PostgREST aplique RLS corretamente.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { AsyncLocalStorage } from 'async_hooks'
import { SESSION_COOKIE_NAME } from '@/lib/session'

// Armazena o token JWT dentro de limites de unstable_cache,
// onde cookies() não pode ser chamado.
const tokenStorage = new AsyncLocalStorage<string | null>()

export async function withSupabaseCookieContext<T>(fn: () => Promise<T>): Promise<T> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null
  return tokenStorage.run(token, fn)
}

export async function createClient() {
  const postgrestUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

  // Dentro de unstable_cache: usa o token do AsyncLocalStorage
  const tokenFromContext = tokenStorage.getStore()
  let token: string | null

  if (tokenFromContext !== undefined) {
    // Estamos dentro de withSupabaseCookieContext (pode ser null se não logado)
    token = tokenFromContext
  } else {
    // Caminho normal fora de cache
    const cookieStore = await cookies()
    token = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null
  }

  return createSupabaseClient(postgrestUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  })
}
