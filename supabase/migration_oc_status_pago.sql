-- ============================================================
-- Legado: adicionar status "pago" no fluxo de Ordens de Compra
-- ------------------------------------------------------------
-- Supersedido pelo modelo com coluna booleana `pago`
-- (ver migration_oc_pago_boolean.sql). Se a coluna `pago` já existir,
-- este script não altera nada.
--
-- Fluxo antigo: pendente → enviada → pago → recebida.
--
-- Idempotente: detecta e troca a CHECK constraint atual de status.
--
-- Se public.ordens_compra ainda não existir, o script não faz nada e emite
-- um NOTICE — rode antes migration_ordens_compra_baseline.sql (ou equivalente).
-- Bases criadas já com status incluindo "pago" no baseline podem rodar este
-- arquivo à mesma; só recria a constraint de forma equivalente.
-- ============================================================

do $do_oc_status_pago$
declare
  cons record;
begin
  if to_regclass('public.ordens_compra') is null then
    raise notice 'migration_oc_status_pago: omitido — public.ordens_compra não existe. Rode migration_ordens_compra_baseline.sql antes.';
    return;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ordens_compra'
      and column_name = 'pago'
  ) then
    raise notice 'migration_oc_status_pago: omitido — coluna public.ordens_compra.pago existe (pagamento é flag, não status).';
    return;
  end if;

  -- Procura qualquer CHECK constraint em ordens_compra cuja definição
  -- mencione 'pendente' (assumimos que é a constraint do status).
  for cons in
    select conname
    from pg_constraint
    where conrelid = 'public.ordens_compra'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%pendente%'
  loop
    execute format('alter table public.ordens_compra drop constraint %I', cons.conname);
  end loop;

  -- Recria a CHECK incluindo 'pago'.
  alter table public.ordens_compra
    add constraint ordens_compra_status_check
    check (status in ('pendente','enviada','pago','recebida'));
end;
$do_oc_status_pago$;
