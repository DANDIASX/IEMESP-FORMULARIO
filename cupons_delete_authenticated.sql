-- A política de RLS já cobre "for all" (inclui delete), mas o GRANT
-- original só liberava select/insert/update pra authenticated — faltava
-- o delete, usado agora pelo botão "Excluir" na tela de Cupons do CRM.
grant delete on public.cupons to authenticated;
