-- Fase 2 do bot: tabela para os avisos do notificar_danilo (pra saber a quais botões do
-- Telegram cada toque se refere) e coluna em rascunhos pra ligar a resposta (reply) do
-- Telegram ao rascunho certo.

create table if not exists bot_avisos (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references conversas (id) on delete cascade,
  prioridade text not null check (prioridade in ('alta', 'media', 'baixa')),
  motivo text,
  resumo text,
  sugestao_de_resposta text,
  telegram_message_id bigint,
  resolvido boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists bot_avisos_conversa_idx on bot_avisos (conversa_id);

alter table rascunhos add column if not exists telegram_message_id bigint;

alter table bot_avisos enable row level security;
drop policy if exists allow_all_bot_avisos_authenticated on bot_avisos;
create policy allow_all_bot_avisos_authenticated on bot_avisos for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.bot_avisos to authenticated, service_role;
