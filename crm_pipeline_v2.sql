-- crm_pipeline_v2.sql
-- Expande as fases do funil e adiciona controle manual de pagamento à tabela leads.
-- Idempotente: pode rodar quantas vezes precisar sem duplicar nada.

-- 1) Expande as fases do funil (mantém as antigas, adiciona negociando e aguardando_pagamento)
alter table public.leads drop constraint if exists leads_pipeline_stage_check;
alter table public.leads add constraint leads_pipeline_stage_check
  check (pipeline_stage in ('novo','contatado','negociando','aguardando_pagamento','matriculado','perdido'));

-- 2) Campos de controle manual de pagamento (PIX/transferência, conferido pelo usuário)
alter table public.leads add column if not exists valor_curso numeric(10,2);
alter table public.leads add column if not exists pago boolean not null default false;
alter table public.leads add column if not exists forma_pagamento text;
alter table public.leads add column if not exists data_pagamento timestamptz;

-- 3) Mantém stage_updated_at correto automaticamente, mesmo se a fase for editada
--    direto pelo Table Editor do Supabase (e não só pelo painel do CRM).
create or replace function public.set_leads_stage_updated_at()
returns trigger as $$
begin
  if new.pipeline_stage is distinct from old.pipeline_stage then
    new.stage_updated_at = now();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_leads_stage_updated_at on public.leads;
create trigger trg_leads_stage_updated_at
  before update on public.leads
  for each row
  execute function public.set_leads_stage_updated_at();

-- FIM: execute este arquivo no SQL Editor do Supabase. "Success. No rows returned" indica execução bem-sucedida.
