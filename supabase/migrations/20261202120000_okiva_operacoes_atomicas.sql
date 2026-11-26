-- Okiva · etapa 17: operações em várias etapas viram uma transação só ("tudo ou nada").
--
-- 1. replace_tx_with_installments: gasto à vista → compra parcelada (apaga o lançamento e cria as
--    parcelas juntos). Antes eram duas chamadas: se a segunda falhasse, a compra sumia.
-- 2. replace_installments_with_tx: compra parcelada → à vista (apaga as parcelas e cria o lançamento).
-- 3. import_invoice ganha p_ongoing: as compras parceladas lidas na fatura são criadas na mesma
--    transação da importação. Antes eram chamadas separadas: se uma falhasse, a fatura ficava
--    importada pela metade e a nova tentativa batia em "essa fatura já foi importada".

-- ---------------------------------------------------------------- à vista → parcelado
create or replace function public.replace_tx_with_installments(
  p_tx uuid, p_name text, p_category text, p_card_id uuid, p_total numeric, p_count integer, p_first_date date
)
returns uuid
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
  delete from public.transactions
   where id = p_tx and user_id = v_uid and installment_group is null and kind = 'expense';
  if not found then
    raise exception 'Lançamento não encontrado.' using errcode = 'P0002';
  end if;
  return public.save_installments(null, p_name, p_category, p_card_id, p_total, p_count, p_first_date);
end;
$$;
revoke all on function public.replace_tx_with_installments(uuid, text, text, uuid, numeric, integer, date) from public, anon;
grant execute on function public.replace_tx_with_installments(uuid, text, text, uuid, numeric, integer, date) to authenticated;

-- ---------------------------------------------------------------- parcelado → à vista
create or replace function public.replace_installments_with_tx(
  p_group uuid,
  p_name text,
  p_category text,
  p_method_type public.payment_method,
  p_card_id uuid,
  p_account_id uuid,
  p_date date,
  p_amount numeric,
  p_source public.tx_source default 'manual',
  p_invoice_id uuid default null
)
returns public.transactions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.transactions;
begin
  if v_uid is null then
    raise exception 'Não autenticado.' using errcode = '42501';
  end if;
  delete from public.transactions where user_id = v_uid and installment_group = p_group;
  if not found then
    raise exception 'Compra parcelada não encontrada.' using errcode = 'P0002';
  end if;
  insert into public.transactions (user_id, kind, name, category, method_type, card_id, account_id, date, amount, source, invoice_id)
  values (v_uid, 'expense', btrim(p_name), nullif(p_category, ''), p_method_type,
          case when p_method_type = 'card' then p_card_id end,
          case when p_method_type = 'card' then null else p_account_id end,
          p_date, p_amount, p_source, p_invoice_id)
  returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.replace_installments_with_tx(uuid, text, text, public.payment_method, uuid, uuid, date, numeric, public.tx_source, uuid) from public, anon;
grant execute on function public.replace_installments_with_tx(uuid, text, text, public.payment_method, uuid, uuid, date, numeric, public.tx_source, uuid) to authenticated;

-- ---------------------------------------------------------------- importação com parcelas em andamento
drop function if exists public.import_invoice(uuid, text, numeric, jsonb);
create or replace function public.import_invoice(p_card_id uuid, p_file_name text, p_total numeric, p_items jsonb, p_ongoing jsonb default null)
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
  o jsonb;
begin
  if v_uid is null then
    raise exception 'Não autenticado.' using errcode = '42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'p_items deve ser um array JSON.' using errcode = '22023';
  end if;
  if p_ongoing is not null and jsonb_typeof(p_ongoing) <> 'array' then
    raise exception 'p_ongoing deve ser um array JSON.' using errcode = '22023';
  end if;
  if p_ongoing is not null and jsonb_array_length(p_ongoing) > 0 and p_card_id is null then
    raise exception 'Compra parcelada da fatura precisa de um cartão.' using errcode = 'P0001';
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

    -- Parcelas em andamento: a parcela desta fatura (já no total lido) e as próximas, uma por mês
    for o in select * from jsonb_array_elements(coalesce(p_ongoing, '[]'::jsonb)) loop
      perform public.save_ongoing_installments(
        o ->> 'name',
        coalesce(nullif(o ->> 'category', ''),
                 (select r.category from public.category_rules r
                   where r.user_id = v_uid and r.pattern = public.normalize_label(o ->> 'name') limit 1), ''),
        p_card_id,
        (o ->> 'amount')::numeric,
        (o ->> 'current')::integer,
        (o ->> 'total')::integer,
        coalesce((o ->> 'date')::date, current_date),
        v_inv.id,
        true
      );
    end loop;

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
revoke all on function public.import_invoice(uuid, text, numeric, jsonb, jsonb) from public, anon;
grant execute on function public.import_invoice(uuid, text, numeric, jsonb, jsonb) to authenticated;
