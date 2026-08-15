-- form_segmentation.sql
-- Adiciona segmentação por produto (curso presencial vs plataforma) e
-- rastreamento de UTM à tabela leads já existente. Idempotente.

alter table public.leads add column if not exists produto_interesse text;
alter table public.leads drop constraint if exists leads_produto_interesse_check;
alter table public.leads add constraint leads_produto_interesse_check
  check (produto_interesse in ('curso_pratico', 'plataforma', 'ambos'));

alter table public.leads add column if not exists utm_source text;
alter table public.leads add column if not exists utm_medium text;
alter table public.leads add column if not exists utm_campaign text;

-- FIM: execute este arquivo no SQL Editor do Supabase.
