-- =============================================================================
-- Okiva - etapa 6: receitas, contas, recorrências, compras parceladas e aviso de teto
-- =============================================================================
-- Modelo:
--   transactions.kind        expense | income | invoice_payment
--   accounts                 contas da pessoa (cada uma com saldo inicial). Saldo da Home = soma de todas.
--   recurrences              regra "todo mês, dia X" (gasto ou receita). process_due() gera o lançamento
--                            quando a data chega; nada é criado antes (o mês não aparece antes da hora).
--   parcelas                 uma linha por parcela (installment_group / _number / _total). Só o valor da
--                            parcela conta no mês dela. A RPC save_installments divide como a maquininha:
--                            centavos que sobram vão na 1ª parcela.
--   posted                   a parcela futura só entra na fatura do cartão quando a data dela chega.
--   budget_caps.alert_*      aviso por categoria (liga/desliga e porcentagem).
--
-- Saldo (regra única, também em src/state/store.tsx -> balanceOf):
--   soma(accounts.starting_balance)
--   + receitas  - gastos que NÃO são no cartão  - pagamentos de fatura      (só datas <= hoje)
--   Gastos no cartão não mexem no saldo: o dinheiro sai quando a fatura é paga.
--
-- Migração dos dados existentes: cada pessoa ganha a conta "Principal" com saldo inicial calculado
-- para o saldo mostrado continuar o mesmo (profiles.starting_balance deixa de ser usado e vai a 0).
--
-- Rollback (destrutivo para os dados novos):
--   drop function if exists public.process_due(), public.save_installments(uuid, text, text, uuid, numeric, int, date),
--     public.ensure_default_account(uuid), public.balance_of(uuid), public.card_effect(public.tx_kind, public.payment_method, boolean, numeric),
--     public.set_tx_posted(), public.handle_account_delete() cascade;
--   alter table public.transactions drop column kind, drop column account_id, drop column installment_group,
--     drop column installment_number, drop column installment_total, drop column recurrence_id, drop column posted;
--   alter table public.budget_caps drop column alert_enabled, drop column alert_percent;
--   drop table public.recurrences, public.accounts; drop type public.tx_kind, public.account_kind;
--   (e reaplicar as versões anteriores de sync_card_invoice, check_category, check_not_future_date,
--    handle_card_delete, handle_category_delete, set_balance, clear_my_data)
-- =============================================================================

-- ---------------------------------------------------------------- enums
create type public.tx_kind      as enum ('expense', 'income', 'invoice_payment');
create type public.account_kind as enum ('checking', 'savings', 'wallet');

-- ---------------------------------------------------------------- accounts
create table public.accounts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name             text not null check (length(btrim(name)) between 1 and 30),
  kind             public.account_kind not null default 'checking',
  starting_balance numeric(12,2) not null default 0,
  position         integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint accounts_id_user_key unique (id, user_id)
);
comment on table public.accounts is 'Contas da pessoa. Saldo da conta = starting_balance + receitas - gastos fora do cartão - pagamentos de fatura.';
create index accounts_user_position_idx on public.accounts (user_id, position);

-- ---------------------------------------------------------------- recurrences
create table public.recurrences (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind        public.tx_kind not null check (kind in ('expense', 'income')),
  name        text not null check (length(btrim(name)) > 0),
  category    text not null default 'outros',
  method_type public.payment_method not null default 'pix',
  card_id     uuid,
  account_id  uuid,
  amount      numeric(12,2) not null check (amount > 0),
  day         smallint not null check (day between 1 and 31),
  start_date  date not null default current_date,
  end_date    date,
  last_run    date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint recurrences_id_user_key unique (id, user_id),
  constraint recurrences_card_required check ((method_type = 'card') = (card_id is not null)),
  constraint recurrences_income_no_card check (kind = 'expense' or method_type <> 'card'),
  constraint recurrences_end_after_start check (end_date is null or end_date >= start_date),
  constraint recurrences_card_fkey foreign key (card_id, user_id) references public.cards (id, user_id) on delete set null (card_id),
  constraint recurrences_account_fkey foreign key (account_id, user_id) references public.accounts (id, user_id) on delete set null (account_id)
);
comment on column public.recurrences.last_run is 'Último dia já processado por process_due(); ocorrências geradas até aqui não voltam se apagadas.';
create index recurrences_user_idx on public.recurrences (user_id, created_at);
create index recurrences_card_idx on public.recurrences (card_id, user_id);
create index recurrences_account_idx on public.recurrences (account_id, user_id);

-- ---------------------------------------------------------------- transactions
alter table public.transactions
  add column kind               public.tx_kind not null default 'expense',
  add column account_id         uuid,
  add column installment_group  uuid,
  add column installment_number smallint,
  add column installment_total  smallint,
  add column recurrence_id      uuid,
  add column posted             boolean not null default true,
  add constraint transactions_account_fkey foreign key (account_id, user_id) references public.accounts (id, user_id) on delete set null (account_id),
  add constraint transactions_recurrence_fkey foreign key (recurrence_id, user_id) references public.recurrences (id, user_id) on delete set null (recurrence_id),
  add constraint transactions_installment_check check (
    (installment_group is null and installment_number is null and installment_total is null)
    or (installment_group is not null and installment_total between 2 and 48 and installment_number between 1 and installment_total)
  ),
  add constraint transactions_installment_expense check (installment_group is null or kind = 'expense'),
  add constraint transactions_installment_not_recurring check (installment_group is null or recurrence_id is null),
  add constraint transactions_payment_card check (kind <> 'invoice_payment' or method_type = 'card'),
  add constraint transactions_income_no_card check (kind <> 'income' or method_type <> 'card');

comment on column public.transactions.posted is 'false = parcela futura, ainda fora da fatura do cartão (process_due() posta quando a data chega).';
create index transactions_account_idx on public.transactions (account_id, user_id);
create index transactions_installment_idx on public.transactions (installment_group) where installment_group is not null;
create index transactions_recurrence_idx on public.transactions (recurrence_id, user_id);
create unique index transactions_recurrence_date_key on public.transactions (recurrence_id, date) where recurrence_id is not null;

-- ---------------------------------------------------------------- budget_caps: aviso
alter table public.budget_caps
  add column alert_enabled boolean not null default true,
  add column alert_percent smallint not null default 80 check (alert_percent between 1 and 100);

-- ===================================================================== regras

-- Origens de receita (não são categorias de gasto e não têm teto)
create or replace function public.is_income_category(p_category text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select p_category in ('receita_salario', 'receita_extra', 'receita_rendimentos', 'receita_reembolso', 'receita_outros')
$$;

-- Categoria conforme o tipo: receita usa as origens; pagamento de fatura fica em 'outros'; gasto como antes.
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
  if tg_op = 'UPDATE' and new.category is not distinct from old.category and new.user_id = old.user_id
     and v_kind is not distinct from (to_jsonb(old) ->> 'kind') then
    return new;
  end if;
  if v_kind = 'income' then
    if not public.is_income_category(new.category) then
      raise exception 'Origem de receita inválida: %', new.category using errcode = '23503';
    end if;
  elsif not public.is_valid_category(new.user_id, new.category) then
    raise exception 'Categoria inválida: %', new.category
      using errcode = '23503', hint = 'Use uma categoria fixa ou o id de uma categoria sua.';
  end if;
  return new;
end;
$$;

-- Data futura só para parcelas a partir da 2ª (a 1ª é a data da compra).
create or replace function public.check_not_future_date()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce((to_jsonb(new) ->> 'installment_number')::int, 1) > 1 then
    return new;
  end if;
  if (tg_op = 'INSERT' or new.date is distinct from old.date) and new.date > current_date then
    raise exception 'A data não pode ser no futuro (%).', new.date using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Parcela futura fica fora da fatura até o dia dela.
create or replace function public.set_tx_posted()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.posted := new.date <= current_date;
  return new;
end;
$$;

-- Efeito de um lançamento na fatura do cartão.
create or replace function public.card_effect(p_kind public.tx_kind, p_method public.payment_method, p_posted boolean, p_amount numeric)
returns numeric
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
           when p_method <> 'card' or not p_posted then 0
           when p_kind = 'expense' then p_amount
           when p_kind = 'invoice_payment' then -p_amount
           else 0
         end
$$;

-- Fatura do cartão: gasto postado soma, pagamento de fatura subtrai.
-- INSERT vindo de importação (invoice_id) não soma: o total importado substitui a fatura.
create or replace function public.sync_card_invoice()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_old numeric := 0;
  v_new numeric := 0;
begin
  if coalesce(current_setting('okiva.skip_invoice_sync', true), '') = 'on' then
    return null;
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    v_old := public.card_effect(old.kind, old.method_type, old.posted, old.amount);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_new := public.card_effect(new.kind, new.method_type, new.posted, new.amount);
  end if;

  if tg_op = 'INSERT' then
    if new.invoice_id is null and v_new <> 0 then
      update public.cards set invoice = greatest(0, invoice + v_new) where id = new.card_id and user_id = new.user_id;
    end if;
  elsif tg_op = 'UPDATE' then
    if new.card_id is not distinct from old.card_id and v_new = v_old then
      return null;
    end if;
    if old.card_id is not null and old.card_id = new.card_id then
      update public.cards set invoice = greatest(0, invoice + v_new - v_old) where id = new.card_id and user_id = new.user_id;
    else
      if v_old <> 0 then
        update public.cards set invoice = greatest(0, invoice - v_old) where id = old.card_id and user_id = old.user_id;
      end if;
      if v_new <> 0 then
        update public.cards set invoice = greatest(0, invoice + v_new) where id = new.card_id and user_id = new.user_id;
      end if;
    end if;
  elsif tg_op = 'DELETE' then
    if v_old <> 0 and public.profile_exists(old.user_id) then
      update public.cards set invoice = greatest(0, invoice - v_old) where id = old.card_id and user_id = old.user_id;
    end if;
  end if;
  return null;
end;
$$;

-- Excluir cartão: gastos e recorrências dele viram 'cash'.
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
  -- Pagamentos de fatura do cartão excluído deixam de ter cartão: viram gasto em dinheiro "Fatura"
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

-- Excluir categoria: gastos e recorrências dela -> 'outros'; teto removido.
create or replace function public.handle_category_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.profile_exists(old.user_id) then
    return null;
  end if;
  update public.transactions set category = 'outros' where user_id = old.user_id and category = old.id::text;
  update public.recurrences  set category = 'outros' where user_id = old.user_id and category = old.id::text;
  delete from public.budget_caps where user_id = old.user_id and category = old.id::text;
  return null;
end;
$$;

-- Excluir conta: lançamentos e recorrências dela passam para a conta mais antiga que sobrar.
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
  select a.id into v_target from public.accounts a
   where a.user_id = old.user_id and a.id <> old.id
   order by a.position, a.created_at limit 1;
  if v_target is not null then
    update public.transactions set account_id = v_target where account_id = old.id and user_id = old.user_id;
    update public.recurrences  set account_id = v_target where account_id = old.id and user_id = old.user_id;
    -- o saldo inicial também vai junto, para o saldo total não mudar
    update public.accounts set starting_balance = starting_balance + old.starting_balance where id = v_target;
  end if;
  return old;
end;
$$;

create or replace function public.accounts_set_position()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.position is null or new.position = 0 then
    select coalesce(max(a.position), 0) + 1 into new.position from public.accounts a where a.user_id = new.user_id;
  end if;
  return new;
end;
$$;

-- ===================================================================== saldo e conta padrão

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
                                when t.method_type <> 'card' then -t.amount
                                else 0
                              end)
                     from public.transactions t
                    where t.user_id = p_user and t.date <= current_date), 0)
$$;

-- Toda pessoa tem ao menos uma conta. A primeira absorve profiles.starting_balance (cadastro / dados antigos)
-- de forma que o saldo mostrado não muda: antes os gastos no cartão saíam do saldo, agora não.
create or replace function public.ensure_default_account(p_user uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_start numeric;
begin
  select a.id into v_id from public.accounts a where a.user_id = p_user order by a.position, a.created_at limit 1;
  if v_id is not null then
    return v_id;
  end if;
  select coalesce(p.starting_balance, 0)
         - coalesce((select sum(t.amount) from public.transactions t
                      where t.user_id = p_user and t.kind = 'expense' and t.method_type = 'card'), 0)
    into v_start
    from public.profiles p where p.id = p_user;
  if not found then
    return null;
  end if;
  insert into public.accounts (user_id, name, kind, starting_balance, position)
  values (p_user, 'Principal', 'checking', v_start, 1)
  returning id into v_id;
  update public.transactions set account_id = v_id
   where user_id = p_user and account_id is null and not (kind = 'expense' and method_type = 'card');
  update public.recurrences set account_id = v_id
   where user_id = p_user and account_id is null and method_type <> 'card';
  update public.profiles set starting_balance = 0 where id = p_user;
  return v_id;
end;
$$;

-- ===================================================================== RPCs

-- Chamada ao abrir o app: garante a conta padrão, posta parcelas que venceram e gera as recorrências
-- cujo dia chegou. Idempotente.
create or replace function public.process_due()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  r public.recurrences;
  v_from date;
  v_to date;
  v_month date;
  v_day date;
  v_count integer := 0;
  v_rows integer;
begin
  if v_uid is null then
    raise exception 'Não autenticado.' using errcode = '42501';
  end if;
  perform public.ensure_default_account(v_uid);

  update public.transactions set posted = true
   where user_id = v_uid and not posted and date <= current_date;

  for r in select * from public.recurrences where user_id = v_uid loop
    v_from := greatest(r.start_date, coalesce(r.last_run + 1, r.start_date));
    v_to := least(current_date, coalesce(r.end_date, current_date));
    continue when v_from > v_to;
    for v_month in
      select generate_series(date_trunc('month', v_from), date_trunc('month', v_to), interval '1 month')::date
    loop
      v_day := v_month + (least(r.day, extract(day from (v_month + interval '1 month' - interval '1 day'))::int) - 1);
      if v_day between v_from and v_to then
        insert into public.transactions (user_id, name, category, method_type, card_id, account_id, date, amount, source, kind, recurrence_id)
        values (v_uid, r.name, r.category, r.method_type, r.card_id,
                case when r.method_type = 'card' then null else coalesce(r.account_id, public.ensure_default_account(v_uid)) end,
                v_day, r.amount, 'manual', r.kind, r.id)
        on conflict (recurrence_id, date) where recurrence_id is not null do nothing;
        get diagnostics v_rows = row_count;
        v_count := v_count + v_rows;
      end if;
    end loop;
    update public.recurrences set last_run = v_to where id = r.id;
  end loop;
  return v_count;
end;
$$;

-- Cria (p_group nulo) ou substitui (p_group = compra existente) uma compra parcelada no cartão.
-- Divide como a maquininha: centavos que sobram vão na 1ª parcela. Parcela n = data da compra + (n-1) meses.
create or replace function public.save_installments(
  p_group uuid, p_name text, p_category text, p_card_id uuid, p_total numeric, p_count integer, p_first_date date
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_group uuid := coalesce(p_group, gen_random_uuid());
  v_cents bigint;
  v_base bigint;
  v_rest bigint;
  i integer;
begin
  if v_uid is null then
    raise exception 'Não autenticado.' using errcode = '42501';
  end if;
  if p_count is null or p_count < 2 or p_count > 48 then
    raise exception 'Parcelas entre 2 e 48.' using errcode = '23514';
  end if;
  if p_total is null or p_total <= 0 then
    raise exception 'Valor da compra inválido.' using errcode = '23514';
  end if;
  if p_first_date is null or p_first_date > current_date then
    raise exception 'A data da compra não pode ser no futuro.' using errcode = '23514';
  end if;
  if not exists (select 1 from public.cards c where c.id = p_card_id and c.user_id = v_uid) then
    raise exception 'Cartão não encontrado.' using errcode = 'P0002';
  end if;
  v_cents := round(p_total * 100);
  if v_cents < p_count then
    raise exception 'Valor pequeno demais para % parcelas.', p_count using errcode = '23514';
  end if;

  if p_group is not null then
    delete from public.transactions where user_id = v_uid and installment_group = p_group;
  end if;

  v_base := v_cents / p_count;
  v_rest := v_cents - v_base * p_count;
  for i in 1..p_count loop
    insert into public.transactions (user_id, name, category, method_type, card_id, date, amount, source, kind,
                                     installment_group, installment_number, installment_total)
    values (v_uid, btrim(p_name), coalesce(nullif(p_category, ''), 'outros'), 'card', p_card_id,
            (p_first_date + make_interval(months => i - 1))::date,
            (v_base + case when i = 1 then v_rest else 0 end) / 100.0,
            'manual', 'expense', v_group, i, p_count);
  end loop;
  return v_group;
end;
$$;

-- Saldo informado hoje: a diferença entra no saldo inicial da primeira conta.
create or replace function public.set_balance(p_balance numeric)
returns numeric
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_acc uuid;
begin
  if v_uid is null then
    raise exception 'Não autenticado.' using errcode = '42501';
  end if;
  v_acc := public.ensure_default_account(v_uid);
  update public.accounts
     set starting_balance = starting_balance + (p_balance - public.balance_of(v_uid))
   where id = v_acc and user_id = v_uid;
  return p_balance;
end;
$$;

create or replace function public.clear_my_data()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_prev text := coalesce(current_setting('okiva.skip_invoice_sync', true), '');
begin
  if v_uid is null then
    raise exception 'Não autenticado.' using errcode = '42501';
  end if;
  perform set_config('okiva.skip_invoice_sync', 'on', true);
  delete from public.transactions    where user_id = v_uid;
  delete from public.invoice_imports where user_id = v_uid;
  delete from public.recurrences     where user_id = v_uid;
  update public.profiles set featured_goal_id = null, budget_total = 0, starting_balance = 0 where id = v_uid;
  delete from public.goals           where user_id = v_uid;
  delete from public.cards           where user_id = v_uid;
  delete from public.accounts        where user_id = v_uid;
  delete from public.budget_caps     where user_id = v_uid;
  delete from public.categories      where user_id = v_uid;
  perform set_config('okiva.skip_invoice_sync', v_prev, true);
end;
$$;

-- ===================================================================== triggers

create trigger set_updated_at before update on public.accounts    for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.recurrences for each row execute function public.set_updated_at();
create trigger accounts_set_position before insert on public.accounts for each row execute function public.accounts_set_position();
create trigger handle_account_delete before delete on public.accounts for each row execute function public.handle_account_delete();
create trigger check_category before insert or update on public.recurrences for each row execute function public.check_category();
-- roda antes de sync_card_invoice (AFTER) e junto das outras validações
create trigger set_tx_posted before insert or update on public.transactions for each row execute function public.set_tx_posted();

-- ===================================================================== RLS e grants

alter table public.accounts    enable row level security;
alter table public.recurrences enable row level security;

revoke all on public.accounts, public.recurrences from public, anon, authenticated;
grant select, insert, update, delete on public.accounts, public.recurrences to authenticated;

create policy accounts_select_own on public.accounts for select to authenticated using ((select auth.uid()) = user_id);
create policy accounts_insert_own on public.accounts for insert to authenticated with check ((select auth.uid()) = user_id);
create policy accounts_update_own on public.accounts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy accounts_delete_own on public.accounts for delete to authenticated using ((select auth.uid()) = user_id);

create policy recurrences_select_own on public.recurrences for select to authenticated using ((select auth.uid()) = user_id);
create policy recurrences_insert_own on public.recurrences for insert to authenticated with check ((select auth.uid()) = user_id);
create policy recurrences_update_own on public.recurrences for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy recurrences_delete_own on public.recurrences for delete to authenticated using ((select auth.uid()) = user_id);

create policy accounts_admin_all on public.accounts for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy recurrences_admin_all on public.recurrences for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

revoke execute on function public.is_income_category(text) from public, anon;
revoke execute on function public.card_effect(public.tx_kind, public.payment_method, boolean, numeric) from public, anon;
revoke execute on function public.balance_of(uuid) from public, anon;
revoke execute on function public.ensure_default_account(uuid) from public, anon;
revoke execute on function public.process_due() from public, anon;
revoke execute on function public.save_installments(uuid, text, text, uuid, numeric, integer, date) from public, anon;
revoke execute on function public.set_tx_posted() from public, anon;
revoke execute on function public.handle_account_delete() from public, anon;
revoke execute on function public.accounts_set_position() from public, anon;

-- usadas dentro de triggers/RPCs executados com o papel de quem chama (RLS continua valendo)
grant execute on function public.is_income_category(text) to authenticated;
grant execute on function public.card_effect(public.tx_kind, public.payment_method, boolean, numeric) to authenticated;
grant execute on function public.balance_of(uuid) to authenticated;
grant execute on function public.ensure_default_account(uuid) to authenticated;
-- RPCs
grant execute on function public.process_due() to authenticated;
grant execute on function public.save_installments(uuid, text, text, uuid, numeric, integer, date) to authenticated;

-- ===================================================================== dados existentes

do $$
declare
  p record;
begin
  for p in select id from public.profiles loop
    perform public.ensure_default_account(p.id);
  end loop;
end $$;
