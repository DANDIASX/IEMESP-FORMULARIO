-- lead_qualification_fields.sql
-- Adiciona campos de qualificação do lead ao formulário público: como conheceu a IEMESP,
-- disponibilidade de datas (curso presencial) e objetivo com o curso. Idempotente.

alter table public.leads add column if not exists como_conheceu text;
alter table public.leads add column if not exists disponibilidade text;
alter table public.leads add column if not exists objetivo text;

-- FIM: execute este arquivo no SQL Editor do Supabase.
