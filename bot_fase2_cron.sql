create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'resumo-diario-20h',
  '0 23 * * *', -- 23:00 UTC = 20:00 horário de Brasília (sem horário de verão)
  $$
  select net.http_post(
    url := 'https://qoxfkbytyvauhpoevaxp.supabase.co/functions/v1/resumo-diario',
    headers := jsonb_build_object('x-cron-secret', '<valor do secret CRON_SECRET — não versionar o valor real>')
  );
  $$
);
