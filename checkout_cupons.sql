-- checkout_cupons.sql
-- Checkout de cursos com cupom de desconto (Mercado Pago Checkout Pro).
-- Idempotente: pode rodar quantas vezes precisar sem duplicar nada.
-- Sem acesso público direto a estas 3 tabelas: o formulário público nunca
-- fala com elas direto, só através das Supabase Edge Functions (service role).

create extension if not exists pgcrypto;

-- 0) As Edge Functions do checkout (role service_role) também leem/gravam nas
--    tabelas leads e students, que já existiam antes deste arquivo e não
--    tinham grant nenhum para service_role.
grant select, insert, update on public.leads to service_role;
grant select, insert, update on public.students to service_role;

-- 1) Cursos (catálogo do checkout — não confundir com produto_interesse do formulário)
create table if not exists public.cursos (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  titulo text not null,
  preco_centavos int not null check (preco_centavos > 0),
  max_parcelas int not null default 1 check (max_parcelas >= 1),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.cursos enable row level security;
drop policy if exists allow_select_cursos_authenticated on public.cursos;
create policy allow_select_cursos_authenticated
  on public.cursos for select to authenticated using (true);
grant select on public.cursos to authenticated;
-- service_role (usado pelas Supabase Edge Functions) ignora RLS, mas ainda
-- precisa do grant de SQL pra poder ler/gravar na tabela.
grant select, insert, update, delete on public.cursos to service_role;

-- 2) Cupons (código único, sem diferenciar maiúsculas/minúsculas)
create table if not exists public.cupons (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  tipo text not null check (tipo in ('percentual', 'valor_fixo')),
  valor numeric(10,2) not null check (valor > 0),
  curso_id uuid references public.cursos(id) on delete cascade,
  valido_de timestamptz,
  valido_ate timestamptz,
  limite_usos int check (limite_usos > 0),
  usos int not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
-- unique constraint normal seria case-sensitive; o código precisa ser único
-- ignorando maiúsculas/minúsculas, daí o índice sobre lower(codigo).
create unique index if not exists cupons_codigo_lower_idx on public.cupons (lower(codigo));

alter table public.cupons enable row level security;
drop policy if exists allow_all_cupons_authenticated on public.cupons;
create policy allow_all_cupons_authenticated
  on public.cupons for all to authenticated using (true) with check (true);
grant select, insert, update on public.cupons to authenticated;
grant select, insert, update, delete on public.cupons to service_role;

-- 3) Pedidos (um pedido por tentativa de checkout)
create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.cursos(id),
  cupom_id uuid references public.cupons(id),
  lead_id uuid references public.leads(id),
  nome text not null,
  email text not null,
  telefone text not null,
  preco_original_centavos int not null check (preco_original_centavos > 0),
  desconto_centavos int not null default 0 check (desconto_centavos >= 0),
  valor_final_centavos int not null check (valor_final_centavos >= 100), -- nunca abaixo de R$ 1,00
  status text not null default 'pendente'
    check (status in ('pendente', 'aprovado', 'recusado', 'cancelado', 'reembolsado')),
  mp_preference_id text,
  mp_payment_id text,
  utms jsonb,
  consentimento_lgpd boolean not null default false,
  created_at timestamptz not null default now(),
  pago_em timestamptz
);
alter table public.pedidos enable row level security;
drop policy if exists allow_select_pedidos_authenticated on public.pedidos;
create policy allow_select_pedidos_authenticated
  on public.pedidos for select to authenticated using (true);
grant select on public.pedidos to authenticated;
grant select, insert, update, delete on public.pedidos to service_role;

-- 4) Incremento atômico de uso do cupom — chamado só pela Edge Function
--    (service role) quando o pagamento é aprovado pela primeira vez.
create or replace function public.increment_cupom_usos(p_cupom_id uuid)
returns void as $$
begin
  update public.cupons set usos = usos + 1 where id = p_cupom_id;
end;
$$ language plpgsql security definer;
grant execute on function public.increment_cupom_usos(uuid) to service_role;

-- 5) Seed de teste: curso de R$ 1,00 e cupom de 50% off.
insert into public.cursos (slug, titulo, preco_centavos, max_parcelas, ativo)
values ('curso-teste', 'Curso de Teste', 100, 1, true)
on conflict (slug) do nothing;

insert into public.cupons (codigo, tipo, valor, curso_id, ativo)
select 'TESTE50', 'percentual', 50, c.id, true
from public.cursos c
where c.slug = 'curso-teste'
on conflict (lower(codigo)) do nothing;

-- Exemplo de como criar um cupom manualmente pelo SQL Editor do Supabase
-- (útil enquanto a tela de cupons do CRM ainda não estiver pronta):
--
-- insert into public.cupons (codigo, tipo, valor, curso_id, limite_usos, valido_ate, ativo)
-- values (
--   'PARCEIRO10',                                          -- código (não diferencia maiúsc./minúsc.)
--   'percentual',                                          -- ou 'valor_fixo'
--   10,                                                    -- 10% de desconto (ou valor em reais, se valor_fixo)
--   (select id from public.cursos where slug = 'curso-teste'), -- null = vale pra todos os cursos
--   100,                                                    -- limite de usos (opcional)
--   '2026-12-31T23:59:59-03:00',                            -- validade até (opcional)
--   true
-- );

-- FIM: execute este arquivo no SQL Editor do Supabase. "Success. No rows returned" indica execução bem-sucedida.
