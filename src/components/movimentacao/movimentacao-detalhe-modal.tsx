'use client'

import Link from 'next/link'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { FORMAS_PAGAMENTO } from '@/types'
import type { Movimentacao } from '@/types'

const moedaBR = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const dataBR = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

function formatarData(s: string) {
  if (!s) return '—'
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return s
  return dataBR.format(new Date(y, m - 1, d))
}

const ORIGEM_LABEL: Record<Movimentacao['origem'], string> = {
  gasto: 'Saída (gasto)',
  entrada_manual: 'Entrada manual',
  venda: 'Entrada de venda',
  boleto_entrada: 'Recebimento de boleto',
}

type Props = {
  mov: Movimentacao | null
  onClose: () => void
}

function Linha({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2" style={{ borderTop: '1px solid var(--ac-border)' }}>
      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>{label}</span>
      <span className="text-sm text-right" style={{ color: 'var(--ac-text)' }}>{children}</span>
    </div>
  )
}

export function MovimentacaoDetalheModal({ mov, onClose }: Props) {
  if (!mov) return null

  const entrada = mov.direcao === 'entrada'
  const cor = entrada ? '#15803d' : '#b91c1c'

  return (
    <Modal open={!!mov} onClose={onClose} title="Detalhe da movimentação" width="520px">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between pb-3">
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{ color: cor, background: entrada ? '#dcfce7' : '#fee2e2' }}
          >
            {entrada ? 'Entrada' : 'Saída'}
          </span>
          <span className="text-2xl font-bold" style={{ color: cor }}>
            {entrada ? '+' : '−'} {moedaBR.format(mov.valor)}
          </span>
        </div>

        <Linha label="Origem">{ORIGEM_LABEL[mov.origem]}</Linha>
        <Linha label="Data">{formatarData(mov.data)}</Linha>
        <Linha label="Descrição">{mov.descricao}</Linha>
        {mov.categoria && <Linha label="Categoria">{mov.categoria}</Linha>}
        <Linha label="Forma">
          {mov.forma_pagamento ? (FORMAS_PAGAMENTO[mov.forma_pagamento]?.label ?? mov.forma_pagamento) : '—'}
        </Linha>
        {mov.codigo && <Linha label="Código">{mov.codigo}</Linha>}
        {mov.usuario_nome && <Linha label="Registrado por">{mov.usuario_nome}</Linha>}
        {mov.origem === 'gasto' && mov.gasto?.observacao && (
          <Linha label="Observação">{mov.gasto.observacao}</Linha>
        )}
        {mov.origem === 'entrada_manual' && mov.entrada?.observacao && (
          <Linha label="Observação">{mov.entrada.observacao}</Linha>
        )}
        {mov.origem === 'gasto' && mov.gasto?.ordem_compra?.codigo && (
          <Linha label="OC vinculada">
            <Link href="/ordens-compra" className="font-mono underline" style={{ color: 'var(--ac-accent)' }}>
              {mov.gasto.ordem_compra.codigo}
            </Link>
          </Linha>
        )}

        <div className="flex justify-end gap-2 pt-4" style={{ borderTop: '1px solid var(--ac-border)' }}>
          {mov.origem === 'venda' && (
            <Link href="/vendas">
              <Button variant="secondary">Abrir em Vendas</Button>
            </Link>
          )}
          {mov.origem === 'boleto_entrada' && (
            <Link href="/boletos">
              <Button variant="secondary">Abrir em Boletos</Button>
            </Link>
          )}
          <Button variant="secondary" onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </Modal>
  )
}
