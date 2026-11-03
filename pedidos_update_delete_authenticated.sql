-- Permite a equipe (CRM) editar e excluir pedidos direto na tela
-- "Turmas" — hoje só existia SELECT para authenticated.
drop policy if exists allow_update_pedidos_authenticated on public.pedidos;
create policy allow_update_pedidos_authenticated
  on public.pedidos for update to authenticated using (true) with check (true);

drop policy if exists allow_delete_pedidos_authenticated on public.pedidos;
create policy allow_delete_pedidos_authenticated
  on public.pedidos for delete to authenticated using (true);

grant update, delete on public.pedidos to authenticated;
