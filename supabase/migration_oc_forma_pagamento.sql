-- Adiciona forma_pagamento à OC e conecta boletos ↔ OCs, gastos ↔ parcelas

-- 1. Forma de pagamento na OC
ALTER TABLE public.ordens_compra
  ADD COLUMN IF NOT EXISTS forma_pagamento text;

-- 2. Vincular boletos a ordens de compra
ALTER TABLE public.boletos
  ADD COLUMN IF NOT EXISTS ordem_compra_id uuid
  REFERENCES public.ordens_compra(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_boletos_oc
  ON public.boletos (ordem_compra_id);

-- 3. Vincular gastos a parcelas de boleto
ALTER TABLE public.gastos
  ADD COLUMN IF NOT EXISTS boleto_parcela_id uuid
  REFERENCES public.boleto_parcelas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_gastos_boleto_parcela
  ON public.gastos (boleto_parcela_id);

-- 4. Forma de pagamento na venda (pedido)
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS forma_pagamento text;

-- 5. Vincular boletos a vendas (pedidos) — boleto de entrada / a receber
ALTER TABLE public.boletos
  ADD COLUMN IF NOT EXISTS pedido_id uuid
  REFERENCES public.pedidos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_boletos_pedido
  ON public.boletos (pedido_id);
