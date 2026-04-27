/**
 * Rota “vazia” quando não há abas abertas — o layout do ERP renderiza o wallpaper em ErpTabs.
 * O conteúdo desta página não é exibido (children não usados no layout), mas a URL /inicio
 * evita coincidir com /materias-primas ou outro módulo e manter o menu lateral destacado.
 */
export const metadata = { title: 'Início — Alma Campeira' }

export default function InicioPage() {
  return null
}
