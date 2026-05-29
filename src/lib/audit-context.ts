import 'server-only'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/session'

/**
 * Enriquece o próximo audit log com IP, User-Agent e user_id do request.
 * Chame no início de uma Server Action (antes da mutação) quando quiser
 * registrar esses dados.
 *
 * Usa postgres.js diretamente (não passa pelo PostgREST) porque precisa
 * chamar set_config() na mesma conexão que executará a mutação — o PostgREST
 * abriria uma transação HTTP separada.
 *
 * Os GUCs são transacionais (set_config com is_local=true) e vivem apenas
 * durante a transação atual. Neste modelo (chamada direta ao Postgres) eles
 * persistem dentro do mesmo pool connection enquanto a transação estiver ativa.
 */
export async function setAuditRequestContext(): Promise<void> {
  try {
    const h = await headers()
    const ip =
      h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      h.get('x-real-ip') ||
      null
    const ua = h.get('user-agent') || null

    const user = await getSessionUser()
    const userId = user?.id ?? null

    const sql = db()

    // set_audit_context é a função Postgres que os triggers usam para capturar
    // IP e UA. Também setamos app.user_id para que auth.uid() funcione nos triggers.
    await sql`SELECT set_audit_context(${ip}, ${ua})`

    if (userId) {
      await sql`SELECT set_config('app.user_id', ${userId}, true)`
    }
  } catch {
    // Contexto é best-effort; nunca quebrar a operação principal.
  }
}
