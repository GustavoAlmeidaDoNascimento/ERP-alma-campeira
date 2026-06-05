import { redirect } from 'next/navigation'

// A antiga página de Gastos foi substituída pela página unificada de
// Movimentação (entradas + saídas). Mantemos a rota só como redirecionamento
// para não quebrar links/abas antigos.
export default function GastosPage() {
  redirect('/movimentacao')
}
