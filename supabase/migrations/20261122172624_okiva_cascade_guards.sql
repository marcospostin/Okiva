-- Okiva - etapa 5: correção encontrada nos testes
-- Problema: excluir o usuário direto em auth.users (dashboard, cleanup_demo.sql) apaga o profile e,
-- na cascata, os triggers de exclusão (cartão, categoria, fatura, depósito, gasto) tentavam atualizar
-- linhas de um profile que já não existe -> violação de FK (transactions_user_id_fkey).
-- Correção: quando o profile do dono não existe mais (conta sendo excluída), esses triggers não
-- fazem nada e a cascata segue normalmente.

create or replace function public.profile_exists(p_user uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.id = p_user)
$$;
revoke execute on function public.profile_exists(uuid) from public, anon;
grant execute on function public.profile_exists(uuid) to authenticated;

create or replace function public.handle_card_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_prev text := coalesce(current_setting('okiva.skip_invoice_sync', true), '');
begin
  if not public.profile_exists(old.user_id) then
    return old; -- conta sendo excluída: a cascata cuida de tudo
  end if;
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

create or replace function public.undo_invoice_import()
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
  delete from public.transactions where invoice_id = old.id and user_id = old.user_id;
  perform set_config('okiva.skip_invoice_sync', v_prev, true);
  if old.card_id is not null and old.previous_invoice is not null then
    update public.cards set invoice = old.previous_invoice
     where id = old.card_id and user_id = old.user_id;
  end if;
  return old;
end;
$$;

create or replace function public.handle_category_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.profile_exists(old.user_id) then
    return null;
  end if;
  update public.transactions set category = 'outros'
   where user_id = old.user_id and category = old.id::text;
  delete from public.budget_caps
   where user_id = old.user_id and category = old.id::text;
  return null;
end;
$$;

create or replace function public.sync_goal_deposit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_prev text := coalesce(current_setting('okiva.goal_sync', true), '');
begin
  if tg_op = 'DELETE' and not public.profile_exists(old.user_id) then
    return null;
  end if;
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
    if old.method_type = 'card' and public.profile_exists(old.user_id) then
      update public.cards set invoice = greatest(0, invoice - old.amount)
       where id = old.card_id and user_id = old.user_id;
    end if;
  end if;
  return null;
end;
$$;

create or replace function public.refeature_after_goal_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.profile_exists(old.user_id) then
    return null;
  end if;
  update public.profiles p
     set featured_goal_id = (select g.id from public.goals g where g.user_id = old.user_id order by g.created_at, g.id limit 1)
   where p.id = old.user_id and p.featured_goal_id is null;
  return null;
end;
$$;
