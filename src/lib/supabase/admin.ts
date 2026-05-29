/**
 * Cliente admin para uso exclusivo em Server Actions.
 *
 * Conecta ao PostgREST local usando o JWT de service_role (que bypassa RLS),
 * exatamente como o service_role key do Supabase fazia.
 *
 * A propriedade `.storage` é sobrescrita com a implementação local
 * (sistema de arquivos em /var/www/erp-uploads) para substituir o
 * Supabase Storage sem alterar o código consumidor.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createLocalStorage } from '@/lib/storage'

export function createAdminClient() {
  const postgrestUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!postgrestUrl || !serviceKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados. Adicione ao .env.local'
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = createSupabaseClient(postgrestUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as any

  // Substitui o storage do Supabase por armazenamento local em filesystem
  client.storage = createLocalStorage()

  return client
}
