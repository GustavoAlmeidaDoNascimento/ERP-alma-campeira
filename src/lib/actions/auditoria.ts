'use server'

import { createClient } from '@/lib/supabase/server'
import { assertPermissao } from '@/lib/auth'

export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE'

export type AuditLog = {
  id: string
  created_at: string
  user_id: string | null
  user_name: string | null
  user_email: string | null
  action: AuditAction
  table_name: string
  record_id: string | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  changed_fields: string[] | null
  ip_address: string | null
  user_agent: string | null
}

export type AuditFilters = {
  desde?: string           // ISO date
  ate?: string             // ISO date
  table_name?: string      // filtra por tabela
  action?: AuditAction     // filtra por operação
  user_id?: string         // filtra por usuário
  search?: string          // busca textual (record_id / nome usuário)
  limit?: number           // default 100
  offset?: number          // default 0
}

export async function getAuditLogs(filters: AuditFilters = {}): Promise<{
  logs: AuditLog[]
  total: number
}> {
  await assertPermissao('metricas', 'ver')
  const supabase = await createClient()

  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500)
  const offset = Math.max(filters.offset ?? 0, 0)

  let query = supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (filters.desde) query = query.gte('created_at', filters.desde)
  if (filters.ate) {
    const ateEnd = new Date(filters.ate)
    ateEnd.setHours(23, 59, 59, 999)
    query = query.lte('created_at', ateEnd.toISOString())
  }
  if (filters.table_name) query = query.eq('table_name', filters.table_name)
  if (filters.action) query = query.eq('action', filters.action)
  if (filters.user_id) query = query.eq('user_id', filters.user_id)
  if (filters.search && filters.search.trim()) {
    const s = filters.search.trim().replace(/[%_]/g, '\\$&')
    query = query.or(`record_id.ilike.%${s}%,user_name.ilike.%${s}%,user_email.ilike.%${s}%`)
  }

  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query
  if (error) throw new Error(error.message)

  return {
    logs: (data ?? []) as AuditLog[],
    total: count ?? 0,
  }
}

export async function getAuditLogDetalhe(id: string): Promise<AuditLog> {
  await assertPermissao('metricas', 'ver')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw new Error(error.message)
  return data as AuditLog
}

/** Lista de tabelas únicas presentes no log (para popular o filtro) */
export async function getAuditLogTabelas(): Promise<string[]> {
  await assertPermissao('metricas', 'ver')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('audit_logs')
    .select('table_name')
    .order('table_name')
    .limit(1000)
  if (error) throw new Error(error.message)
  const set = new Set<string>()
  for (const row of data ?? []) set.add((row as { table_name: string }).table_name)
  return Array.from(set).sort()
}

/** Lista de usuários que aparecem no log (para popular o filtro) */
export async function getAuditLogUsuarios(): Promise<{ id: string; nome: string }[]> {
  await assertPermissao('metricas', 'ver')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('audit_logs')
    .select('user_id, user_name')
    .not('user_id', 'is', null)
    .limit(5000)
  if (error) throw new Error(error.message)
  const map = new Map<string, string>()
  for (const row of (data ?? []) as { user_id: string | null; user_name: string | null }[]) {
    if (row.user_id && !map.has(row.user_id)) {
      map.set(row.user_id, row.user_name ?? '(sem nome)')
    }
  }
  return Array.from(map.entries())
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome))
}
