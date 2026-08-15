-- crm_schema.sql
-- Extensão do banco existente (mesmo projeto Supabase do formulário) para suportar o CRM.
-- Idempotente: pode rodar quantas vezes precisar sem duplicar nada.

create extension if not exists pgcrypto;

-- 1) Pipeline: novas colunas em leads
alter table public.leads add column if not exists pipeline_stage text not null default 'novo';
alter table public.leads add column if not exists stage_updated_at timestamptz not null default now();

alter table public.leads drop constraint if exists leads_pipeline_stage_check;
alter table public.leads add constraint leads_pipeline_stage_check
  check (pipeline_stage in ('novo','contatado','matriculado','perdido'));

drop policy if exists allow_update_pipeline_for_authenticated on public.leads;
create policy allow_update_pipeline_for_authenticated
  on public.leads for update to authenticated using (true) with check (true);
grant update on public.leads to authenticated;

-- 2) Alunos (aluno referencia o lead de origem)
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  nome text not null,
  email text,
  telefone text,
  status text not null default 'ativo' check (status in ('ativo','concluido','trancado','desistente')),
  created_at timestamptz not null default now()
);
alter table public.students enable row level security;
drop policy if exists allow_all_students_for_authenticated on public.students;
create policy allow_all_students_for_authenticated
  on public.students for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.students to authenticated;

-- 3) Estrutura do curso prático (gerida via Table Editor do Supabase, sem tela própria no CRM v1)
create table if not exists public.course_modules (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.course_lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.course_modules(id) on delete cascade,
  titulo text not null,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.course_modules enable row level security;
alter table public.course_lessons enable row level security;
drop policy if exists allow_all_modules_for_authenticated on public.course_modules;
create policy allow_all_modules_for_authenticated
  on public.course_modules for all to authenticated using (true) with check (true);
drop policy if exists allow_all_lessons_for_authenticated on public.course_lessons;
create policy allow_all_lessons_for_authenticated
  on public.course_lessons for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.course_modules to authenticated;
grant select, insert, update, delete on public.course_lessons to authenticated;

-- 4) Progresso do aluno (1 linha = 1 aula concluída)
create table if not exists public.student_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  lesson_id uuid not null references public.course_lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (student_id, lesson_id)
);
alter table public.student_progress enable row level security;
drop policy if exists allow_all_progress_for_authenticated on public.student_progress;
create policy allow_all_progress_for_authenticated
  on public.student_progress for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.student_progress to authenticated;

-- FIM: execute este arquivo no SQL Editor do Supabase. "Success. No rows returned" indica execução bem-sucedida.
