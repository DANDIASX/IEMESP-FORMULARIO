-- lead_liga_falciforme.sql
-- Página /falciforme (aula na liga): perfil do lead, cupom atribuído e
-- turma de interesse, gravados na mesma tabela leads que o CRM já lê.
-- Também libera o INSERT público pra origem 'liga' (hoje só 'formulario').
-- Idempotente.

alter table public.leads add column if not exists perfil text;
alter table public.leads add column if not exists cupom text;
alter table public.leads add column if not exists turma_interesse text;

drop policy if exists allow_insert_from_web on public.leads;
create policy allow_insert_from_web
  on public.leads
  for insert
  to anon
  with check (origem in ('formulario', 'liga') and consentimento_lgpd = true);

-- FIM: execute este arquivo no SQL Editor do Supabase.
