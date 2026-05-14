-- ============================================================
-- OC: "Pago" como estado booleano, não como status sequencial
-- ------------------------------------------------------------
-- Status passa a ser apenas: pendente | enviada | recebida
-- Campo pago (boolean) indica se o pagamento foi registrado.
--
-- Idempotente o suficiente para reexecução segura em dev.
-- ============================================================

alter table public.ordens_compra add column if not exists pago boolean not null default false;

-- Registros que ainda estão no status legado "pago"
update public.ordens_compra
set status = 'enviada', pago = true
where status = 'pago';

-- No fluxo antigo só se confirmava recebimento após "pago"
update public.ordens_compra
set pago = true
where status = 'recebida' and coalesce(pago, false) = false;

alter table public.ordens_compra drop constraint if exists ordens_compra_status_check;

alter table public.ordens_compra add constraint ordens_compra_status_check
  check (status in ('pendente', 'enviada', 'recebida'));
