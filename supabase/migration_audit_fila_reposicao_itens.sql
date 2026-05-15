-- ============================================================
-- Auditoria: itens da fila de reposição (Ordens de compra)
-- ============================================================
-- Edições em fila_reposicao_itens (selecionar item, qty adicional)
-- não apareciam no relatório de atividades até este trigger.
-- Idempotente. Requer public._install_audit_trigger (audit_logs_system.sql).
--
-- Rode no SQL editor do Supabase se a base já existia antes de
-- atualizar audit_logs_system.sql com esta tabela.
-- ============================================================

do $do_install$
begin
  begin
    perform public._install_audit_trigger('fila_reposicao_itens');
  exception
    when undefined_function then
      raise notice 'migration_audit_fila_reposicao_itens: rode audit_logs_system.sql primeiro.';
    when undefined_table then
      raise notice 'migration_audit_fila_reposicao_itens: tabela fila_reposicao_itens não existe — ignorando.';
  end;
end;
$do_install$;
