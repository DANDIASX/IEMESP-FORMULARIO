-- Fase 1 do bot de vendas no WhatsApp — tabelas novas, sem tocar em dados existentes.
-- Única alteração em tabela com dados: ADD COLUMN em leads (3 colunas novas, sem default que quebre linhas antigas).

alter table leads add column if not exists aceite_whatsapp boolean not null default false;
alter table leads add column if not exists aceite_whatsapp_em timestamptz;
alter table leads add column if not exists aceite_whatsapp_origem text;

create table if not exists bot_config (
  id uuid primary key default gen_random_uuid(),
  versao integer not null,
  prompt_sistema text not null,
  base_conhecimento text not null,
  modelo text not null default 'claude-sonnet-5-5',
  modo_padrao text not null default 'automatico' check (modo_padrao in ('automatico', 'aprovacao')),
  horas_pausa_quando_humano integer not null default 12,
  ativo boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists bot_config_ativo_idx on bot_config (ativo) where ativo = true;

create table if not exists conversas (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads (id) on delete set null,
  canal text not null check (canal in ('whatsapp', 'instagram', 'teste')),
  contato_externo_id text,
  estado text not null default 'bot' check (estado in ('bot', 'pausado', 'humano')),
  modo text not null default 'automatico' check (modo in ('automatico', 'aprovacao')),
  etapa text,
  ultima_msg_lead_em timestamptz,
  retomadas_enviadas integer not null default 0,
  optout boolean not null default false,
  pausado_ate timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists conversas_lead_id_idx on conversas (lead_id);
create unique index if not exists conversas_canal_contato_idx on conversas (canal, contato_externo_id) where contato_externo_id is not null;

create table if not exists mensagens (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references conversas (id) on delete cascade,
  direcao text not null check (direcao in ('entrada', 'saida')),
  autor text not null check (autor in ('lead', 'bot', 'danilo')),
  texto text,
  midia_url text,
  canal_msg_id text unique,
  criado_em timestamptz not null default now(),
  tokens_entrada integer,
  tokens_saida integer
);
create index if not exists mensagens_conversa_idx on mensagens (conversa_id, criado_em);

create table if not exists rascunhos (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references conversas (id) on delete cascade,
  texto text not null,
  status text not null default 'pendente' check (status in ('pendente', 'enviado', 'editado', 'descartado')),
  criado_em timestamptz not null default now()
);
create index if not exists rascunhos_conversa_idx on rascunhos (conversa_id);

create table if not exists pedidos_data (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references conversas (id) on delete cascade,
  preferencia text,
  criado_em timestamptz not null default now()
);

create table if not exists lista_interesse (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references conversas (id) on delete cascade,
  motivo text,
  preferencia_de_data text,
  criado_em timestamptz not null default now()
);

alter table bot_config enable row level security;
alter table conversas enable row level security;
alter table mensagens enable row level security;
alter table rascunhos enable row level security;
alter table pedidos_data enable row level security;
alter table lista_interesse enable row level security;

-- Mesmo padrão já usado em leads/pedidos/cupons: só usuário logado no CRM (authenticated) lê e edita.
-- O Edge Function bot-responder usa a service role, que ignora RLS.
drop policy if exists allow_all_bot_config_authenticated on bot_config;
create policy allow_all_bot_config_authenticated on bot_config for all to authenticated using (true) with check (true);

drop policy if exists allow_all_conversas_authenticated on conversas;
create policy allow_all_conversas_authenticated on conversas for all to authenticated using (true) with check (true);

drop policy if exists allow_all_mensagens_authenticated on mensagens;
create policy allow_all_mensagens_authenticated on mensagens for all to authenticated using (true) with check (true);

drop policy if exists allow_all_rascunhos_authenticated on rascunhos;
create policy allow_all_rascunhos_authenticated on rascunhos for all to authenticated using (true) with check (true);

drop policy if exists allow_all_pedidos_data_authenticated on pedidos_data;
create policy allow_all_pedidos_data_authenticated on pedidos_data for all to authenticated using (true) with check (true);

drop policy if exists allow_all_lista_interesse_authenticated on lista_interesse;
create policy allow_all_lista_interesse_authenticated on lista_interesse for all to authenticated using (true) with check (true);

-- Bucket privado para o PDF de apresentação do curso e arquivos que o lead enviar (ex.: declaração de residência).
insert into storage.buckets (id, name, public)
values ('bot-arquivos', 'bot-arquivos', false)
on conflict (id) do nothing;

drop policy if exists bot_arquivos_authenticated on storage.objects;
create policy bot_arquivos_authenticated on storage.objects for all to authenticated
  using (bucket_id = 'bot-arquivos') with check (bucket_id = 'bot-arquivos');

-- Carrega a primeira versão do prompt e da base de conhecimento (conteúdo em bot/prompt_sistema.md e bot/base_conhecimento.md).
-- O texto é inserido por uma query separada (evita escapar milhares de caracteres aqui).
