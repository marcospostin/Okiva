-- Okiva · etapa 16: crédito na fatura e adiantar parcelas.
--
-- 1. Fatura guarda o valor real. Pagar mais que a fatura deixa crédito (fatura negativa), que as
--    próximas compras consomem; desfazer ou editar um pagamento volta ao valor certo (antes o
--    greatest(0, …) cortava o excedente e ele não voltava).
-- 2. Desfazer importação de fatura tira só o que a importação mudou (total − fatura de antes), sem
--    apagar o que entrou na fatura depois dela.
-- 3. anticipate_installments: traz as últimas parcelas futuras de uma compra no cartão para a fatura
--    atual (data de hoje), com desconto opcional dividido entre elas. Tudo numa transação.

-- ---------------------------------------------------------------- fatura com crédito
alter table public.cards drop constraint if exists cards_invoice_check;
alter table public.cards
  add constraint cards_invoice_range check (invoice between -10000000 and 10000000);
comment on column public.cards.invoice is 'Fatura atual. Negativa = crédito (pagou a mais), vira desconto na próxima fatura.';

-- ---------------------------------------------------------------- fatura inicial
create or replace function public.cards_opening_invoice()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- Clientes antigos mandam só "invoice"; os novos, "opening_invoice"
    if new.opening_invoice = 0 and new.invoice > 0 then
      new.opening_invoice := new.invoice;
    else
      new.invoice := new.opening_invoice;
    end if;
    new.started_on := coalesce(new.started_on, current_date);
  elsif new.opening_invoice is distinct from old.opening_invoice then
    new.invoice := old.invoice + new.opening_invoice - old.opening_invoice;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------- fatura acompanha lançamentos (sem cortar em zero)
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
  if tg_op in ('UPDATE', 'DELETE') and not old.already_in_invoice then
    v_old := public.card_effect(old.kind, old.method_type, old.posted, old.amount);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and not new.already_in_invoice then
    v_new := public.card_effect(new.kind, new.method_type, new.posted, new.amount);
  end if;

  if tg_op = 'INSERT' then
    if new.invoice_id is null and v_new <> 0 then
      update public.cards set invoice = invoice + v_new where id = new.card_id and user_id = new.user_id;
    end if;
  elsif tg_op = 'UPDATE' then
    if new.card_id is not distinct from old.card_id and v_new = v_old then
      return null;
    end if;
    if old.card_id is not null and old.card_id = new.card_id then
      update public.cards set invoice = invoice + v_new - v_old where id = new.card_id and user_id = new.user_id;
    else
      if v_old <> 0 then
        update public.cards set invoice = invoice - v_old where id = old.card_id and user_id = old.user_id;
      end if;
      if v_new <> 0 then
        update public.cards set invoice = invoice + v_new where id = new.card_id and user_id = new.user_id;
      end if;
    end if;
  elsif tg_op = 'DELETE' then
    if v_old <> 0 and public.profile_exists(old.user_id) then
      update public.cards set invoice = invoice - v_old where id = old.card_id and user_id = old.user_id;
    end if;
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------- desfazer importação
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
  -- A importação trocou a fatura de previous_invoice para total: desfaz só essa diferença
  if old.card_id is not null and old.previous_invoice is not null then
    update public.cards set invoice = invoice - (old.total - old.previous_invoice)
     where id = old.card_id and user_id = old.user_id;
  end if;
  return old;
end;
$$;

-- ---------------------------------------------------------------- adiantar parcelas
create or replace function public.anticipate_installments(
  p_group uuid,
  p_count integer,
  p_discount numeric default 0,
  p_date date default null
)
returns setof public.transactions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_date date := coalesce(p_date, current_date);
  v_ids uuid[];
  v_total numeric;
  v_left_cents bigint;
  v_n integer;
  v_i integer := 0;
  r record;
  v_share bigint;
begin
  if v_uid is null then
    raise exception 'Não autenticado.' using errcode = '42501';
  end if;
  -- Data de hoje do aparelho (o servidor está em UTC, pode estar um dia à frente)
  if v_date > current_date or v_date < current_date - 2 then
    raise exception 'Data inválida para adiantar.' using errcode = 'P0001';
  end if;
  if p_count is null or p_count < 1 then
    raise exception 'Escolha quantas parcelas adiantar.' using errcode = 'P0001';
  end if;
  if p_discount is null or p_discount < 0 then
    raise exception 'O desconto não pode ser negativo.' using errcode = 'P0001';
  end if;

  -- As últimas parcelas que ainda não entraram na fatura (como os bancos fazem)
  select array_agg(id order by installment_number desc), sum(amount), count(*)
    into v_ids, v_total, v_n
    from (
      select t.id, t.amount, t.installment_number
        from public.transactions t
       where t.user_id = v_uid and t.installment_group = p_group
         and t.kind = 'expense' and t.method_type = 'card' and not t.posted and t.date > v_date
       order by t.installment_number desc
       limit p_count
       for update
    ) s;

  if v_n is null or v_n = 0 then
    raise exception 'Esta compra não tem parcelas futuras no cartão.' using errcode = 'P0001';
  end if;
  if v_n < p_count then
    raise exception 'Só faltam % parcelas desta compra.', v_n using errcode = 'P0001';
  end if;
  if p_discount >= v_total then
    raise exception 'O desconto precisa ser menor que o valor das parcelas.' using errcode = 'P0001';
  end if;

  -- Desconto dividido proporcionalmente, em centavos; o que sobra vai na última atualizada
  v_left_cents := round(p_discount * 100);
  for r in select t.id, t.amount from public.transactions t where t.id = any(v_ids) order by t.installment_number desc loop
    v_i := v_i + 1;
    if v_i = v_n then
      v_share := v_left_cents;
    else
      v_share := floor(round(p_discount * 100) * r.amount / v_total);
      v_left_cents := v_left_cents - v_share;
    end if;
    update public.transactions
       set date = v_date, amount = amount - v_share / 100.0
     where id = r.id and user_id = v_uid;
  end loop;

  return query
    select t.* from public.transactions t where t.id = any(v_ids) order by t.installment_number;
end;
$$;
revoke all on function public.anticipate_installments(uuid, integer, numeric, date) from public, anon;
grant execute on function public.anticipate_installments(uuid, integer, numeric, date) to authenticated;
