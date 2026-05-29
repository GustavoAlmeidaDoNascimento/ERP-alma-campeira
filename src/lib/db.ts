import postgres from 'postgres'

let _sql: ReturnType<typeof postgres> | null = null

/**
 * Conexão direta ao Postgres via postgres.js.
 * Usada para operações de auth (login, criar/deletar usuários)
 * e permissões dentro de unstable_cache (onde cookies() não funciona).
 */
export function db() {
  if (!_sql) {
    _sql = postgres(process.env.DATABASE_URL!, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
    })
  }
  return _sql
}
