-- Okiva - etapa 2: regras de negócio (triggers) e RPCs
-- Todas as funções têm search_path fixo (''), nomes totalmente qualificados.
-- SECURITY DEFINER só em handle_new_user, handle_user_email_change e delete_my_account.
--
-- Flags de sessão (transaction-local, via set_config(..., true)) usadas entre triggers:
--   okiva.skip_invoice_sync = 'on'  -> o trigger de transactions NÃO mexe em cards.invoice
--                                      (exclusão de cartão, desfazer importação, zerar dados, seed)
--   okiva.goal_sync         = 'on'  -> a atualização de goals vem do trigger de depósitos
--                                      (só então saved/deposited podem mudar juntos)
--
-- Rollback: drop das funções abaixo com "drop function ... cascade" (remove os triggers).

-- ===================================================================== utilitários

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.is_builtin_category(p_category text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select p_category in ('moradia', 'alimentacao', 'transporte', 'lazer', 'assinaturas', 'saude', 'outros')
$$;

-- Categoria válida para a pessoa: uma das 7 fixas ou o id (texto) de uma categories dela.
create or replace function public.is_valid_category(p_user uuid, p_category text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.is_builtin_category(p_category)
      or exists (select 1 from public.categories c where c.user_id = p_user and c.id::text = p_category)
$$;

-- ===================================================================== validações

-- transactions.category e budget_caps.category
create or replace function public.check_category()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.category is not distinct from old.category and new.user_id = old.user_id then
    return new;
  end if;
  if not public.is_valid_category(new.user_id, new.category) then
    raise exception 'Categoria inválida: %', new.category
      using errcode = '23503', hint = 'Use uma categoria fixa ou o id de uma categoria sua.';
  end if;
  return new;
end;
$$;

-- transactions.date e goal_deposits.date não podem ser futuras (validado só quando a data muda)
create or replace function public.check_not_future_date()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' or new.date is distinct from old.date) and new.date > current_date then
    raise exception 'A data não pode ser no futuro (%).', new.date using errcode = '23514';
  end if;
  return new;
end;
$$;

-- categories: nome não pode repetir uma categoria fixa (o índice único cobre as da pessoa)
create or replace function public.check_category_label()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.normalize_label(new.label) in ('moradia', 'alimentacao', 'transporte', 'lazer', 'assinaturas', 'saude', 'outros') then
    raise exception 'Já existe uma categoria fixa chamada "%".', new.label using errcode = '23505';
  end if;
  return new;
end;
$$;

-- ===================================================================== cartões e fatura

-- Gasto no cartão soma na fatura (reducer addTx/updateTx/deleteTx com adjustInvoice).
-- INSERT vindo de importação (invoice_id preenchido) NÃO soma: na importação o total da fatura
-- substitui cards.invoice (reducer importInvoice). UPDATE e DELETE ajustam sempre, como o reducer.
create or replace function public.sync_card_invoice()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('okiva.skip_invoice_sync', true), '') = 'on' then
    return null;
  end if;

  if tg_op = 'INSERT' then
    if new.method_type = 'card' and new.invoice_id is null then
      update public.cards set invoice = greatest(0, invoice + new.amount)
       where id = new.card_id and user_id = new.user_id;
    end if;

  elsif tg_op = 'UPDATE' then
    if new.method_type is not distinct from old.method_type
       and new.card_id is not distinct from old.card_id
       and new.amount = old.amount then
      return null; -- só nome/categoria/data mudaram: fatura intacta
    end if;
    if old.method_type = 'card' and new.method_type = 'card' and old.card_id = new.card_id then
      update public.cards set invoice = greatest(0, invoice + new.amount - old.amount)
       where id = new.card_id and user_id = new.user_id;
    else
      if old.method_type = 'card' then
        update public.cards set invoice = greatest(0, invoice - old.amount)
         where id = old.card_id and user_id = old.user_id;
      end if;
      if new.method_type = 'card' then
        update public.cards set invoice = greatest(0, invoice + new.amount)
         where id = new.card_id and user_id = new.user_id;
      end if;
    end if;

  elsif tg_op = 'DELETE' then
    if old.method_type = 'card' then
      update public.cards set invoice = greatest(0, invoice - old.amount)
       where id = old.card_id and user_id = old.user_id;
    end if;
  end if;
  return null;
end;
$$;

-- Novo cartão vai para a frente da carteira (maior position).
create or replace function public.cards_set_position()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.position is null or new.position = 0 then
    select coalesce(max(c.position), 0) + 1 into new.position
      from public.cards c where c.user_id = new.user_id;
  end if;
  return new;
end;
$$;

-- Excluir cartão: gastos dele viram 'cash'; faturas importadas ficam no histórico sem cartão.
create or replace function public.handle_card_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_prev text := coalesce(current_setting('okiva.skip_invoice_sync', true), '');
begin
  perform set_config('okiva.skip_invoice_sync', 'on', true);
  update public.transactions
     set method_type = 'cash', card_id = null
   where card_id = old.id and user_id = old.user_id;
  update public.invoice_imports
     set card_id = null, previous_invoice = null
   where card_id = old.id and user_id = old.user_id;
  perform set_config('okiva.skip_invoice_sync', v_prev, true);
  return old;
end;
$$;

-- Excluir invoice_import = desfazer: apaga os lançamentos dela e devolve previous_invoice ao cartão.
create or replace function public.undo_invoice_import()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_prev text := coalesce(current_setting('okiva.skip_invoice_sync', true), '');
begin
  perform set_config('okiva.skip_invoice_sync', 'on', true);
  delete from public.transactions where invoice_id = old.id and user_id = old.user_id;
  perform set_config('okiva.skip_invoice_sync', v_prev, true);
  if old.card_id is not null and old.previous_invoice is not null then
    update public.cards set invoice = old.previous_invoice
     where id = old.card_id and user_id = old.user_id;
  end if;
  return old;
end;
$$;

-- ===================================================================== metas e depósitos

-- Regras de goals (reducer saveGoal):
--  INSERT: o valor digitado é o que a pessoa já tinha -> initial_saved = saved, deposited = 0.
--  UPDATE pelo app: editar "Já guardado" muda só o valor inicial; deposited e started_at não mudam.
--  UPDATE pelo trigger de depósitos (okiva.goal_sync = on): saved e deposited mudam juntos.
--  deadline não pode estar no passado (validado quando muda).
create or replace function public.goals_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' or new.deadline is distinct from old.deadline)
     and new.deadline is not null and new.deadline < to_char(current_date, 'YYYY-MM') then
    raise exception 'O prazo da meta não pode ser no passado (%).', new.deadline using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    new.initial_saved := new.saved;
    new.deposited := 0;
    new.started_at := coalesce(new.started_at, to_char(current_date, 'YYYY-MM'));
  elsif coalesce(current_setting('okiva.goal_sync', true), '') <> 'on' then
    new.deposited := old.deposited;
    new.started_at := old.started_at;
    new.initial_saved := greatest(0, new.saved - new.deposited);
  end if;
  return new;
end;
$$;

-- Depósito criado/editado/excluído aplica a diferença em goals.saved e goals.deposited.
create or replace function public.sync_goal_deposit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_prev text := coalesce(current_setting('okiva.goal_sync', true), '');
begin
  perform set_config('okiva.goal_sync', 'on', true);
  if tg_op in ('UPDATE', 'DELETE') then
    update public.goals
       set saved = greatest(0, saved - old.amount), deposited = greatest(0, deposited - old.amount)
     where id = old.goal_id and user_id = old.user_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    update public.goals
       set saved = saved + new.amount, deposited = deposited + new.amount
     where id = new.goal_id and user_id = new.user_id;
  end if;
  perform set_config('okiva.goal_sync', v_prev, true);
  return null;
end;
$$;

-- Excluir a meta principal: a primeira meta restante vira a principal (reducer deleteGoal).
create or replace function public.refeature_after_goal_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.profiles p
     set featured_goal_id = (select g.id from public.goals g where g.user_id = old.user_id order by g.created_at, g.id limit 1)
   where p.id = old.user_id and p.featured_goal_id is null;
  return null;
end;
$$;

-- ===================================================================== categorias

-- Excluir categoria: gastos dela -> 'outros'; teto dela removido.
create or replace function public.handle_category_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.transactions set category = 'outros'
   where user_id = old.user_id and category = old.id::text;
  delete from public.budget_caps
   where user_id = old.user_id and category = old.id::text;
  return null;
end;
$$;

-- ===================================================================== auth -> profiles

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Você'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

-- ===================================================================== triggers

create trigger set_updated_at before update on public.profiles        for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.cards           for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.goals           for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.goal_deposits   for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.categories      for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.budget_caps     for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.invoice_imports for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.transactions    for each row execute function public.set_updated_at();

create trigger check_category before insert or update on public.transactions for each row execute function public.check_category();
create trigger check_category before insert or update on public.budget_caps  for each row execute function public.check_category();
create trigger check_not_future_date before insert or update on public.transactions  for each row execute function public.check_not_future_date();
create trigger check_not_future_date before insert or update on public.goal_deposits for each row execute function public.check_not_future_date();
create trigger check_category_label before insert or update of label on public.categories for each row execute function public.check_category_label();

create trigger sync_card_invoice after insert or update or delete on public.transactions for each row execute function public.sync_card_invoice();
create trigger cards_set_position before insert on public.cards for each row execute function public.cards_set_position();
create trigger handle_card_delete before delete on public.cards for each row execute function public.handle_card_delete();
create trigger undo_invoice_import before delete on public.invoice_imports for each row execute function public.undo_invoice_import();

create trigger goals_guard before insert or update on public.goals for each row execute function public.goals_guard();
create trigger sync_goal_deposit after insert or update or delete on public.goal_deposits for each row execute function public.sync_goal_deposit();
create trigger refeature_after_goal_delete after delete on public.goals for each row execute function public.refeature_after_goal_delete();

create trigger handle_category_delete after delete on public.categories for each row execute function public.handle_category_delete();

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
create trigger on_auth_user_email_changed after update of email on auth.users for each row
  when (old.email is distinct from new.email) execute function public.handle_user_email_change();

-- ===================================================================== RPCs (PostgREST: supabase.rpc)

-- POST /api/invoices/import. Atômica: cria o import + lançamentos e troca a fatura do cartão pelo total.
-- Idempotente por (cartão, arquivo, total): se já existe, devolve o existente com duplicate = true.
-- p_items: [{ name, category, amount, date, method?: {type, cardId?} | methodType/method_type, cardId/card_id }]
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
           coalesce(nullif(item ->> 'category', ''), 'outros'),
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

-- POST /api/transactions/recategorize
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
  if not public.is_valid_category(v_uid, p_category) then
    raise exception 'Categoria inválida: %', p_category using errcode = '23503';
  end if;
  update public.transactions set category = p_category
   where user_id = v_uid and id = any (p_ids);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- PUT /api/cards/order  (último = frente = maior position)
create or replace function public.reorder_cards(p_order uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Não autenticado.' using errcode = '42501';
  end if;
  update public.cards c
     set position = o.ord
    from unnest(p_order) with ordinality as o(id, ord)
   where c.id = o.id and c.user_id = v_uid;
end;
$$;

-- PUT /api/me/balance: saldo informado hoje -> starting_balance = saldo + soma dos gastos
create or replace function public.set_balance(p_balance numeric)
returns numeric
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Não autenticado.' using errcode = '42501';
  end if;
  update public.profiles
     set starting_balance = p_balance + coalesce((select sum(t.amount) from public.transactions t where t.user_id = v_uid), 0)
   where id = v_uid;
  return p_balance;
end;
$$;

-- DELETE /api/me/data: apaga tudo da pessoa menos o profile (stage e hide_balance continuam).
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
  update public.profiles set featured_goal_id = null, budget_total = 0, starting_balance = 0 where id = v_uid;
  delete from public.goals           where user_id = v_uid; -- depósitos saem em cascata
  delete from public.cards           where user_id = v_uid;
  delete from public.budget_caps     where user_id = v_uid;
  delete from public.categories      where user_id = v_uid;
  perform set_config('okiva.skip_invoice_sync', v_prev, true);
end;
$$;

-- DELETE /api/me: exclui o próprio usuário em auth.users (profile e dados saem em cascata).
-- SECURITY DEFINER porque authenticated não tem acesso a auth.users; restrito a auth.uid().
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Não autenticado.' using errcode = '42501';
  end if;
  perform public.clear_my_data();
  delete from auth.users where id = v_uid;
end;
$$;
