-- =============================================================================
-- Okiva - etapa 14b: subcontas, mover dinheiro, ajuste e conferência
-- =============================================================================
-- accounts.parent_id          Subconta (poupança, caixinha… nome livre). Um nível só: subconta
--                             não tem subconta. Total da conta = ela + subcontas (calculado no app).
-- accounts/cards.reconciled_on, reconciled_balance
--                             Última conferência com o banco ("Conferido em 12/11").
-- transactions.transfer_account_id
--                             kind = 'transfer': sai de account_id e entra em transfer_account_id.
--                             Não mexe no saldo total, nem em teto, relatórios ou receitas.
-- kind = 'adjustment'         Ajuste da conferência ("Não sei"): valor com sinal. Na conta mexe no
--                             saldo; no cartão (method card) mexe na fatura.
-- Excluir subconta: lançamentos e saldo voltam para a conta mãe. Conta com subcontas não pode ser
-- excluída antes delas.
--
-- Rollback: drop das colunas novas e das constraints *_transfer_*, *_adjustment_*; reaplicar
--   card_effect, check_category, handle_account_delete das etapas 6 e 8; amount > 0; teto de contas 30.
-- =============================================================================

-- ---------------------------------------------------------------- subcontas
alter table public.accounts
  add column parent_id uuid,
  add column reconciled_on date,
  add column reconciled_balance numeric(14, 2),
  add constraint accounts_parent_fkey foreign key (parent_id, user_id) references public.accounts (id, user_id),
  add constraint accounts_parent_not_self check (parent_id is null or parent_id <> id);
create index accounts_parent_idx on public.accounts (parent_id) where parent_id is not null;
comment on column public.accounts.parent_id is 'Subconta (poupança, caixinha…) da conta indicada. Um nível só.';

alter table public.cards
  add column reconciled_on date,
  add column reconciled_balance numeric(14, 2);

create or replace function public.check_account_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_id is not null then
    if exists (select 1 from public.accounts p where p.id = new.parent_id and p.parent_id is not null) then
      raise exception 'Subconta não pode ter subconta.' using errcode = '23514';
    end if;
    if tg_op = 'UPDATE' and exists (select 1 from public.accounts c where c.parent_id = new.id) then
      raise exception 'Uma conta com subcontas não pode virar subconta.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.check_account_parent() from public, anon;
create trigger check_account_parent before insert or update of parent_id on public.accounts
  for each row execute function public.check_account_parent();

-- Excluir: subconta devolve tudo para a conta mãe; conta com subcontas precisa delas apagadas antes
create or replace function public.handle_account_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_target uuid;
begin
  if not public.profile_exists(old.user_id) then
    return old;
  end if;
  if exists (select 1 from public.accounts c where c.parent_id = old.id) then
    raise exception 'Apague as subcontas desta conta antes.' using errcode = '23503';
  end if;
  if old.parent_id is not null then
    v_target := old.parent_id;
  else
    select a.id into v_target from public.accounts a
     where a.user_id = old.user_id and a.id <> old.id and a.parent_id is null
     order by a.position, a.created_at limit 1;
  end if;
  if v_target is not null then
    -- Transferências entre as duas viram "da conta para ela mesma": saem (o saldo junta de qualquer jeito)
    delete from public.transactions
     where user_id = old.user_id and kind = 'transfer'
       and ((account_id = old.id and transfer_account_id = v_target) or (account_id = v_target and transfer_account_id = old.id));
    update public.transactions set account_id = v_target where account_id = old.id and user_id = old.user_id;
    update public.transactions set transfer_account_id = v_target where transfer_account_id = old.id and user_id = old.user_id;
    update public.recurrences set account_id = v_target where account_id = old.id and user_id = old.user_id;
    update public.accounts set starting_balance = starting_balance + old.starting_balance where id = v_target;
  end if;
  return old;
end;
$$;

-- Subcontas contam no teto de contas por usuário
drop trigger if exists enforce_row_cap on public.accounts;
create trigger enforce_row_cap before insert on public.accounts for each row execute function public.enforce_row_cap('60');

-- ---------------------------------------------------------------- transferência e ajuste
alter table public.transactions
  add column transfer_account_id uuid,
  add constraint transactions_transfer_account_fkey foreign key (transfer_account_id, user_id)
    references public.accounts (id, user_id) on delete set null (transfer_account_id);
comment on column public.transactions.transfer_account_id is 'Transferência: conta que recebe (account_id é a que envia).';

alter table public.transactions drop constraint transactions_amount_check;
alter table public.transactions add constraint transactions_amount_check
  check (amount > 0 or (kind = 'adjustment' and amount <> 0));

alter table public.transactions drop constraint transactions_category_required;
alter table public.transactions add constraint transactions_category_required
  check (category is not null or kind in ('expense', 'transfer', 'adjustment'));

alter table public.transactions add constraint transactions_transfer_shape check (
  kind <> 'transfer'
  or (transfer_account_id is not null and account_id is not null and transfer_account_id <> account_id
      and method_type <> 'card' and installment_group is null and recurrence_id is null)
);
alter table public.transactions add constraint transactions_transfer_only check (kind = 'transfer' or transfer_account_id is null);
alter table public.transactions add constraint transactions_adjustment_shape check (
  kind <> 'adjustment' or (installment_group is null and recurrence_id is null and (method_type = 'card' or account_id is not null))
);

-- Transferência e ajuste não têm categoria
create or replace function public.check_category()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_kind text := to_jsonb(new) ->> 'kind';
begin
  if v_kind = 'invoice_payment' then
    new.category := 'outros';
    return new;
  end if;
  if v_kind in ('transfer', 'adjustment') then
    new.category := null;
    return new;
  end if;
  if new.category is null and v_kind = 'expense' then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.category is not distinct from old.category and new.user_id = old.user_id
     and v_kind is not distinct from (to_jsonb(old) ->> 'kind') then
    return new;
  end if;
  if v_kind = 'income' then
    if not public.is_income_category(new.category) then
      raise exception 'Origem de receita inválida: %', new.category using errcode = '23503';
    end if;
  elsif not public.is_valid_category(new.user_id, new.category) then
    if (to_jsonb(new) ->> 'source') = 'fatura' then
      new.category := null;
      if v_kind is distinct from 'expense' then
        new.category := 'outros';
      end if;
    else
      raise exception 'Categoria inválida: %', new.category
        using errcode = '23503', hint = 'Use uma categoria sua.';
    end if;
  end if;
  return new;
end;
$$;

-- Ajuste no cartão mexe na fatura (com sinal)
create or replace function public.card_effect(p_kind public.tx_kind, p_method public.payment_method, p_posted boolean, p_amount numeric)
returns numeric
language sql
immutable parallel safe
set search_path = ''
as $$
  select case
           when p_method <> 'card' or not p_posted then 0
           when p_kind = 'expense' then p_amount
           when p_kind = 'invoice_payment' then -p_amount
           when p_kind = 'adjustment' then p_amount
           else 0
         end
$$;

-- Excluir cartão: ajustes da fatura dele saem (só corrigiam aquela fatura); o resto vira "Dinheiro"
create or replace function public.handle_card_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_prev text := coalesce(current_setting('okiva.skip_invoice_sync', true), '');
begin
  if not public.profile_exists(old.user_id) then
    return old;
  end if;
  perform set_config('okiva.skip_invoice_sync', 'on', true);
  delete from public.transactions
   where card_id = old.id and user_id = old.user_id and kind = 'adjustment';
  update public.transactions
     set kind = 'expense', method_type = 'cash', card_id = null
   where card_id = old.id and user_id = old.user_id and kind = 'invoice_payment';
  update public.transactions
     set method_type = 'cash', card_id = null
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
