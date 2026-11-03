-- gastos_midia.sql
-- Registro manual de gasto com mídia paga, por dia/canal/campanha — usado
-- pelo painel semanal do CRM pra calcular custo por lead e por aluno.
create table if not exists public.gastos_midia (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  canal text not null,
  campanha text,
  valor_centavos int not null check (valor_centavos >= 0),
  created_at timestamptz not null default now()
);

alter table public.gastos_midia enable row level security;
drop policy if exists allow_all_gastos_midia_authenticated on public.gastos_midia;
create policy allow_all_gastos_midia_authenticated
  on public.gastos_midia for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.gastos_midia to authenticated;
