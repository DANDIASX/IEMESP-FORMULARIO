-- Trava de concorrência: evita que mensagens picadas do lead disparem várias respostas
-- do bot em paralelo (bug real: 3 mensagens seguidas da Daniela geraram 3 respostas
-- duplicadas e mal formatadas, uma por cima da outra).
alter table conversas add column if not exists processando_desde timestamptz;
