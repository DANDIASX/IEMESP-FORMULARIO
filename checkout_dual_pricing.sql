-- checkout_dual_pricing.sql
-- Permite preço diferente para Pix e para cartão no mesmo curso, e adiciona
-- um tipo de cupom "preco_fixo" (preço final fixo, independente da base).
-- Idempotente.

alter table public.cursos add column if not exists preco_pix_centavos int check (preco_pix_centavos > 0);

alter table public.cupons drop constraint if exists cupons_tipo_check;
alter table public.cupons add constraint cupons_tipo_check
  check (tipo in ('percentual', 'valor_fixo', 'preco_fixo'));

alter table public.pedidos add column if not exists metodo_pagamento text;
alter table public.pedidos drop constraint if exists pedidos_metodo_pagamento_check;
alter table public.pedidos add constraint pedidos_metodo_pagamento_check
  check (metodo_pagamento is null or metodo_pagamento in ('cartao', 'pix'));

-- FIM: execute este arquivo no SQL Editor do Supabase.
