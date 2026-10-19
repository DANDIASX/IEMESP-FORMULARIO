-- Permite a equipe (usuários autenticados no CRM) marcar o CRM como
-- conferido no pedido, direto pela tela "Turmas" do iemesp-crm.
drop policy if exists allow_update_pedidos_authenticated on public.pedidos;
create policy allow_update_pedidos_authenticated
  on public.pedidos for update to authenticated using (true) with check (true);
grant update on public.pedidos to authenticated;
