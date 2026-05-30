-- ============================================================
-- Auditoria: nas tabelas-filhas, logar SÓ UPDATE
-- ------------------------------------------------------------
-- O log de atividades estava ruidoso porque, ao criar um boleto
-- com 3 parcelas, gerava 1 INSERT no `boletos` + 3 INSERTs em
-- `boleto_parcelas` = 4 entradas pra uma única ação do usuário.
-- O mesmo acontecia em pedidos/orçamentos com seus itens.
--
-- Solução: nas tabelas-filhas (parcelas / itens), o audit trigger
-- passa a rodar APENAS para UPDATE. Assim:
--   - Cadastro inicial das parcelas / itens: não gera log (o pai
--     já cobre o evento "boleto/pedido/orçamento criado").
--   - Remoção de parcela / item ao editar: não gera log.
--   - Alteração de uma parcela (ex: marcar como paga, mudar valor):
--     gera 1 UPDATE — que é exatamente o que importa.
--
-- Idempotente: pode ser re-executado com segurança.
-- ============================================================

do $do_only_update_audit$
declare
  t text;
  tabelas_filhas text[] := array[
    'boleto_parcelas',
    'orcamento_itens',
    'pedido_itens',
    'ordem_compra_itens',
    'fila_reposicao_itens',
    'faca_materias_primas',
    'usuario_permissoes',
    'cargo_permissoes'
  ];
begin
  foreach t in array tabelas_filhas loop
    begin
      execute format('drop trigger if exists audit_%1$s on public.%1$s', t);
      execute format(
        'create trigger audit_%1$s after update on public.%1$s for each row execute function public.log_audit_event()',
        t
      );
    exception when undefined_table then
      raise notice 'Tabela % nao existe - pulando', t;
    end;
  end loop;
end;
$do_only_update_audit$;
