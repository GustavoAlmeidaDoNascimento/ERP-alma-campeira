'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { Modal } from '@/components/ui/modal'
import {
  getAuditLogs,
  type AuditLog,
  type AuditAction,
  type AuditFilters,
} from '@/lib/actions/auditoria'

// ------------------------------------------------------------
// Labels amigáveis
// ------------------------------------------------------------
const TABELAS_LABEL: Record<string, string> = {
  usuarios_perfis: 'Usuário (perfil)',
  usuario_permissoes: 'Permissão do usuário',
  cargos: 'Cargo',
  cargo_permissoes: 'Permissão de cargo',
  fornecedores: 'Fornecedor',
  clientes: 'Cliente',
  materias_primas: 'Matéria-prima',
  categorias_materia_prima: 'Categoria de MP',
  facas: 'Faca',
  categorias_faca: 'Categoria de faca',
  faca_materias_primas: 'BOM (faca ↔ MP)',
  consumiveis: 'Consumível',
  categorias_consumivel: 'Categoria de consumível',
  movimentacoes_estoque: 'Movimentação de estoque',
  fila_reposicao: 'Fila de reposição',
  fila_reposicao_itens: 'Item da fila de reposição',
  pedidos: 'Venda / Pedido',
  pedido_itens: 'Item de pedido',
  ordens_compra: 'Ordem de compra',
  ordem_compra_itens: 'Item de ordem de compra',
  gastos: 'Gasto',
  boletos: 'Boleto',
  boleto_parcelas: 'Parcela de boleto',
  app_config: 'Configuração global',
  audit_logs: 'Auditoria',
}

const ACTION_LABEL: Record<AuditAction, string> = {
  INSERT: 'Criação',
  UPDATE: 'Edição',
  DELETE: 'Deleção',
}

const ACTION_COLORS: Record<AuditAction, { text: string; bg: string; border: string }> = {
  INSERT: { text: '#15803d', bg: '#dcfce7', border: '#bbf7d0' },
  UPDATE: { text: '#1d4ed8', bg: '#dbeafe', border: '#bfdbfe' },
  DELETE: { text: '#b91c1c', bg: '#fee2e2', border: '#fecaca' },
}

function tabelaLabel(t: string): string {
  return TABELAS_LABEL[t] ?? t
}

function fmtDateTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return iso
  }
}

// ------------------------------------------------------------
// Labels e formatação de campos (visão amigável)
// ------------------------------------------------------------
const FIELD_LABEL: Record<string, string> = {
  id: 'ID',
  codigo: 'Código',
  nome: 'Nome',
  descricao: 'Descrição',
  categoria: 'Categoria',
  tipo: 'Tipo',
  tipo_documento: 'Tipo de documento',
  documento: 'Documento',
  status: 'Status',
  observacao: 'Observação',
  ativo: 'Ativo',
  pago: 'Pago',
  ultima_alteracao_em: 'Última alteração em',
  ultima_alteracao_usuario_id: 'Quem registrou (perfil)',
  perfil: 'Perfil',
  ordem: 'Ordem',
  cor: 'Cor',
  cor_texto: 'Cor do texto',
  cor_fundo: 'Cor de fundo',
  cor_borda: 'Cor da borda',

  // preços / valores
  preco_custo: 'Preço de custo',
  preco_venda: 'Preço de venda',
  preco_unitario: 'Preço unitário',
  valor_total: 'Valor total',
  subtotal: 'Subtotal',
  frete: 'Frete',
  desconto_total: 'Desconto',
  margem_lucro: 'Margem de lucro (%)',
  taxa_producao: 'Taxa de produção',
  taxa_venda: 'Taxa de venda',
  taxa_comissao: 'Comissão (%)',

  // quantidades
  quantidade: 'Quantidade',
  quantidade_vendida: 'Quantidade vendida',
  quantidade_adicional: 'Quantidade adicional',
  quantidade_sugerida: 'Qtd. sugerida',
  selecionado: 'Incluir na OC',
  estoque_atual: 'Estoque atual',
  estoque_minimo: 'Estoque mínimo',

  // fotos / arquivos
  foto_url: 'Foto',

  // contato
  telefone: 'Telefone',
  email: 'E-mail',

  // endereço
  cep: 'CEP',
  logradouro: 'Logradouro',
  numero: 'Número',
  complemento: 'Complemento',
  bairro: 'Bairro',
  cidade: 'Cidade',
  estado: 'Estado',
  uf: 'UF',

  // IDs relacionais
  faca_id: 'Faca',
  pedido_id: 'Pedido',
  fornecedor_id: 'Fornecedor',
  cliente_id: 'Cliente',
  vendedor_id: 'Vendedor',
  usuario_id: 'Usuário',
  materia_prima_id: 'Matéria-prima',
  consumivel_id: 'Consumível',
  cargo_id: 'Cargo',
  ordem_compra_id: 'Ordem de compra',
  fila_id: 'Fila de reposição',
  fila_reposicao_id: 'Fila de reposição (origem)',

  // datas
  created_at: 'Criado em',
  updated_at: 'Atualizado em',
  data_pedido: 'Data do pedido',
  data_geracao: 'Data de geração',
  entregue_at: 'Entregue em',
  criado_em: 'Criado em',

  // permissões
  modulo: 'Módulo',
  ver: 'Pode ver',
  criar: 'Pode criar',
  editar: 'Pode editar',
  deletar: 'Pode deletar',

  // boletos / parcelas
  contraparte_nome: 'Cliente / Fornecedor',
  cnpj_cpf: 'CNPJ / CPF',
  numero_documento: 'Número(s) NF / pedido',
  unidades: 'Unidades',
  emitido_em: 'Emitido em',
  vencimento: 'Vencimento',
  valor: 'Valor',
  pago_em: 'Pago em',
  valor_pago: 'Valor pago',
  boleto_id: 'Boleto',
  criado_por: 'Criado por',

  // gastos
  data_gasto: 'Data do gasto',
  forma_pagamento: 'Forma de pagamento',
}

/** Campos "técnicos" que escondemos da visão normal (aparecem só no modo técnico). */
const CAMPOS_TECNICOS = new Set(['id', 'created_at', 'updated_at', 'criado_em'])

/** Ordem de prioridade: campos importantes aparecem primeiro. */
const CAMPOS_PRIORITARIOS = [
  'codigo', 'nome', 'descricao', 'tipo', 'categoria', 'status', 'perfil',
  'quantidade', 'preco_custo', 'preco_venda', 'preco_unitario', 'subtotal',
  'valor_total', 'frete', 'desconto_total',
  'estoque_atual', 'estoque_minimo',
  'margem_lucro', 'taxa_producao', 'taxa_venda', 'taxa_comissao',
  'cliente_id', 'fornecedor_id', 'faca_id', 'materia_prima_id', 'consumivel_id',
  'fila_id', 'fila_reposicao_id', 'ordem_compra_id',
  'pedido_id', 'vendedor_id', 'usuario_id', 'cargo_id',
  'data_pedido', 'data_geracao', 'entregue_at',
  'telefone', 'email', 'tipo_documento', 'documento',
  'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'estado', 'uf',
  'foto_url', 'observacao',
  'modulo', 'ver', 'criar', 'editar', 'deletar',
  'cor', 'cor_texto', 'cor_fundo', 'cor_borda', 'ordem', 'ativo',
  // boletos / parcelas
  'contraparte_nome', 'cnpj_cpf', 'numero_documento', 'emitido_em',
  'vencimento', 'valor', 'pago_em', 'valor_pago', 'boleto_id', 'unidades',
  // gastos
  'data_gasto', 'forma_pagamento',
]

function fieldLabel(f: string): string {
  return FIELD_LABEL[f] ?? f.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
}

function isCampoPreco(field: string): boolean {
  return /^(preco_|valor_|subtotal$|frete$|desconto_)/.test(field)
}

function isCampoData(field: string): boolean {
  return /(_at|_em|data_)/.test(field)
}

function isCampoPorcentagem(field: string): boolean {
  return field === 'margem_lucro' || field === 'taxa_comissao'
}

function isCampoUuid(field: string): boolean {
  return field === 'id' || /_id$/.test(field)
}

function isUuidLike(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

function fmtMoney(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Formata um valor considerando o nome do campo (moeda, data, %, etc.). */
function fmtFieldValue(field: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não'

  if (typeof v === 'number') {
    if (isCampoPreco(field)) return fmtMoney(v)
    if (isCampoPorcentagem(field)) return `${v}%`
    return v.toLocaleString('pt-BR')
  }

  if (typeof v === 'string') {
    if (isCampoData(field)) {
      const d = new Date(v)
      if (!isNaN(d.getTime())) return fmtDateTime(v)
    }
    if (isCampoUuid(field) && isUuidLike(v)) return `#${v.slice(0, 8)}`
    if (field === 'foto_url') return v ? 'arquivo anexado' : '—'
    if (v.length > 120) return v.slice(0, 120) + '…'
    return v
  }

  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

/** Ordena os campos: prioritários primeiro, depois alfabético; esconde técnicos. */
function ordenarCampos(data: Record<string, unknown>, incluirTecnicos = false): string[] {
  const keys = Object.keys(data).filter((k) => incluirTecnicos || !CAMPOS_TECNICOS.has(k))
  const prio = CAMPOS_PRIORITARIOS.filter((k) => keys.includes(k))
  const resto = keys.filter((k) => !CAMPOS_PRIORITARIOS.includes(k)).sort()
  return [...prio, ...resto]
}

// ------------------------------------------------------------
// Tipos / props
// ------------------------------------------------------------
export type AtividadeViewProps = {
  logsIniciais: AuditLog[]
  totalInicial: number
  tabelasDisponiveis: string[]
  usuariosDisponiveis: { id: string; nome: string }[]
}

// ------------------------------------------------------------
// Componente principal
// ------------------------------------------------------------
export function AtividadeView({
  logsIniciais,
  totalInicial,
  tabelasDisponiveis,
  usuariosDisponiveis,
}: AtividadeViewProps) {
  const [logs, setLogs] = useState<AuditLog[]>(logsIniciais)
  const [total, setTotal] = useState(totalInicial)
  const [offset, setOffset] = useState(0)
  const [isPending, startTransition] = useTransition()
  const [selecionado, setSelecionado] = useState<AuditLog | null>(null)

  // filtros
  const [desde, setDesde] = useState<string>('')
  const [ate, setAte] = useState<string>('')
  const [tabela, setTabela] = useState<string>('')
  const [acao, setAcao] = useState<AuditAction | ''>('')
  const [userId, setUserId] = useState<string>('')
  const [search, setSearch] = useState<string>('')
  const [searchDebounce, setSearchDebounce] = useState<string>('')

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const LIMIT = 100

  const filtrosAtuais: AuditFilters = useMemo(
    () => ({
      desde: desde || undefined,
      ate: ate || undefined,
      table_name: tabela || undefined,
      action: (acao || undefined) as AuditAction | undefined,
      user_id: userId || undefined,
      search: searchDebounce || undefined,
      limit: LIMIT,
      offset: 0,
    }),
    [desde, ate, tabela, acao, userId, searchDebounce],
  )

  const aplicarFiltros = useCallback(() => {
    startTransition(async () => {
      const { logs: novos, total: novoTotal } = await getAuditLogs(filtrosAtuais)
      setLogs(novos)
      setTotal(novoTotal)
      setOffset(0)
    })
  }, [filtrosAtuais])

  useEffect(() => {
    aplicarFiltros()
  }, [aplicarFiltros])

  const carregarMais = useCallback(() => {
    const novoOffset = offset + LIMIT
    startTransition(async () => {
      const { logs: novos } = await getAuditLogs({ ...filtrosAtuais, offset: novoOffset })
      setLogs((prev) => [...prev, ...novos])
      setOffset(novoOffset)
    })
  }, [filtrosAtuais, offset])

  const limparFiltros = () => {
    setDesde('')
    setAte('')
    setTabela('')
    setAcao('')
    setUserId('')
    setSearch('')
  }

  const temFiltros = !!(desde || ate || tabela || acao || userId || search)

  return (
    <div className="space-y-4 min-w-0">
      {/* Barra de filtros */}
      <div
        className="rounded-xl border p-3 sm:p-4"
        style={{ borderColor: 'var(--ac-border)', background: 'var(--ac-card)' }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <FiltroData label="De" value={desde} onChange={setDesde} max={ate || undefined} />
          <FiltroData label="Até" value={ate} onChange={setAte} min={desde || undefined} />

          <FiltroSelect
            label="Tabela"
            value={tabela}
            onChange={setTabela}
            options={[
              { value: '', label: 'Todas' },
              ...tabelasDisponiveis.map((t) => ({ value: t, label: tabelaLabel(t) })),
            ]}
          />
          <FiltroSelect
            label="Operação"
            value={acao}
            onChange={(v) => setAcao(v as AuditAction | '')}
            options={[
              { value: '', label: 'Todas' },
              { value: 'INSERT', label: 'Criação' },
              { value: 'UPDATE', label: 'Edição' },
              { value: 'DELETE', label: 'Deleção' },
            ]}
          />
          <FiltroSelect
            label="Usuário"
            value={userId}
            onChange={setUserId}
            options={[
              { value: '', label: 'Todos' },
              ...usuariosDisponiveis.map((u) => ({ value: u.id, label: u.nome })),
            ]}
          />
          <FiltroTexto label="Buscar (ID / nome)" value={search} onChange={setSearch} />
        </div>

        <div className="flex items-center justify-between gap-2 mt-3 flex-wrap">
          <span className="text-xs" style={{ color: 'var(--ac-muted)' }}>
            {isPending ? 'Carregando…' : `${total.toLocaleString('pt-BR')} registro${total === 1 ? '' : 's'}`}
          </span>
          {temFiltros ? (
            <button
              type="button"
              onClick={limparFiltros}
              className="text-xs px-2.5 py-1.5 rounded-md transition-colors"
              style={{
                color: 'var(--ac-muted)',
                background: 'var(--ac-bg)',
                border: '1px solid var(--ac-border)',
              }}
            >
              Limpar filtros
            </button>
          ) : null}
        </div>
      </div>

      {/* Lista */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ borderColor: 'var(--ac-border)', background: 'var(--ac-card)' }}
      >
        {logs.length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: 'var(--ac-muted)' }}>
            {isPending ? 'Carregando registros…' : 'Nenhum registro encontrado.'}
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--ac-border)' }}>
            {logs.map((log) => (
              <LogRow key={log.id} log={log} onClick={() => setSelecionado(log)} />
            ))}
          </ul>
        )}

        {logs.length < total ? (
          <div
            className="p-3 border-t flex justify-center"
            style={{ borderColor: 'var(--ac-border)', background: 'var(--ac-bg)' }}
          >
            <button
              type="button"
              onClick={carregarMais}
              disabled={isPending}
              className="text-sm px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              style={{
                color: 'var(--ac-accent)',
                background: 'var(--ac-card)',
                border: '1px solid var(--ac-border)',
              }}
            >
              {isPending ? 'Carregando…' : `Carregar mais (${total - logs.length} restantes)`}
            </button>
          </div>
        ) : null}
      </div>

      {/* Modal de detalhes */}
      <Modal
        open={!!selecionado}
        onClose={() => setSelecionado(null)}
        title="Detalhe da atividade"
        width="720px"
      >
        {selecionado ? <LogDetalhe log={selecionado} /> : null}
      </Modal>
    </div>
  )
}

// ------------------------------------------------------------
// Subcomponentes
// ------------------------------------------------------------
function LogRow({ log, onClick }: { log: AuditLog; onClick: () => void }) {
  const cores = ACTION_COLORS[log.action]
  const usuario = log.user_name || log.user_email || (log.user_id ? log.user_id.slice(0, 8) : 'Sistema')

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left px-4 py-3 transition-colors flex items-start gap-3 hover:brightness-105"
        style={{ background: 'var(--ac-card)' }}
      >
        <span
          className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wide mt-0.5"
          style={{
            color: cores.text,
            background: cores.bg,
            border: `1px solid ${cores.border}`,
          }}
        >
          {ACTION_LABEL[log.action]}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-sm font-medium truncate" style={{ color: 'var(--ac-text)' }}>
              {tabelaLabel(log.table_name)}
            </span>
            {log.record_id ? (
              <span className="text-[11px] font-mono" style={{ color: 'var(--ac-muted)' }}>
                #{log.record_id.slice(0, 8)}
              </span>
            ) : null}
          </div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--ac-muted)' }}>
            <span>{usuario}</span>
            {log.changed_fields && log.changed_fields.length > 0 ? (
              <>
                <span className="mx-1.5">·</span>
                <span>
                  {log.changed_fields.length} campo{log.changed_fields.length === 1 ? '' : 's'} alterado
                  {log.changed_fields.length === 1 ? '' : 's'}
                </span>
              </>
            ) : null}
          </div>
        </div>
        <span className="shrink-0 text-[11px] tabular-nums" style={{ color: 'var(--ac-muted)' }}>
          {fmtDateTime(log.created_at)}
        </span>
      </button>
    </li>
  )
}

function LogDetalhe({ log }: { log: AuditLog }) {
  const cores = ACTION_COLORS[log.action]
  const usuario = log.user_name || '(sem nome)'

  return (
    <div className="space-y-4 text-sm" style={{ color: 'var(--ac-text)' }}>
      {/* Cabeçalho */}
      <div
        className="flex flex-wrap items-center gap-2 pb-3 border-b"
        style={{ borderColor: 'var(--ac-border)' }}
      >
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-md uppercase tracking-wide"
          style={{ color: cores.text, background: cores.bg, border: `1px solid ${cores.border}` }}
        >
          {ACTION_LABEL[log.action]}
        </span>
        <span className="font-medium">{tabelaLabel(log.table_name)}</span>
        {log.record_id ? (
          <span className="text-xs font-mono" style={{ color: 'var(--ac-muted)' }}>
            #{log.record_id}
          </span>
        ) : null}
      </div>

      {/* Metadados */}
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
        <MetaLinha label="Quando" value={fmtDateTime(log.created_at)} />
        <MetaLinha
          label="Usuário"
          value={
            log.user_id
              ? `${usuario}${log.user_email ? ` · ${log.user_email}` : ''}`
              : 'Sistema / anônimo'
          }
        />
        {log.ip_address ? <MetaLinha label="IP" value={log.ip_address} /> : null}
        {log.user_agent ? <MetaLinha label="User-Agent" value={log.user_agent} /> : null}
      </dl>

      {/* Detalhes */}
      {log.action === 'UPDATE' ? (
        <Diff log={log} />
      ) : log.action === 'INSERT' ? (
        <RegistroCampos
          titulo="O que foi criado"
          data={log.new_data}
          destaque="positivo"
        />
      ) : (
        <RegistroCampos
          titulo="O que foi deletado"
          data={log.old_data}
          destaque="negativo"
        />
      )}
    </div>
  )
}

function MetaLinha({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col min-w-0">
      <dt className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
        {label}
      </dt>
      <dd className="text-xs break-all" style={{ color: 'var(--ac-text)' }}>
        {value}
      </dd>
    </div>
  )
}

function Diff({ log }: { log: AuditLog }) {
  const campos = (log.changed_fields ?? []).filter((c) => !CAMPOS_TECNICOS.has(c))
  if (campos.length === 0 || !log.old_data || !log.new_data) {
    return (
      <p className="text-xs" style={{ color: 'var(--ac-muted)' }}>
        Nenhuma alteração relevante.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
        O que foi alterado ({campos.length})
      </h4>
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--ac-border)' }}>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: 'var(--ac-bg)', color: 'var(--ac-muted)' }}>
              <th className="text-left px-3 py-2 font-medium">Campo</th>
              <th className="text-left px-3 py-2 font-medium">Antes</th>
              <th className="text-left px-3 py-2 font-medium">Depois</th>
            </tr>
          </thead>
          <tbody>
            {campos.map((campo) => {
              const antes = log.old_data?.[campo]
              const depois = log.new_data?.[campo]
              return (
                <tr key={campo} style={{ borderTop: '1px solid var(--ac-border)' }}>
                  <td className="px-3 py-2 whitespace-nowrap font-medium" style={{ color: 'var(--ac-text)' }}>
                    {fieldLabel(campo)}
                  </td>
                  <td
                    className="px-3 py-2 align-top"
                    style={{
                      background: 'var(--ac-diff-neg-bg)',
                      color: 'var(--ac-diff-neg-text)',
                      textDecoration: 'line-through',
                      textDecorationColor: 'color-mix(in srgb, var(--ac-diff-neg-text) 50%, transparent)',
                    }}
                  >
                    {fmtFieldValue(campo, antes)}
                  </td>
                  <td
                    className="px-3 py-2 align-top"
                    style={{
                      background: 'var(--ac-diff-pos-bg)',
                      color: 'var(--ac-diff-pos-text)',
                      fontWeight: 500,
                    }}
                  >
                    {fmtFieldValue(campo, depois)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RegistroCampos({
  titulo,
  data,
  destaque,
}: {
  titulo: string
  data: Record<string, unknown> | null
  destaque: 'positivo' | 'negativo'
}) {
  if (!data) {
    return (
      <p className="text-xs" style={{ color: 'var(--ac-muted)' }}>
        Sem dados para exibir.
      </p>
    )
  }

  const campos = ordenarCampos(data)
  const cor = destaque === 'positivo' ? 'var(--ac-diff-pos-text)' : 'var(--ac-diff-neg-text)'
  const bg = destaque === 'positivo' ? 'var(--ac-diff-pos-bg)' : 'var(--ac-diff-neg-bg)'
  const borda = destaque === 'positivo' ? 'var(--ac-diff-pos-border)' : 'var(--ac-diff-neg-border)'

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
        {titulo}
      </h4>
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: borda }}>
        <table className="w-full text-xs">
          <tbody>
            {campos.map((campo, idx) => (
              <tr
                key={campo}
                style={{
                  borderTop: idx === 0 ? 'none' : '1px solid var(--ac-border)',
                  background: idx % 2 === 0 ? 'var(--ac-card)' : 'var(--ac-bg)',
                }}
              >
                <td
                  className="px-3 py-2 whitespace-nowrap font-medium align-top"
                  style={{ color: 'var(--ac-muted)', width: '40%' }}
                >
                  {fieldLabel(campo)}
                </td>
                <td
                  className="px-3 py-2 align-top break-all"
                  style={{ color: cor, background: bg, fontWeight: 500 }}
                >
                  {fmtFieldValue(campo, data[campo])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Mantido apenas para o fallback interno, caso queiramos reativar o modo técnico.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function SnapshotJSON({
  title,
  data,
  destaque,
}: {
  title: string
  data: Record<string, unknown> | null
  destaque: 'positivo' | 'negativo'
}) {
  const borda =
    destaque === 'positivo'
      ? 'color-mix(in srgb, #bbf7d0 60%, var(--ac-border))'
      : 'color-mix(in srgb, #fecaca 60%, var(--ac-border))'
  const bg =
    destaque === 'positivo'
      ? 'color-mix(in srgb, #dcfce7 20%, var(--ac-bg))'
      : 'color-mix(in srgb, #fee2e2 20%, var(--ac-bg))'

  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: borda }}>
      <div
        className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide border-b"
        style={{ color: 'var(--ac-muted)', borderColor: borda, background: bg }}
      >
        {title}
      </div>
      <pre
        className="p-3 text-[11px] leading-relaxed overflow-auto font-mono max-h-96"
        style={{ background: 'var(--ac-bg)', color: 'var(--ac-text)' }}
      >
        {data ? JSON.stringify(data, null, 2) : '—'}
      </pre>
    </div>
  )
}

// ------------------------------------------------------------
// Filtros de formulário
// ------------------------------------------------------------
const inputBase =
  'rounded-lg px-2.5 py-2 text-sm outline-none transition-all disabled:opacity-60 w-full'
const inputStyle = {
  background: 'var(--ac-bg)',
  border: '1px solid var(--ac-border)',
  color: 'var(--ac-text)',
  colorScheme: 'light' as const,
}

function FiltroData({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  min?: string
  max?: string
}) {
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
        {label}
      </span>
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className={inputBase}
        style={inputStyle}
      />
    </label>
  )
}

function FiltroSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputBase}
        style={inputStyle}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function FiltroTexto({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="código, id, nome…"
        className={inputBase}
        style={inputStyle}
      />
    </label>
  )
}
