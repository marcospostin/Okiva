-- =============================================================================
-- Okiva - etapa 10: endurecimento de segurança (auditoria de 24/11/2026)
-- =============================================================================
-- A1  remove o papel de administrador (todas as políticas *_admin_* e o role no app_metadata).
--     Um admin enxergava as finanças de todos só com senha; num portfólio não há uso para isso.
-- M4  limites de tamanho de texto/json, faixa de datas e teto de linhas por usuário (evita que
--     uma conta, inclusive anônima, encha o banco: nomes gigantes, recorrência desde o ano 1...).
-- M5  mensagens de suporte: só contas reais (não demo) e no máximo 5 por hora.
--     handle_new_user corta o nome em 60 caracteres.
--
-- Rollback: recriar as políticas admin (migration 20261122174638 e as das etapas 6, 8 e 9),
--   drop das constraints *_len/_size/_date_* e dos triggers enforce_row_cap / support_rate_limit.
-- =============================================================================

-- ---------------------------------------------------------------- A1: sem admin
do $$
declare
  r record;
begin
  for r in
    select pol.polname, n.nspname, c.relname
      from pg_policy pol
      join pg_class c on c.oid = pol.polrelid
      join pg_namespace n on n.oid = c.relnamespace
     where pol.polname in (
       'cards_admin_all', 'transactions_admin_all', 'goals_admin_all', 'goal_deposits_admin_all',
       'budget_caps_admin_all', 'categories_admin_all', 'invoice_imports_admin_all', 'profiles_admin_select',
       'profiles_admin_update', 'okiva_storage_admin_all', 'accounts_admin_all', 'recurrences_admin_all',
       'category_rules_admin_all', 'support_requests_admin_all')
  loop
    execute format('drop policy %I on %I.%I', r.polname, r.nspname, r.relname);
  end loop;
end $$;

-- is_admin() fica, mas sempre false (nada mais depende dela; evita reativar por engano)
create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select false
$$;

update auth.users set raw_app_meta_data = raw_app_meta_data - 'role' where raw_app_meta_data ? 'role';

-- support_requests: update/delete só existiam para o admin
revoke update, delete on public.support_requests from authenticated;

-- ---------------------------------------------------------------- M4: tamanhos e datas
alter table public.profiles
  add constraint profiles_name_len check (length(name) <= 60),
  add constraint profiles_prefs_size check (pg_column_size(notification_prefs) <= 1024);
alter table public.transactions
  add constraint transactions_name_len check (length(name) <= 120),
  add constraint transactions_date_range check (date between date '2000-01-01' and date '2100-12-31');
alter table public.cards       add constraint cards_nickname_len check (length(nickname) <= 30);
alter table public.goals       add constraint goals_name_len check (length(name) <= 60);
alter table public.categories  add constraint categories_label_len check (length(label) <= 40);
alter table public.invoice_imports add constraint invoice_imports_file_name_len check (length(file_name) <= 200);
alter table public.recurrences
  add constraint recurrences_name_len check (length(name) <= 120),
  add constraint recurrences_date_range check (start_date between date '2000-01-01' and date '2100-12-31');
alter table public.category_rules add constraint category_rules_pattern_len check (length(pattern) <= 200);
alter table public.goal_deposits  add constraint goal_deposits_date_range check (date between date '2000-01-01' and date '2100-12-31');
alter table public.support_requests add constraint support_requests_meta_size check (pg_column_size(meta) <= 4096);

-- ---------------------------------------------------------------- M4: teto de linhas por usuário
-- Uso: trigger before insert ... execute function public.enforce_row_cap('<limite>')
create or replace function public.enforce_row_cap()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_limit integer := tg_argv[0]::integer;
  v_count integer;
begin
  execute format('select count(*) from %I.%I where user_id = $1', tg_table_schema, tg_table_name)
     into v_count using new.user_id;
  if v_count >= v_limit then
    raise exception 'Limite de % itens atingido.', v_limit using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.enforce_row_cap() from public, anon;

create trigger enforce_row_cap before insert on public.transactions    for each row execute function public.enforce_row_cap('20000');
create trigger enforce_row_cap before insert on public.recurrences     for each row execute function public.enforce_row_cap('100');
create trigger enforce_row_cap before insert on public.cards           for each row execute function public.enforce_row_cap('30');
create trigger enforce_row_cap before insert on public.accounts        for each row execute function public.enforce_row_cap('30');
create trigger enforce_row_cap before insert on public.goals           for each row execute function public.enforce_row_cap('50');
create trigger enforce_row_cap before insert on public.goal_deposits   for each row execute function public.enforce_row_cap('5000');
create trigger enforce_row_cap before insert on public.categories      for each row execute function public.enforce_row_cap('100');
create trigger enforce_row_cap before insert on public.category_rules  for each row execute function public.enforce_row_cap('2000');
create trigger enforce_row_cap before insert on public.invoice_imports for each row execute function public.enforce_row_cap('500');
create trigger enforce_row_cap before insert on public.budget_caps     for each row execute function public.enforce_row_cap('100');

-- ---------------------------------------------------------------- M5: suporte
create or replace function public.support_rate_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_demo() then
    raise exception 'Crie uma conta para falar com o suporte.' using errcode = '42501';
  end if;
  if (select count(*) from public.support_requests
       where user_id = new.user_id and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Muitas mensagens seguidas. Tente de novo mais tarde.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.support_rate_limit() from public, anon;
create trigger support_rate_limit before insert on public.support_requests for each row execute function public.support_rate_limit();

-- ---------------------------------------------------------------- cadastro: nome com no máximo 60
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance numeric := 0;
  v_raw text := new.raw_user_meta_data ->> 'balance';
begin
  if v_raw ~ '^\d{1,10}(\.\d{1,2})?$' then
    v_balance := v_raw::numeric;
  end if;

  insert into public.profiles (id, email, name, starting_balance)
  values (
    new.id,
    coalesce(new.email, ''),
    left(coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Você'
    ), 60),
    v_balance
  )
  on conflict (id) do nothing;
  perform public.seed_default_categories(new.id);
  return new;
end;
$$;
