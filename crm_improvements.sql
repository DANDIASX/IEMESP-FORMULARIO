-- crm_improvements.sql
-- Suporte a: apagar lead pelo CRM, agrupar cursos por modalidade
-- (presencial/online), e manter pedidos mesmo se o lead for apagado.
-- Idempotente.

-- 1) Permite apagar lead pelo CRM (hoje só existia select/update pra authenticated).
drop policy if exists allow_delete_leads_authenticated on public.leads;
create policy allow_delete_leads_authenticated
  on public.leads for delete to authenticated using (true);
grant delete on public.leads to authenticated;

-- 2) Se um lead for apagado, o pedido continua existindo (histórico financeiro),
--    só perde o vínculo — hoje isso bloqueava a exclusão (FK sem "on delete").
alter table public.pedidos drop constraint if exists pedidos_lead_id_fkey;
alter table public.pedidos add constraint pedidos_lead_id_fkey
  foreign key (lead_id) references public.leads(id) on delete set null;

-- 3) Modalidade do curso (presencial/online), pra separar os grupos no CRM.
alter table public.cursos add column if not exists modalidade text not null default 'presencial'
  check (modalidade in ('presencial', 'online'));

-- FIM: execute este arquivo no SQL Editor do Supabase.
