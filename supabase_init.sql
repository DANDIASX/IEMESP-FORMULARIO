-- supabase_init.sql
-- supabase_init.sql
-- Arquivo único e idempotente para criar tabela `leads`, ativar RLS,
-- criar policy de INSERT e conceder privilégios necessários.

-- 1) extensão para gerar UUID
create extension if not exists pgcrypto;

-- 2) cria tabela (se não existir)
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  tipo text,
  nome text not null,
  email text,
  telefone text not null,
  crm text,
  formacao text,
  especializacao text,
  trabalho text,
  residencia text,
  curso_interesse text,
  instituicao text,
  cargo text,
  origem text,
  consentimento_lgpd boolean
);

-- 3) ativa Row Level Security
alter table public.leads enable row level security;

-- 4) remove policy antiga (se houver) e cria policies seguras para INSERT e SELECT
drop policy if exists allow_insert_from_web on public.leads;
drop policy if exists allow_select_for_authenticated on public.leads;

create policy allow_insert_from_web
  ON public.leads
  FOR INSERT
  TO anon
  WITH CHECK (origem = 'formulario' and consentimento_lgpd = true);

create policy allow_select_for_authenticated
  ON public.leads
  FOR SELECT
  TO authenticated
  USING (true);

-- 5) garante que os papeis públicos possam executar as operações necessárias
GRANT INSERT ON public.leads TO anon;
GRANT SELECT ON public.leads TO authenticated;

-- FIM: execute este arquivo no SQL Editor do Supabase. "Success. No rows returned" indica execução bem-sucedida.
