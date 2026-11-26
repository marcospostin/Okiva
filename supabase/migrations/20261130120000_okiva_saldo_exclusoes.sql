-- Okiva · etapa 15: saldo no banco igual ao do app, "começar do zero" com subcontas
-- e cartão removido sem mexer no saldo.
--
-- 1. balance_of: transferência não muda o total; ajuste fora do cartão soma com o sinal dele
--    (antes os dois caíam em "gasto fora do cartão" e o set_balance gravava o saldo inicial errado).
--    Compra de cartão removido não sai do saldo (o dinheiro sai no pagamento da fatura).
-- 2. clear_my_data (usado também por delete_my_account e pela saída da demonstração):
--    apaga as contas uma por vez, subcontas primeiro. O trigger handle_account_delete recusa
--    apagar conta que ainda tem subconta e move o saldo para outra conta; com tudo num DELETE
--    só, quem tinha subconta ou mais de uma conta principal não conseguia apagar os dados.
-- 3. Cartão removido: as compras continuam como gasto (teto, relatórios), mas marcadas com
--    removed_card e fora do saldo. Pagamentos de fatura continuam "pagamento de fatura":
--    tiram do saldo (o dinheiro saiu mesmo) e não contam como gasto do mês. Antes os gastos
--    viravam "Dinheiro" (saíam do saldo de novo) e os pagamentos viravam gasto (contados duas vezes).

-- ---------------------------------------------------------------- transactions.removed_card
alter table public.transactions
  add column removed_card text,
  add constraint transactions_removed_card_len check (removed_card is null or length(removed_card) between 1 and 60),
  add constraint transactions_removed_card_no_card check (removed_card is null or method_type <> 'card');
comment on column public.transactions.removed_card is
  'Nome do cartão que foi removido. Compra: fica fora do saldo. Pagamento de fatura: continua tirando do saldo.';

-- Pagamento de fatura de cartão removido não tem mais cartão
alter table public.transactions drop constraint transactions_payment_card;
alter table public.transactions
  add constraint transactions_payment_card check (kind <> 'invoice_payment' or method_type = 'card' or removed_card is not null);

-- Ao trocar a forma de pagamento, o lançamento deixa de ser "do cartão removido"
create or replace function public.clear_removed_card()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.removed_card is not null and new.removed_card is not distinct from old.removed_card
     and (new.method_type is distinct from old.method_type or new.kind is distinct from old.kind) then
    new.removed_card := null;
  end if;
  return new;
end;
$$;
drop trigger if exists clear_removed_card on public.transactions;
create trigger clear_removed_card before update on public.transactions for each row execute function public.clear_removed_card();

-- ---------------------------------------------------------------- saldo
create or replace function public.balance_of(p_user uuid)
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce((select sum(a.starting_balance) from public.accounts a where a.user_id = p_user), 0)
       + coalesce((select sum(case
                                when t.kind = 'income' then t.amount
                                when t.kind = 'invoice_payment' then -t.amount
                                when t.kind = 'transfer' then 0
                                when t.kind = 'adjustment' then case when t.method_type = 'card' then 0 else t.amount end
                                when t.removed_card is not null then 0
                                when t.method_type <> 'card' then -t.amount
                                else 0
                              end)
                     from public.transactions t
                    where t.user_id = p_user and t.date <= current_date), 0)
$$;
revoke execute on function public.balance_of(uuid) from public, anon;

-- ---------------------------------------------------------------- cartão removido
create or replace function public.handle_card_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_prev text := coalesce(current_setting('okiva.skip_invoice_sync', true), '');
  v_label text := left(coalesce(nullif(btrim(old.bank), ''), btrim(old.nickname)) || ' •• ' || old.last4, 60);
begin
  if not public.profile_exists(old.user_id) then
    return old;
  end if;
  perform set_config('okiva.skip_invoice_sync', 'on', true);
  -- Ajuste da fatura só valia para este cartão
  delete from public.transactions
   where card_id = old.id and user_id = old.user_id and kind = 'adjustment';
  -- Compras e pagamentos ficam no histórico com o nome do cartão; o tipo não muda
  update public.transactions
     set method_type = 'cash', card_id = null, removed_card = v_label
   where card_id = old.id and user_id = old.user_id;
  update public.recurrences
     set method_type = 'cash', card_id = null
   where card_id = old.id and user_id = old.user_id;
  update public.invoice_imports
     set card_id = null, previous_invoice = null
   where card_id = old.id and user_id = old.user_id;
  perform set_config('okiva.skip_invoice_sync', v_prev, true);
  return old;
end;
$$;

-- ---------------------------------------------------------------- começar do zero / excluir conta
create or replace function public.clear_my_data()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_prev text := coalesce(current_setting('okiva.skip_invoice_sync', true), '');
  v_acc uuid;
begin
  if v_uid is null then
    raise exception 'Não autenticado.' using errcode = '42501';
  end if;
  if not public.is_demo() and not public.recent_email_verification() then
    raise exception 'Confirme com o código enviado ao seu e-mail antes de apagar os dados.' using errcode = '42501';
  end if;
  perform set_config('okiva.skip_invoice_sync', 'on', true);
  delete from public.transactions    where user_id = v_uid;
  delete from public.invoice_imports where user_id = v_uid;
  delete from public.recurrences     where user_id = v_uid;
  delete from public.category_rules  where user_id = v_uid;
  update public.profiles set featured_goal_id = null, budget_total = 0, starting_balance = 0 where id = v_uid;
  delete from public.goals           where user_id = v_uid;
  delete from public.cards           where user_id = v_uid;
  -- Uma conta por vez, subcontas primeiro: o trigger não deixa apagar conta que ainda tem
  -- subconta e, ao apagar uma conta, passa o saldo dela para outra (que não pode estar sendo
  -- apagada no mesmo comando)
  for v_acc in
    select a.id from public.accounts a where a.user_id = v_uid order by (a.parent_id is null), a.position desc, a.created_at desc
  loop
    delete from public.accounts where id = v_acc and user_id = v_uid;
  end loop;
  delete from public.budget_caps     where user_id = v_uid;
  delete from public.categories      where user_id = v_uid;
  perform public.seed_default_categories(v_uid);
  perform set_config('okiva.skip_invoice_sync', v_prev, true);
end;
$$;
