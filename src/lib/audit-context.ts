import 'server-only'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

/**
 * Enriquece o próximo audit log com IP e User-Agent do request.
 * Chame no início de uma Server Action (antes da mutação) quando quiser
 * registrar esses dados. O `user_id` já é capturado automaticamente pelo
 * trigger via `auth.uid()`, então não é necessário para identidade.
 *
 * Os GUCs são transacionais (`set_config(..., true)`), mas como PostgREST
 * abre uma nova transação por request HTTP, eles vivem apenas durante
 * a chamada RPC — o que é aceitável: chame-os imediatamente antes da
 * mutação na mesma request (Supabase REST reaproveita a conexão no pool
 * mas não o estado transacional). Para garantir persistência dentro do
 * request, esta função faz a própria chamada `set_audit_context` RPC
 * logo antes do trecho de mutação do server action.
 */
export async function setAuditRequestContext(): Promise<void> {
  try {
    const h = await headers()
    const ip =
      h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      h.get('x-real-ip') ||
      null
    const ua = h.get('user-agent') || null

    const supabase = await createClient()
    await supabase.rpc('set_audit_context', {
      p_ip: ip,
      p_user_agent: ua,
    })
  } catch {
    // Contexto é best-effort; nunca quebrar a operação principal.
  }
}
