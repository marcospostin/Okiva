-- =============================================================================
-- Okiva - etapa 8: gasto "sem categoria" (pendente) e regras aprendidas por nome
-- =============================================================================
-- Todo gasto precisa de categoria para os tetos funcionarem. Quando ninguém sabe qual é
-- (nome de CNPJ na fatura, "PAG*JOSE", etc.), o gasto entra SEM categoria (category = null):
--   - conta no total do mês (o dinheiro já saiu), mas em nenhum teto de categoria;
--   - o app sinaliza até a pessoa classificar.
-- Receitas, pagamentos de fatura e recorrências continuam exigindo categoria/origem.
--
-- category_rules: "sempre usar Alimentação para PAG*JOSE". Comparação por normalize_label(nome).
--   A leitura de fatura aplica as regras nas linhas que chegam sem categoria.
--
-- Excluir categoria agora deixa os gastos dela SEM categoria por padrão (antes iam para 'outros');
-- recorrências, que precisam de categoria, vão para 'outros'.
--
-- Rollback: update public.transactions set category = 'outros' where category is null;
--   alter table public.transactions alter column category set not null, drop constraint transactions_category_required;
--   drop table public.category_rules; reaplicar check_category, handle_category_delete, delete_category,
--   save_installments, import_invoice e clear_my_data da etapa anterior.
-- =============================================================================

alter table public.transactions
  alter column category drop not null,
  alter column category drop default,
  add constraint transactions_category_required check (category is not null or kind = 'expense');

comment on column public.transactions.category is 'null = gasto ainda sem categoria (pendente). Receita: origem; pagamento de fatura: outros.';
create index transactions_uncategorized_idx on public.transactions (user_id) where category is null;

-- ---------------------------------------------------------------- category_rules
create table public.category_rules (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  pattern    text not null check (length(btrim(pattern)) > 0),
  category   text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.category_rules is 'Nome (normalize_label) -> categoria, aprendido quando a pessoa classifica um gasto.';
create unique index category_rules_user_pattern_key on public.category_rules (user_id, public.normalize_label(pattern));

create or replace function public.category_rules_normalize()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.pattern := public.normalize_label(new.pattern);
  if not public.is_valid_category(new.user_id, new.category) then
    raise exception 'Categoria inválida: %', new.category using errcode = '23503';
  end if;
  return new;
end;
$$;
create trigger category_rules_normalize before insert or update on public.category_rules for each row execute function public.category_rules_normalize();
create trigger set_updated_at before update on public.category_rules for each row execute function public.set_updated_at();

alter table public.category_rules enable row level security;
revoke all on public.category_rules from public, anon, authenticated;
grant select, insert, update, delete on public.category_rules to authenticated;
create policy category_rules_select_own on public.category_rules for select to authenticated using ((select auth.uid()) = user_id);
create policy category_rules_insert_own on public.category_rules for insert to authenticated with check ((select auth.uid()) = user_id);
create policy category_rules_update_own on public.category_rules for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy category_rules_delete_own on public.category_rules for delete to authenticated using ((select auth.uid()) = user_id);
create policy category_rules_admin_all on public.category_rules for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------------------------------------------------------------- regras de categoria

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
  -- gasto sem categoria (só em transactions; recorrências e tetos exigem categoria)
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
      new.category := null; -- categoria que a pessoa excluiu: fica para classificar
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

-- Excluir categoria: gastos ficam sem categoria (ou vão para okiva.category_move_to); recorrências -> destino ou 'outros'
create or replace function public.handle_category_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_id text := coalesce(old.key, old.id::text);
  v_to text := nullif(nullif(current_setting('okiva.category_move_to', true), ''), '__none__');
begin
  if not public.profile_exists(old.user_id) then
    return null;
  end if;
  if v_to = v_id or (v_to is not null and not public.is_valid_category(old.user_id, v_to)) then
    v_to := null;
  end if;
  update public.transactions set category = v_to where user_id = old.user_id and category = v_id and kind = 'expense';
  update public.recurrences  set category = coalesce(v_to, 'outros') where user_id = old.user_id and category = v_id and kind = 'expense';
  delete from public.budget_caps    where user_id = old.user_id and category = v_id;
  delete from public.category_rules where user_id = old.user_id and category = v_id;
  return null;
end;
$$;

drop function if exists public.delete_category(text, text);
-- p_move_to null = gastos ficam sem categoria
create or replace function public.delete_category(p_category text, p_move_to text default null)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_to text := nullif(p_move_to, '');
begin
  if v_uid is null then
    raise exception 'Não autenticado.' using errcode = '42501';
  end if;
  if v_to = p_category then
    raise exception 'Escolha outra categoria para os lançamentos.' using errcode = '22023';
  end if;
  if v_to is not null and not public.is_valid_category(v_uid, v_to) then
    raise exception 'Categoria de destino inválida: %', v_to using errcode = '23503';
  end if;
  perform set_config('okiva.category_move_to', coalesce(v_to, '__none__'), true);
  delete from public.categories where user_id = v_uid and coalesce(key, id::text) = p_category;
  perform set_config('okiva.category_move_to', '', true);
end;
$$;

-- Classificar: também aceita null (voltar a ficar sem categoria)
create or replace function public.recategorize_transactions(p_ids uuid[], p_category text)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then
    raise exception 'Não autenticado.' using errcode = '42501';
  end if;
  if p_category is not null and not public.is_valid_category(v_uid, p_category) then
    raise exception 'Categoria inválida: %', p_category using errcode = '23503';
  end if;
  update public.transactions set category = p_category
   where user_id = v_uid and id = any (p_ids) and kind = 'expense';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Compra parcelada pode ficar sem categoria (p_category null/vazio)
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
    values (v_uid, btrim(p_name), nullif(p_category, ''), 'card', p_card_id,
            (p_first_date + make_interval(months => i - 1))::date,
            (v_base + case when i = 1 then v_rest else 0 end) / 100.0,
            'manual', 'expense', v_group, i, p_count);
  end loop;
  return v_group;
end;
$$;

-- Leitura de fatura: linha sem categoria usa a regra aprendida pelo nome; sem regra, fica pendente
create or replace function public.import_invoice(p_card_id uuid, p_file_name text, p_total numeric, p_items jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_card public.cards;
  v_inv public.invoice_imports;
  v_duplicate boolean := false;
begin
  if v_uid is null then
    raise exception 'Não autenticado.' using errcode = '42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'p_items deve ser um array JSON.' using errcode = '22023';
  end if;

  if p_card_id is not null then
    select * into v_card from public.cards where id = p_card_id and user_id = v_uid for update;
    if not found then
      raise exception 'Cartão não encontrado.' using errcode = 'P0002';
    end if;
  end if;

  select * into v_inv from public.invoice_imports
   where user_id = v_uid and card_id is not distinct from p_card_id and file_name = p_file_name and total = p_total
   limit 1;

  if found then
    v_duplicate := true;
  else
    insert into public.invoice_imports (user_id, card_id, file_name, total, previous_invoice)
    values (v_uid, p_card_id, p_file_name, p_total, v_card.invoice)
    returning * into v_inv;

    insert into public.transactions (user_id, name, category, method_type, card_id, date, amount, source, invoice_id)
    select v_uid,
           item ->> 'name',
           coalesce(
             nullif(item ->> 'category', ''),
             (select r.category from public.category_rules r
               where r.user_id = v_uid and r.pattern = public.normalize_label(item ->> 'name') limit 1)
           ),
           m.method_type,
           case when m.method_type = 'card'
                then coalesce(item ->> 'cardId', item ->> 'card_id', item -> 'method' ->> 'cardId', p_card_id::text)::uuid end,
           coalesce((item ->> 'date')::date, current_date),
           (item ->> 'amount')::numeric,
           'fatura',
           v_inv.id
      from jsonb_array_elements(p_items) as item
      cross join lateral (
        select coalesce(item ->> 'methodType', item ->> 'method_type', item -> 'method' ->> 'type',
                        case when p_card_id is null then 'cash' else 'card' end)::public.payment_method as method_type
      ) m;

    if p_card_id is not null then
      update public.cards set invoice = p_total where id = p_card_id and user_id = v_uid;
    end if;
  end if;

  return jsonb_build_object(
    'invoice', to_jsonb(v_inv),
    'transactions', coalesce((select jsonb_agg(to_jsonb(t) order by t.date desc) from public.transactions t where t.invoice_id = v_inv.id and t.user_id = v_uid), '[]'::jsonb),
    'card', (select to_jsonb(c) from public.cards c where c.id = v_inv.card_id and c.user_id = v_uid),
    'duplicate', v_duplicate
  );
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
  delete from public.category_rules  where user_id = v_uid;
  update public.profiles set featured_goal_id = null, budget_total = 0, starting_balance = 0 where id = v_uid;
  delete from public.goals           where user_id = v_uid;
  delete from public.cards           where user_id = v_uid;
  delete from public.accounts        where user_id = v_uid;
  delete from public.budget_caps     where user_id = v_uid;
  delete from public.categories      where user_id = v_uid;
  perform public.seed_default_categories(v_uid);
  perform set_config('okiva.skip_invoice_sync', v_prev, true);
end;
$$;

revoke execute on function public.delete_category(text, text) from public, anon;
revoke execute on function public.category_rules_normalize() from public, anon;
grant execute on function public.delete_category(text, text) to authenticated;
