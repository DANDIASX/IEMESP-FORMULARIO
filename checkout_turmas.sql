-- checkout_turmas.sql
-- Fase 1: turmas com vagas reais, campos de verificação (CRM/faculdade),
-- parceiros de cupom, e duas funções atômicas (reservar vaga / confirmar
-- pagamento) que travam a linha da turma com FOR UPDATE pra nunca deixar
-- vender mais vagas do que existem. Idempotente.

-- 1) Turmas (sessões do curso, com vagas limitadas)
create table if not exists public.turmas (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.cursos(id),
  slug text not null unique,
  nome text not null,
  data_turma date not null,
  horario text,
  local text,
  vagas_total int not null default 18 check (vagas_total > 0),
  status text not null default 'aberta' check (status in ('aberta', 'esgotada', 'encerrada')),
  created_at timestamptz not null default now()
);
alter table public.turmas enable row level security;
drop policy if exists allow_select_turmas_authenticated on public.turmas;
create policy allow_select_turmas_authenticated
  on public.turmas for select to authenticated using (true);
grant select on public.turmas to authenticated;
grant select, insert, update on public.turmas to service_role;

-- Checkout público (anônimo) precisa ler turma/vagas antes de pagar.
drop policy if exists allow_select_turmas_anon on public.turmas;
create policy allow_select_turmas_anon
  on public.turmas for select to anon using (status = 'aberta');
grant select on public.turmas to anon;

-- 2) Pedidos: turma, perfil e campos de verificação (médico vs. estudante)
alter table public.pedidos add column if not exists turma_id uuid references public.turmas(id);
alter table public.pedidos add column if not exists perfil text check (perfil is null or perfil in ('medico', 'interno', 'estudante'));
alter table public.pedidos add column if not exists crm_numero text;
alter table public.pedidos add column if not exists crm_uf text;
alter table public.pedidos add column if not exists crm_conferido boolean not null default false;
alter table public.pedidos add column if not exists faculdade text;
alter table public.pedidos add column if not exists ano_curso text;
alter table public.pedidos add column if not exists parcelas int;

alter table public.pedidos drop constraint if exists pedidos_status_check;
alter table public.pedidos add constraint pedidos_status_check
  check (status in ('pendente', 'aprovado', 'recusado', 'cancelado', 'reembolsado', 'excedente'));

-- 3) Cupons: vínculo opcional com turma e com o parceiro que originou o cupom
alter table public.cupons add column if not exists turma_id uuid references public.turmas(id);
alter table public.cupons add column if not exists parceiro text;

-- 4) Reserva de vaga atômica: trava a linha da turma, conta ocupadas
--    (aprovados + pendentes criados há menos de 30 min) e só cria o pedido
--    se ainda houver vaga — tudo na mesma transação, sem brecha de corrida.
create or replace function public.criar_pedido_com_vaga(
  p_turma_id uuid,
  p_curso_id uuid,
  p_cupom_id uuid,
  p_lead_id uuid,
  p_nome text,
  p_email text,
  p_telefone text,
  p_preco_original_centavos int,
  p_desconto_centavos int,
  p_valor_final_centavos int,
  p_utms jsonb,
  p_consentimento_lgpd boolean,
  p_metodo_pagamento text,
  p_perfil text,
  p_crm_numero text,
  p_crm_uf text,
  p_faculdade text,
  p_ano_curso text,
  p_parcelas int
)
returns public.pedidos as $$
declare
  v_vagas_total int;
  v_ocupadas int;
  v_pedido public.pedidos;
begin
  select vagas_total into v_vagas_total from public.turmas where id = p_turma_id for update;
  if v_vagas_total is null then
    raise exception 'turma_nao_encontrada';
  end if;

  select count(*) into v_ocupadas
  from public.pedidos
  where turma_id = p_turma_id
    and (status = 'aprovado' or (status = 'pendente' and created_at > now() - interval '30 minutes'));

  if v_ocupadas >= v_vagas_total then
    raise exception 'sem_vagas';
  end if;

  insert into public.pedidos (
    turma_id, curso_id, cupom_id, lead_id, nome, email, telefone,
    preco_original_centavos, desconto_centavos, valor_final_centavos,
    status, utms, consentimento_lgpd, metodo_pagamento,
    perfil, crm_numero, crm_uf, faculdade, ano_curso, parcelas
  ) values (
    p_turma_id, p_curso_id, p_cupom_id, p_lead_id, p_nome, p_email, p_telefone,
    p_preco_original_centavos, p_desconto_centavos, p_valor_final_centavos,
    'pendente', p_utms, p_consentimento_lgpd, p_metodo_pagamento,
    p_perfil, p_crm_numero, p_crm_uf, p_faculdade, p_ano_curso, p_parcelas
  ) returning * into v_pedido;

  return v_pedido;
end;
$$ language plpgsql security definer;

-- 5) Confirmação de pagamento atômica: idempotente (chamar de novo pra um
--    pedido já aprovado não faz nada) e, se o pedido tem turma, trava a
--    turma e só aprova se ainda houver vaga aprovada disponível — senão
--    marca 'excedente' (caso raríssimo de duas pessoas pagando a última
--    vaga quase ao mesmo tempo) pra conferência manual.
create or replace function public.confirmar_pagamento_pedido(
  p_pedido_id uuid,
  p_mp_payment_id text,
  p_pago_em timestamptz
)
returns table (
  id uuid,
  status text,
  turma_id uuid,
  cupom_id uuid,
  lead_id uuid,
  valor_final_centavos int,
  transicao_nova boolean
) as $$
declare
  v_status_atual text;
  v_turma_id uuid;
  v_vagas_total int;
  v_aprovados int;
begin
  select p.status, p.turma_id into v_status_atual, v_turma_id
  from public.pedidos p where p.id = p_pedido_id for update;

  if v_status_atual is null then
    raise exception 'pedido_nao_encontrado';
  end if;

  if v_status_atual = 'aprovado' then
    return query
      select p.id, p.status, p.turma_id, p.cupom_id, p.lead_id, p.valor_final_centavos, false
      from public.pedidos p where p.id = p_pedido_id;
    return;
  end if;

  if v_turma_id is not null then
    select t.vagas_total into v_vagas_total from public.turmas t where t.id = v_turma_id for update;
    select count(*) into v_aprovados from public.pedidos p where p.turma_id = v_turma_id and p.status = 'aprovado';

    if v_aprovados >= v_vagas_total then
      return query
        update public.pedidos p set status = 'excedente', mp_payment_id = p_mp_payment_id, pago_em = p_pago_em
        where p.id = p_pedido_id
        returning p.id, p.status, p.turma_id, p.cupom_id, p.lead_id, p.valor_final_centavos, false;
      return;
    end if;
  end if;

  return query
    update public.pedidos p set status = 'aprovado', mp_payment_id = p_mp_payment_id, pago_em = p_pago_em
    where p.id = p_pedido_id
    returning p.id, p.status, p.turma_id, p.cupom_id, p.lead_id, p.valor_final_centavos, true;
end;
$$ language plpgsql security definer;

-- 6) Dados reais: as duas turmas do curso presencial.
insert into public.turmas (curso_id, slug, nome, data_turma, horario, local, vagas_total, status)
select id, 'procedimentos-2027-01-23', 'Turma 23/01/2027', '2027-01-23', '8h às 18h', 'Rua Cardoso de Almeida, 634', 18, 'aberta'
from public.cursos where slug = 'procedimentos-emergencia'
on conflict (slug) do nothing;

insert into public.turmas (curso_id, slug, nome, data_turma, horario, local, vagas_total, status)
select id, 'procedimentos-2027-02-20', 'Turma 20/02/2027', '2027-02-20', '8h às 18h', 'Rua Cardoso de Almeida, 634', 18, 'aberta'
from public.cursos where slug = 'procedimentos-emergencia'
on conflict (slug) do nothing;

-- Cupons de parceiro — EXIMIO e HUMANITAR ficam inativos até você definir o valor.
insert into public.cupons (codigo, tipo, valor, curso_id, parceiro, ativo)
select 'EXIMIO', 'percentual', 1, id, 'eximio', false
from public.cursos where slug = 'procedimentos-emergencia'
on conflict (lower(codigo)) do nothing;

insert into public.cupons (codigo, tipo, valor, curso_id, parceiro, ativo)
select 'HUMANITAR', 'percentual', 1, id, 'humanitar', false
from public.cursos where slug = 'procedimentos-emergencia'
on conflict (lower(codigo)) do nothing;

update public.cupons set parceiro = 'liga-lahtc-limieu' where lower(codigo) = lower('UNICID200');

-- FIM: execute este arquivo no SQL Editor do Supabase.
