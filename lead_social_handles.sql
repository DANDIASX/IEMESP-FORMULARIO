-- lead_social_handles.sql
-- Campos opcionais de @ do Instagram e TikTok no formulário público.
-- Idempotente.

alter table public.leads add column if not exists instagram text;
alter table public.leads add column if not exists tiktok text;

-- FIM: execute este arquivo no SQL Editor do Supabase.
