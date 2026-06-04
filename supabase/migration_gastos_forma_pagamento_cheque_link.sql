-- Estende formas de pagamento em gastos: cheque e link (idempotente)

ALTER TABLE public.gastos DROP CONSTRAINT IF EXISTS gastos_forma_pagamento_check;

ALTER TABLE public.gastos
  ADD CONSTRAINT gastos_forma_pagamento_check CHECK (
    forma_pagamento IN (
      'pix',
      'dinheiro',
      'cartao_credito',
      'cartao_debito',
      'boleto',
      'cheque',
      'link',
      'transferencia',
      'outro'
    )
  );
