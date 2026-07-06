'use server'

import { Prisma } from '@prisma/client'
import { assertPermissao } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

type AuditLogRow = {
  id: string
  createdAt: Date | string
  userId: string | null
  userName: string | null
  userEmail: string | null
  action: string
  tableName: string
  recordId: string | null
  oldData: Prisma.JsonValue | null
  newData: Prisma.JsonValue | null
  changedFields: string[]
  ipAddress: string | null
  userAgent: string | null
}

function iso(value: Date | string | null | undefined): string {
  if (!value) return ''
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function jsonToRecord(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return null
  }
  return value as Record<string, unknown>
}

function buildAuditWhere(filters: AuditFilters): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {}

  if (filters.desde || filters.ate) {
    where.createdAt = {}
    if (filters.desde) {
      where.createdAt.gte = new Date(filters.desde)
    }
    if (filters.ate) {
      const ateEnd = new Date(filters.ate)
      ateEnd.setHours(23, 59, 59, 999)
      where.createdAt.lte = ateEnd
    }
  }

  if (filters.table_name) {
    where.tableName = filters.table_name
  }
  if (filters.action) {
    where.action = filters.action
  }
  if (filters.user_id) {
    where.userId = filters.user_id
  }
  if (filters.search && filters.search.trim()) {
    const term = filters.search.trim()
    where.OR = [
      { recordId: { contains: term, mode: 'insensitive' } },
      { userName: { contains: term, mode: 'insensitive' } },
      { userEmail: { contains: term, mode: 'insensitive' } },
    ]
  }

  return where
}

function mapAuditLog(row: AuditLogRow): AuditLog {
  return {
    id: row.id,
    created_at: iso(row.createdAt),
    user_id: row.userId,
    user_name: row.userName,
    user_email: row.userEmail,
    action: row.action as AuditAction,
    table_name: row.tableName,
    record_id: row.recordId,
    old_data: jsonToRecord(row.oldData),
    new_data: jsonToRecord(row.newData),
    changed_fields: row.changedFields,
    ip_address: row.ipAddress,
    user_agent: row.userAgent,
  }
}

export async function getAuditLogs(filters: AuditFilters = {}): Promise<{
  logs: AuditLog[]
  total: number
}> {
  await assertPermissao('metricas', 'ver')
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500)
  const offset = Math.max(filters.offset ?? 0, 0)
  const where = buildAuditWhere(filters)

  const [rows, countRows] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.auditLog.count({ where }),
  ])

  return {
    logs: rows.map(mapAuditLog),
    total: countRows,
  }
}

export async function getAuditLogDetalhe(id: string): Promise<AuditLog> {
  await assertPermissao('metricas', 'ver')
  const row = await prisma.auditLog.findUnique({
    where: { id },
  })
  if (!row) throw new Error('Log de auditoria não encontrado.')
  return mapAuditLog(row)
}

/** Lista de tabelas únicas presentes no log (para popular o filtro) */
export async function getAuditLogTabelas(): Promise<string[]> {
  await assertPermissao('metricas', 'ver')
  const rows = await prisma.auditLog.findMany({
    select: { tableName: true },
    distinct: ['tableName'],
    orderBy: { tableName: 'asc' },
    take: 1000,
  })
  return rows.map((row) => row.tableName)
}

/** Lista de usuários que aparecem no log (para popular o filtro) */
export async function getAuditLogUsuarios(): Promise<{ id: string; nome: string }[]> {
  await assertPermissao('metricas', 'ver')
  const data = await prisma.auditLog.findMany({
    where: { userId: { not: null } },
    select: { userId: true, userName: true },
    orderBy: { userName: 'asc' },
    take: 5000,
  })
  const map = new Map<string, string>()
  for (const row of data) {
    if (row.userId && !map.has(row.userId)) {
      map.set(row.userId, row.userName ?? '(sem nome)')
    }
  }
  return Array.from(map.entries())
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome))
}
