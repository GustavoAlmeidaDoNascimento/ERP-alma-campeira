-- Remove o limite de 6 parcelas por boleto.
-- Mantém o check de numero >= 1.

alter table public.boleto_parcelas
  drop constraint if exists boleto_parcelas_numero_check;

alter table public.boleto_parcelas
  add constraint boleto_parcelas_numero_check check (numero >= 1);
