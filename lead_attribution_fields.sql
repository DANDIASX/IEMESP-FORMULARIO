-- lead_attribution_fields.sql
-- Expande o rastreamento de origem do lead: parametros UTM completos,
-- click ids do Google Ads (gclid) e Meta Ads (fbclid), pagina de entrada
-- e referrer. Idempotente.

alter table public.leads add column if not exists utm_source text;
alter table public.leads add column if not exists utm_medium text;
alter table public.leads add column if not exists utm_campaign text;
alter table public.leads add column if not exists utm_content text;
alter table public.leads add column if not exists utm_term text;
alter table public.leads add column if not exists gclid text;
alter table public.leads add column if not exists fbclid text;
alter table public.leads add column if not exists first_landing_page text;
alter table public.leads add column if not exists referrer text;

-- FIM: execute este arquivo no SQL Editor do Supabase. "Success. No rows returned" indica execucao bem-sucedida.
