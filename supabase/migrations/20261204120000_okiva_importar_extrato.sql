-- =============================================================================
-- Okiva - importar extrato de conta (além da fatura do cartão)
-- =============================================================================
-- A tela "Importar lançamentos" agora aceita dois destinos:
--   - cartão (como antes): compras no cartão, parcelas em andamento, fatura = total lido
--   - conta (novo): entradas viram receitas, saídas viram gastos via Pix daquela conta e o
--     pagamento de fatura que aparece no extrato vira pagamento de fatura do cartão escolhido
--     (abate a fatura e não conta como gasto duas vezes)
-- Desfazer a importação devolve ao cartão os pagamentos de fatura que vieram do extrato.
-- =============================================================================

alter table public.invoice_imports
  add column if not exists account_id uuid;

alter table public.invoice_imports
  drop constraint if exists invoice_imports_account_fkey;
alter table public.invoice_imports
  add constraint invoice_imports_account_fkey foreign key (account_id) references public.accounts(id) on delete set null;

alter table public.invoice_imports
  drop constraint if exists invoice_imports_one_target;
alter table public.invoice_imports
  add constraint invoice_imports_one_target check (card_id is null or account_id is null);

create index if not exists invoice_imports_account_idx on public.invoice_imports (account_id);

drop function if exists public.import_invoice(uuid, text, numeric, jsonb, jsonb);

create or replace function public.import_invoice(
  p_card_id uuid,
  p_file_name text,
  p_total numeric,
  p_items jsonb,
  p_ongoing jsonb default null,
  p_account_id uuid default null
)
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
  item jsonb;
  v_kind public.tx_kind;
  v_method public.payment_method;
  v_item_card uuid;
  v_category text;
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
  if p_card_id is not null and p_account_id is not null then
    raise exception 'Escolha um cartão ou uma conta, não os dois.' using errcode = 'P0001';
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
  if p_account_id is not null and not exists (select 1 from public.accounts where id = p_account_id and user_id = v_uid) then
    raise exception 'Conta não encontrada.' using errcode = 'P0002';
  end if;

  select * into v_inv from public.invoice_imports
   where user_id = v_uid
     and card_id is not distinct from p_card_id
     and account_id is not distinct from p_account_id
     and file_name = p_file_name and total = p_total
   limit 1;

  if found then
    v_duplicate := true;
  else
    insert into public.invoice_imports (user_id, card_id, account_id, file_name, total, previous_invoice)
    values (v_uid, p_card_id, p_account_id, p_file_name, p_total, v_card.invoice)
    returning * into v_inv;

    for item in select * from jsonb_array_elements(p_items) loop
      v_kind := coalesce(nullif(item ->> 'kind', ''), 'expense')::public.tx_kind;
      if v_kind not in ('expense', 'income', 'invoice_payment') then
        raise exception 'Tipo de lançamento inválido na importação.' using errcode = '22023';
      end if;
      if v_kind <> 'expense' and p_account_id is null then
        raise exception 'Receitas e pagamentos de fatura só entram em importação de conta.' using errcode = 'P0001';
      end if;

      v_item_card := null;
      if v_kind = 'invoice_payment' then
        v_item_card := nullif(coalesce(item ->> 'cardId', item ->> 'card_id'), '')::uuid;
        if v_item_card is null or not exists (select 1 from public.cards where id = v_item_card and user_id = v_uid) then
          raise exception 'Escolha o cartão do pagamento de fatura.' using errcode = 'P0001';
        end if;
        v_method := 'card';
      elsif p_account_id is not null then
        v_method := 'pix';
      else
        v_method := coalesce(item ->> 'methodType', item ->> 'method_type', item -> 'method' ->> 'type',
                             case when p_card_id is null then 'cash' else 'card' end)::public.payment_method;
        if v_method = 'card' then
          v_item_card := coalesce(item ->> 'cardId', item ->> 'card_id', item -> 'method' ->> 'cardId', p_card_id::text)::uuid;
        end if;
      end if;

      v_category := case
        when v_kind = 'invoice_payment' then 'outros'
        when v_kind = 'income' then coalesce(nullif(item ->> 'category', ''), 'receita_outros')
        else coalesce(
          nullif(item ->> 'category', ''),
          (select r.category from public.category_rules r
            where r.user_id = v_uid and r.pattern = public.normalize_label(item ->> 'name') limit 1))
      end;

      insert into public.transactions (user_id, kind, name, category, method_type, card_id, account_id, date, amount, source, invoice_id)
      values (
        v_uid, v_kind, item ->> 'name', v_category, v_method, v_item_card, p_account_id,
        coalesce((item ->> 'date')::date, current_date), (item ->> 'amount')::numeric, 'fatura', v_inv.id
      );
      -- sync_card_invoice não mexe em lançamentos de importação no INSERT: o pagamento abate aqui
      if v_kind = 'invoice_payment' then
        update public.cards set invoice = invoice - (item ->> 'amount')::numeric where id = v_item_card and user_id = v_uid;
      end if;
    end loop;

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
    'cards', coalesce((select jsonb_agg(to_jsonb(c)) from public.cards c
                        where c.user_id = v_uid and c.id in (select t.card_id from public.transactions t
                                                              where t.invoice_id = v_inv.id and t.kind = 'invoice_payment')), '[]'::jsonb),
    'duplicate', v_duplicate
  );
end;
$$;

revoke all on function public.import_invoice(uuid, text, numeric, jsonb, jsonb, uuid) from public, anon;
grant execute on function public.import_invoice(uuid, text, numeric, jsonb, jsonb, uuid) to authenticated;

-- Desfazer: além de voltar a fatura do cartão importado, devolve aos cartões os pagamentos
-- de fatura que vieram de um extrato (a sincronização fica desligada durante o delete).
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
  update public.cards c set invoice = c.invoice + p.paid
    from (select t.card_id, sum(t.amount) as paid from public.transactions t
           where t.invoice_id = old.id and t.user_id = old.user_id and t.kind = 'invoice_payment' and t.card_id is not null
           group by t.card_id) p
   where c.id = p.card_id and c.user_id = old.user_id;
  perform set_config('okiva.skip_invoice_sync', 'on', true);
  delete from public.transactions where invoice_id = old.id and user_id = old.user_id;
  perform set_config('okiva.skip_invoice_sync', v_prev, true);
  -- A importação trocou a fatura de previous_invoice para total: desfaz só essa diferença
  if old.card_id is not null and old.previous_invoice is not null then
    update public.cards set invoice = invoice - (old.total - old.previous_invoice)
     where id = old.card_id and user_id = old.user_id;
  end if;
  return old;
end;
$$;
