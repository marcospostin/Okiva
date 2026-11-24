-- =============================================================================
-- Okiva - etapa 7: categorias padrão viram sugestões editáveis (CRUD completo)
-- =============================================================================
-- Antes: 7 categorias fixas no código/banco (moradia, alimentacao, ...) + as criadas pela pessoa.
-- Agora: toda categoria é uma linha em public.categories. As 7 de antes são criadas para cada conta
-- como sugestão (coluna key = 'moradia' etc.) e podem ser renomeadas, recoloridas e excluídas.
--
--   Id usado em transactions.category / budget_caps.category / recurrences.category:
--     coalesce(categories.key, categories.id::text)
--   Assim os lançamentos antigos ('moradia', 'alimentacao', ...) continuam valendo sem reescrita.
--
--   'outros' continua aceito sempre (destino de segurança da leitura de fatura e de exclusões),
--   mesmo que a pessoa tenha excluído a categoria Outros.
--
-- Excluir categoria: delete_category(p_category, p_move_to) move lançamentos e recorrências para a
-- categoria escolhida (padrão 'outros') e remove o teto da excluída.
--
-- Rollback: drop function public.delete_category(text, text), public.seed_default_categories(uuid),
--   public.categories_set_position() cascade; alter table public.categories drop column key, drop column position;
--   recriar o trigger check_category_label e as versões anteriores de is_valid_category,
--   handle_category_delete, handle_new_user, clear_my_data e check_category.
-- =============================================================================

alter table public.categories
  add column key      text check (key is null or key ~ '^[a-z_]{2,30}$'),
  add column position integer not null default 0;

comment on column public.categories.key is 'Categoria sugerida pelo app (moradia, alimentacao, ...). O id usado nos lançamentos é coalesce(key, id::text).';
create unique index categories_user_key_key on public.categories (user_id, key) where key is not null;
create index categories_user_position_idx on public.categories (user_id, position);

-- Nome das sugestões não é mais reservado: a unicidade por nome (categories_user_label_key) basta
drop trigger if exists check_category_label on public.categories;

create or replace function public.categories_set_position()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.position is null or new.position = 0 then
    select coalesce(max(c.position), 0) + 1 into new.position from public.categories c where c.user_id = new.user_id;
  end if;
  return new;
end;
$$;
create trigger categories_set_position before insert on public.categories for each row execute function public.categories_set_position();

-- Categoria válida: existe para a pessoa (por key ou id) ou é 'outros'
create or replace function public.is_valid_category(p_user uuid, p_category text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_category = 'outros'
      or exists (select 1 from public.categories c where c.user_id = p_user and coalesce(c.key, c.id::text) = p_category)
$$;

-- Leitura de fatura: categoria que não existe mais vira 'outros' em vez de recusar a importação
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
    if (to_jsonb(new) ->> 'source') = 'fatura' then
      new.category := 'outros';
    else
      raise exception 'Categoria inválida: %', new.category
        using errcode = '23503', hint = 'Use uma categoria sua.';
    end if;
  end if;
  return new;
end;
$$;

-- Sugestões do app (mesma lista de SUGGESTED_CATEGORIES em src/data/categories.ts)
create or replace function public.seed_default_categories(p_user uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  insert into public.categories (user_id, key, label, color, position)
  select p_user, s.key, s.label, s.color, s.pos
    from (values
      ('moradia', 'Moradia', '#d8ccfa', 1),
      ('alimentacao', 'Alimentação', '#e5ffb5', 2),
      ('transporte', 'Transporte', '#f1f1ee', 3),
      ('lazer', 'Lazer', '#bfa9fe', 4),
      ('assinaturas', 'Assinaturas', '#c9c3dc', 5),
      ('saude', 'Saúde', '#d6e6c4', 6),
      ('outros', 'Outros', '#8f8f96', 7)
    ) as s(key, label, color, pos)
   where not exists (select 1 from public.categories c where c.user_id = p_user and c.key = s.key)
     and not exists (select 1 from public.categories c where c.user_id = p_user and public.normalize_label(c.label) = public.normalize_label(s.label));
end;
$$;

-- Excluir categoria move lançamentos/recorrências para okiva.category_move_to (ou 'outros') e remove o teto
create or replace function public.handle_category_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_id text := coalesce(old.key, old.id::text);
  v_to text := coalesce(nullif(current_setting('okiva.category_move_to', true), ''), 'outros');
begin
  if not public.profile_exists(old.user_id) then
    return null;
  end if;
  if v_to = v_id or not public.is_valid_category(old.user_id, v_to) then
    v_to := 'outros';
  end if;
  update public.transactions set category = v_to where user_id = old.user_id and category = v_id and kind = 'expense';
  update public.recurrences  set category = v_to where user_id = old.user_id and category = v_id and kind = 'expense';
  delete from public.budget_caps where user_id = old.user_id and category = v_id;
  return null;
end;
$$;

-- DELETE /api/categories/:id?moveTo=...
create or replace function public.delete_category(p_category text, p_move_to text default 'outros')
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_to text := coalesce(nullif(p_move_to, ''), 'outros');
begin
  if v_uid is null then
    raise exception 'Não autenticado.' using errcode = '42501';
  end if;
  if v_to = p_category then
    raise exception 'Escolha outra categoria para os lançamentos.' using errcode = '22023';
  end if;
  if not public.is_valid_category(v_uid, v_to) then
    raise exception 'Categoria de destino inválida: %', v_to using errcode = '23503';
  end if;
  perform set_config('okiva.category_move_to', v_to, true);
  delete from public.categories where user_id = v_uid and coalesce(key, id::text) = p_category;
  perform set_config('okiva.category_move_to', '', true);
end;
$$;

-- Cadastro: profile + conta (process_due cuida) + categorias sugeridas
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
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Você'
    ),
    v_balance
  )
  on conflict (id) do nothing;
  perform public.seed_default_categories(new.id);
  return new;
end;
$$;

-- "Começar do zero" volta com as categorias sugeridas
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
  perform public.seed_default_categories(v_uid);
  perform set_config('okiva.skip_invoice_sync', v_prev, true);
end;
$$;

revoke execute on function public.seed_default_categories(uuid) from public, anon;
revoke execute on function public.delete_category(text, text) from public, anon;
revoke execute on function public.categories_set_position() from public, anon;
grant execute on function public.seed_default_categories(uuid) to authenticated;
grant execute on function public.delete_category(text, text) to authenticated;

-- Dados existentes: categorias criadas antes vêm depois das sugestões; cada conta ganha as sugestões
update public.categories c set position = 100 + r.n
  from (select id, row_number() over (partition by user_id order by created_at) as n from public.categories) r
 where r.id = c.id;

do $$
declare
  p record;
begin
  for p in select id from public.profiles loop
    perform public.seed_default_categories(p.id);
  end loop;
end $$;
