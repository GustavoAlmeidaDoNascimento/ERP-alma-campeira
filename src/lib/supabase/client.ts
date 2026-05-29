'use client'

/**
 * Cliente Supabase para uso em Client Components.
 *
 * Não conecta mais diretamente ao Supabase — delega auth para nossas
 * próprias API routes (/api/auth/*) e mantém o mesmo contrato de interface
 * que o @supabase/supabase-js usava, para que os componentes não precisem
 * de alterações.
 *
 * Operações de banco de dados (from/select/insert/etc.) NÃO devem ser
 * feitas no cliente — use Server Actions.
 */

async function apiCall(path: string, options?: RequestInit) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = await res.json().catch(() => ({}))
  return { data, error: res.ok ? null : data }
}

let _client: ReturnType<typeof buildClient> | null = null

function buildClient() {
  return {
    auth: {
      async getUser() {
        const { data, error } = await apiCall('/api/auth/user')
        if (error || !data?.user) return { data: { user: null }, error }
        return { data: { user: data.user }, error: null }
      },

      async signInWithPassword({ email, password }: { email: string; password: string }) {
        const { data, error } = await apiCall('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        })
        if (error) return { data: null, error: { message: error.error ?? 'Erro ao fazer login' } }
        return { data: { user: data.user }, error: null }
      },

      async signOut() {
        await apiCall('/api/auth/logout', { method: 'POST' })
        return { error: null }
      },

      async updateUser({ password, currentPassword }: { password?: string; currentPassword?: string }) {
        const { data, error } = await apiCall('/api/auth/password', {
          method: 'PATCH',
          body: JSON.stringify({ password, currentPassword }),
        })
        if (error) return { data: null, error: { message: error.error ?? 'Erro ao atualizar senha' } }
        return { data, error: null }
      },
    },

    // Realtime: no-op (substituído por polling no RealtimeProvider)
    channel: (_name: string) => ({
      on: (_event: string, _filter: unknown, _cb: unknown) => ({
        subscribe: (_cb2?: unknown) => ({ unsubscribe: () => {} }),
      }),
    }),
    removeChannel: (_channel: unknown) => {},

    // Storage: não usado no cliente
    storage: {
      from: (_bucket: string) => ({
        getPublicUrl: (_path: string) => ({ data: { publicUrl: '' } }),
      }),
    },
  }
}

export function createClient() {
  if (!_client) _client = buildClient()
  return _client
}
