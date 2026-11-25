-- =============================================================================
-- Okiva - etapa 13: fatura inicial do cartão e compras parceladas em andamento
-- =============================================================================
-- cards.opening_invoice      "Fatura quando você começou": o que já estava na fatura no dia em
--                            que o cartão foi cadastrado. A fatura (cards.invoice) continua sendo
--                            mantida pelos triggers = opening_invoice + gastos lançados − pagamentos.
--                            Editar opening_invoice desloca invoice pela diferença: os lançamentos
--                            nunca se perdem (antes, editar "Fatura atual" sobrescrevia tudo).
-- cards.started_on           Dia em que o cartão entrou no Okiva.
-- transactions.already_in_invoice
--                            A parcela já está dentro do valor da fatura informado (na criação do
--                            cartão) ou lido (importação). Não soma de novo na fatura.
-- save_ongoing_installments  Compra parcelada que começou antes do Okiva ("parcela 4 de 10"):
--                            cria da parcela atual em diante. A atual fica already_in_invoice quando
--                            cai no mês em que o cartão foi cadastrado (ou antes), ou quando vem de
--                            uma fatura importada. As anteriores não são criadas (já foram pagas).
--
-- Rollback: drop function public.save_ongoing_installments(text, text, uuid, numeric, integer, integer, date, uuid, boolean);
--   drop trigger cards_opening_invoice on public.cards; drop function public.cards_opening_invoice();
--   alter table public.transactions drop column already_in_invoice;
--   alter table public.cards drop column opening_invoice, drop column started_on;
--   reaplicar sync_card_invoice da etapa 6 (20261123120000).
-- =============================================================================

alter table public.cards
  add column opening_invoice numeric(12, 2) not null default 0 check (opening_invoice >= 0 and opening_invoice <= 10000000),
  add column started_on date not null default current_date;
comment on column public.cards.opening_invoice is 'Fatura no dia em que o cartão foi cadastrado (antes dos lançamentos do app).';
comment on column public.cards.started_on is 'Dia em que o cartão entrou no Okiva.';

alter table public.transactions
  add column already_in_invoice boolean not null default false;
comment on column public.transactions.already_in_invoice is 'Parcela que já está no valor da fatura informado/importado: não soma na fatura.';

-- Cartões que já existiam: data de cadastro e fatura inicial = fatura − efeito dos lançamentos do app
update public.cards set started_on = created_at::date;
update public.cards c
   set opening_invoice = greatest(0, c.invoice - coalesce((
         select sum(public.card_effect(t.kind, t.method_type, t.posted, t.amount))
           from public.transactions t
          where t.card_id = c.id and t.invoice_id is null), 0));

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
    new.invoice := greatest(0, old.invoice + new.opening_invoice - old.opening_invoice);
  end if;
  return new;
end;
$$;
revoke execute on function public.cards_opening_invoice() from public, anon;
create trigger cards_opening_invoice before insert or update on public.cards
  for each row execute function public.cards_opening_invoice();

-- ---------------------------------------------------------------- fatura: ignora o que já estava nela
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

-- ---------------------------------------------------------------- compra parcelada em andamento
create or replace function public.save_ongoing_installments(
  p_name text,
  p_category text,
  p_card_id uuid,
  p_amount numeric,
  p_current integer,
  p_total integer,
  p_date date default null,
  p_invoice_id uuid default null,
  p_current_in_invoice boolean default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_group uuid := gen_random_uuid();
  v_date date := coalesce(p_date, current_date);
  v_started date;
  v_in_invoice boolean;
  i integer;
begin
  if v_uid is null then
    raise exception 'Não autenticado.' using errcode = '42501';
  end if;
  if p_total is null or p_total < 2 or p_total > 48 then
    raise exception 'Parcelas entre 2 e 48.' using errcode = '23514';
  end if;
  if p_current is null or p_current < 1 or p_current > p_total then
    raise exception 'A parcela atual precisa estar entre 1 e %.', p_total using errcode = '23514';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 1000000 then
    raise exception 'Valor da parcela inválido.' using errcode = '23514';
  end if;
  if v_date > current_date then
    raise exception 'A data da parcela atual não pode ser no futuro.' using errcode = '23514';
  end if;
  select c.started_on into v_started from public.cards c where c.id = p_card_id and c.user_id = v_uid;
  if not found then
    raise exception 'Cartão não encontrado.' using errcode = 'P0002';
  end if;
  if p_invoice_id is not null and not exists (select 1 from public.invoice_imports f where f.id = p_invoice_id and f.user_id = v_uid) then
    raise exception 'Fatura não encontrada.' using errcode = 'P0002';
  end if;

  v_in_invoice := coalesce(p_current_in_invoice, date_trunc('month', v_date) <= date_trunc('month', v_started));

  for i in p_current..p_total loop
    insert into public.transactions (user_id, name, category, method_type, card_id, date, amount, source, kind,
                                     installment_group, installment_number, installment_total, invoice_id, already_in_invoice)
    values (v_uid, btrim(p_name), nullif(p_category, ''), 'card', p_card_id,
            (v_date + make_interval(months => i - p_current))::date,
            round(p_amount, 2),
            case when p_invoice_id is null then 'manual' else 'fatura' end::public.tx_source,
            'expense', v_group, i, p_total, p_invoice_id,
            i = p_current and v_in_invoice);
  end loop;
  return v_group;
end;
$$;
revoke execute on function public.save_ongoing_installments(text, text, uuid, numeric, integer, integer, date, uuid, boolean) from public, anon;
grant execute on function public.save_ongoing_installments(text, text, uuid, numeric, integer, integer, date, uuid, boolean) to authenticated;
