-- =============================================================================
-- Okiva - etapa 15b: conta de demonstração completa e realista
-- =============================================================================
-- Lucas: renda de R$ 7.000, teto de R$ 7.000, gasta ~R$ 4.800/mês e guarda o resto.
-- Mostra tudo o que o app faz, já preenchido:
--   contas e subcontas    Nubank "Principal" (+ "Reserva de emergência", "Caixinha viagem" e "Caixinha imóvel")
--                         e Porto Bank "Dia a dia" (gastos pequenos no débito/Pix, com nomes de extrato)
--   cartões               Nubank, Inter e XP; faturas pagas todo mês; fatura do mês aberta
--   recorrências          salário, aluguel R$ 1.700, plano de saúde, internet, academia, streaming
--   compras parceladas    Notebook 10× e passagem aérea 6× (parcelas futuras já lançadas)
--   mover dinheiro        R$ 500/mês para a reserva, R$ 300/mês para a viagem e R$ 1.500/mês para o imóvel
--   rendimento            todo mês na reserva
--   sem categoria         3 gastos para mostrar "Classificar"
--   fatura lida pela IA   fatura de outubro do Inter
--   conferência           reserva e conta conferidas com o banco
--   metas                 "Imóvel próprio" (R$ 200 mil, R$ 1.500/mês), viagem e Playstation 5
-- 4 meses de histórico (relatórios "Mês a mês"). Valores variam um pouco por mês.
-- =============================================================================

create or replace function public.seed_demo_account()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_month date := date_trunc('month', current_date)::date;
  v_today date := current_date;
  v_start date := (date_trunc('month', current_date) - interval '3 months')::date;
  v_acc uuid; v_reserva uuid; v_viagem uuid; v_casa uuid; v_porto uuid;
  v_nu uuid; v_inter uuid; v_xp uuid;
  v_imovel uuid; v_portugal uuid; v_ingles uuid;
  v_rec uuid; v_inv uuid; v_group uuid;
  v_last date; v_due date; v_total numeric;
  r record; c record;
  k int; i int; d date; v_amt numeric;
begin
  if v_uid is null then
    raise exception 'Não autenticado.' using errcode = '42501';
  end if;
  if not public.is_demo() then
    raise exception 'Disponível só para contas de demonstração.' using errcode = '42501';
  end if;
  if exists (select 1 from public.cards where user_id = v_uid)
     or exists (select 1 from public.transactions where user_id = v_uid)
     or exists (select 1 from public.goals where user_id = v_uid)
     or exists (select 1 from public.accounts where user_id = v_uid) then
    return;
  end if;
  perform public.seed_default_categories(v_uid);

  -- ------------------------------------------------------------ contas e subcontas
  insert into public.accounts (user_id, name, nickname, kind, starting_balance) values (v_uid, 'Nubank', 'Principal', 'checking', 1500) returning id into v_acc;
  insert into public.accounts (user_id, name, kind, starting_balance, parent_id) values (v_uid, 'Reserva de emergência', 'savings', 0, v_acc) returning id into v_reserva;
  insert into public.accounts (user_id, name, kind, starting_balance, parent_id) values (v_uid, 'Caixinha viagem', 'savings', 0, v_acc) returning id into v_viagem;
  insert into public.accounts (user_id, name, kind, starting_balance, parent_id) values (v_uid, 'Caixinha imóvel', 'savings', 0, v_acc) returning id into v_casa;
  -- Conta do dia a dia: só débito/Pix, abastecida pela principal todo mês
  insert into public.accounts (user_id, name, nickname, kind, starting_balance) values (v_uid, 'Porto Bank', 'Dia a dia', 'checking', 0) returning id into v_porto;

  -- ------------------------------------------------------------ cartões (no Okiva há 4 meses)
  insert into public.cards (user_id, bank, nickname, last4, color, opening_invoice, "limit", due_day, position, started_on)
  values (v_uid, 'XP', 'Viagens', '1180', 'offwhite', 0, 12000, 5, 1, v_start) returning id into v_xp;
  insert into public.cards (user_id, bank, nickname, last4, color, opening_invoice, "limit", due_day, position, started_on)
  values (v_uid, 'Inter', 'Inter', '6917', 'lilac', 0, 5000, 15, 2, v_start) returning id into v_inter;
  insert into public.cards (user_id, bank, nickname, last4, color, opening_invoice, "limit", due_day, position, started_on)
  values (v_uid, 'Nubank', 'Nubank', '4552', 'gradient', 0, 8000, 10, 3, v_start) returning id into v_nu;

  -- As faturas são recalculadas no fim, de uma vez
  perform set_config('okiva.skip_invoice_sync', 'on', true);

  -- ------------------------------------------------------------ gastos do dia a dia
  for k in 0..3 loop
    for r in
      select * from (values
        ('Mercado', 'alimentacao', 'nu', 3, 212.40), ('Mercado', 'alimentacao', 'nu', 11, 186.90),
        ('Mercado', 'alimentacao', 'nu', 19, 238.70), ('Mercado', 'alimentacao', 'nu', 26, 164.30),
        ('PadariaJoel345', 'alimentacao', 'porto', 7, 38.50), ('FeiraDoSeuZe', 'alimentacao', 'porto', 14, 56.00),
        ('PastelariaKiko', 'alimentacao', 'porto', 21, 24.00), ('BarbeariaDoTony', 'outros', 'porto', 25, 50.00),
        ('RestBomSabor', 'alimentacao', 'porto', 9, 38.90), ('CafeteriaGrao12', 'alimentacao', 'porto', 16, 14.50),
        ('MercadinhoSaoJorge', 'alimentacao', 'porto', 22, 47.80), ('DrogariaVila0231', 'saude', 'porto', 27, 29.90),
        ('iFood', 'alimentacao', 'inter', 6, 62.90), ('iFood', 'alimentacao', 'inter', 14, 48.50),
        ('iFood', 'alimentacao', 'inter', 23, 74.80), ('Restaurante', 'alimentacao', 'nu', 17, 146.00),
        ('Uber', 'transporte', 'inter', 4, 27.90), ('Uber', 'transporte', 'inter', 12, 34.60),
        ('Uber', 'transporte', 'inter', 20, 22.40), ('Uber', 'transporte', 'inter', 27, 31.20),
        ('SPTrans*BilheteUnico', 'transporte', 'porto', 2, 120.00),
        ('Conta de luz', 'moradia', 'pix', 15, 142.30), ('Conta de água', 'moradia', 'pix', 18, 58.40),
        ('Farmácia', 'saude', 'nu', 9, 64.70),
        ('Cinema', 'lazer', 'xp', 13, 58.00), ('Bar com amigos', 'lazer', 'xp', 24, 96.50)
      ) as v(name, cat, pay, day, base)
    loop
      d := (v_month - make_interval(months => k))::date + (r.day - 1);
      continue when d > v_today;
      v_amt := round(r.base * (1 + (((k * 7 + r.day * 3) % 9) - 4) / 40.0), 2);
      insert into public.transactions (user_id, name, category, method_type, card_id, account_id, date, amount, source, kind)
      values (v_uid, r.name, r.cat,
              (case when r.pay in ('nu', 'inter', 'xp') then 'card' else 'pix' end)::public.payment_method,
              case r.pay when 'nu' then v_nu when 'inter' then v_inter when 'xp' then v_xp end,
              case when r.pay = 'pix' then v_acc when r.pay = 'porto' then v_porto end,
              d, v_amt, 'manual', 'expense');
    end loop;
  end loop;

  -- Avulsos
  insert into public.transactions (user_id, name, category, method_type, card_id, account_id, date, amount, source, kind) values
    (v_uid, 'Roupas', 'outros', 'card', v_xp, null, (v_month - interval '2 months')::date + 7, 289.90, 'manual', 'expense'),
    (v_uid, 'Presente de aniversário', 'outros', 'card', v_nu, null, (v_month - interval '1 month')::date + 15, 180.00, 'manual', 'expense'),
    (v_uid, 'Freela de design', 'receita_extra', 'pix', null, v_acc, (v_month - interval '1 month')::date + 21, 1200.00, 'manual', 'income');
  -- Um gasto que o Okiva não reconheceu: mostra o "Classificar"
  insert into public.transactions (user_id, name, category, method_type, card_id, date, amount, source, kind)
  values (v_uid, 'PAG*JOSEDASILVA', null, 'card', v_nu, greatest(v_month, v_today - 2), 35.00, 'manual', 'expense');
  insert into public.transactions (user_id, name, category, method_type, card_id, account_id, date, amount, source, kind) values
    (v_uid, 'PIX QRS 4471-AB', null, 'pix', null, v_acc, greatest(v_month, v_today - 1), 18.50, 'manual', 'expense'),
    (v_uid, 'EC *MP*LOJA3421', null, 'card', v_inter, null, greatest(v_month, v_today - 4), 64.90, 'manual', 'expense');

  -- ------------------------------------------------------------ recorrências (já geradas até hoje)
  for r in
    select * from (values
      ('income', 'Salário', 'receita_salario', 'pix', 5, 7000.00),
      ('expense', 'Aluguel', 'moradia', 'pix', 10, 1700.00),
      ('expense', 'Plano de saúde', 'saude', 'pix', 12, 320.00),
      ('expense', 'Internet', 'moradia', 'nu', 20, 99.90),
      ('expense', 'Academia', 'saude', 'inter', 3, 119.90),
      ('expense', 'Netflix', 'assinaturas', 'xp', 15, 44.90),
      ('expense', 'Spotify', 'assinaturas', 'nu', 8, 21.90),
      ('expense', 'iCloud', 'assinaturas', 'nu', 18, 14.90)
    ) as v(kind, name, cat, pay, day, amount)
  loop
    insert into public.recurrences (user_id, kind, name, category, method_type, card_id, account_id, amount, day, start_date)
    values (v_uid, r.kind::public.tx_kind, r.name, r.cat,
            (case when r.pay = 'pix' then 'pix' else 'card' end)::public.payment_method,
            case r.pay when 'nu' then v_nu when 'inter' then v_inter when 'xp' then v_xp end,
            case when r.pay = 'pix' then v_acc end,
            r.amount, r.day, v_start)
    returning id into v_rec;
    v_last := null;
    for k in 0..3 loop
      d := (v_month - make_interval(months => k))::date + (r.day - 1);
      continue when d > v_today;
      insert into public.transactions (user_id, name, category, method_type, card_id, account_id, date, amount, source, kind, recurrence_id)
      values (v_uid, r.name, r.cat,
              (case when r.pay = 'pix' then 'pix' else 'card' end)::public.payment_method,
              case r.pay when 'nu' then v_nu when 'inter' then v_inter when 'xp' then v_xp end,
              case when r.pay = 'pix' then v_acc end,
              d, r.amount, 'manual', r.kind::public.tx_kind, v_rec);
      v_last := greatest(coalesce(v_last, d), d);
    end loop;
    update public.recurrences set last_run = v_today where id = v_rec;
  end loop;

  -- ------------------------------------------------------------ guardar dinheiro e rendimento
  for k in 0..3 loop
    d := (v_month - make_interval(months => k))::date + 5;
    if d <= v_today then
      insert into public.transactions (user_id, kind, name, method_type, account_id, transfer_account_id, date, amount, source) values
        (v_uid, 'transfer', 'Guardar na reserva', 'pix', v_acc, v_reserva, d, 500, 'manual'),
        (v_uid, 'transfer', 'Guardar para a viagem', 'pix', v_acc, v_viagem, d, 300, 'manual'),
        (v_uid, 'transfer', 'Guardar para o imóvel', 'pix', v_acc, v_casa, d, 1500, 'manual'),
        (v_uid, 'transfer', 'Separar para o dia a dia', 'pix', v_acc, v_porto, d, 450, 'manual');
    end if;
    d := (v_month - make_interval(months => k))::date;
    insert into public.transactions (user_id, name, category, method_type, account_id, date, amount, source, kind)
    values (v_uid, 'Rendimento', 'receita_rendimentos', 'pix', v_reserva, d, round(198 + k * 4.7 + (k % 2) * 6.3, 2), 'manual', 'income');
  end loop;

  -- ------------------------------------------------------------ compras parceladas
  v_group := gen_random_uuid();
  for i in 1..10 loop
    insert into public.transactions (user_id, name, category, method_type, card_id, date, amount, source, kind, installment_group, installment_number, installment_total)
    values (v_uid, 'Notebook', 'outros', 'card', v_nu, ((v_month - interval '3 months')::date + 13 + make_interval(months => i - 1))::date, 420, 'manual', 'expense', v_group, i, 10);
  end loop;
  v_group := gen_random_uuid();
  for i in 1..6 loop
    insert into public.transactions (user_id, name, category, method_type, card_id, date, amount, source, kind, installment_group, installment_number, installment_total)
    values (v_uid, 'Passagem aérea', 'lazer', 'card', v_xp, ((v_month - interval '1 month')::date + 21 + make_interval(months => i - 1))::date, 310, 'manual', 'expense', v_group, i, 6);
  end loop;

  -- ------------------------------------------------------------ fatura de outubro do Inter "lida pela IA"
  select coalesce(sum(t.amount), 0) into v_total from public.transactions t
   where t.user_id = v_uid and t.card_id = v_inter and t.kind = 'expense'
     and date_trunc('month', t.date) = v_month - interval '1 month';
  insert into public.invoice_imports (user_id, card_id, file_name, total, previous_invoice, imported_at)
  values (v_uid, v_inter, 'fatura-inter-' || to_char(v_month - interval '1 month', 'MM-YYYY') || '.pdf', v_total, 0, (v_month - interval '1 month')::date + 27)
  returning id into v_inv;
  update public.transactions t set source = 'fatura', invoice_id = v_inv
   where t.user_id = v_uid and t.card_id = v_inter and t.kind = 'expense' and t.recurrence_id is null
     and date_trunc('month', t.date) = v_month - interval '1 month';

  -- ------------------------------------------------------------ faturas pagas no vencimento (mês seguinte)
  for c in select id, coalesce(bank, nickname) as nickname, due_day from public.cards where user_id = v_uid loop
    for k in 1..3 loop
      select coalesce(sum(t.amount), 0) into v_total from public.transactions t
       where t.user_id = v_uid and t.card_id = c.id and t.kind = 'expense'
         and date_trunc('month', t.date) = v_month - make_interval(months => k);
      v_due := (v_month - make_interval(months => k - 1))::date + (c.due_day - 1);
      continue when v_total <= 0 or v_due > v_today;
      insert into public.transactions (user_id, kind, name, category, method_type, card_id, account_id, date, amount, source)
      values (v_uid, 'invoice_payment', 'Pagamento da fatura ' || c.nickname, 'outros', 'card', c.id, v_acc, v_due, v_total, 'manual');
    end loop;
  end loop;

  -- Faturas: fatura inicial (0) + o que foi lançado − o que foi pago
  perform set_config('okiva.skip_invoice_sync', '', true);
  update public.cards cd
     set invoice = greatest(0, cd.opening_invoice + coalesce((
           select sum(public.card_effect(t.kind, t.method_type, t.posted, t.amount))
             from public.transactions t
            where t.card_id = cd.id and not t.already_in_invoice), 0))
   where cd.user_id = v_uid;

  -- ------------------------------------------------------------ saldos das subcontas
  -- (o Nubank começa com R$ 1.500; os outros terminam nos valores abaixo)
  update public.accounts a
     set starting_balance = x.target - coalesce((
           select sum(case
                        when t.kind = 'transfer' and t.transfer_account_id = a.id then t.amount
                        when t.kind = 'transfer' then -t.amount
                        when t.kind = 'income' then t.amount
                        when t.kind = 'invoice_payment' then -t.amount
                        when t.kind = 'adjustment' then t.amount
                        when t.method_type = 'card' then 0
                        else -t.amount
                      end)
             from public.transactions t
            where t.user_id = v_uid and t.date <= v_today and (t.account_id = a.id or t.transfer_account_id = a.id)), 0)
    from (values (v_reserva, 24180.00), (v_viagem, 2350.00), (v_casa, 56000.00), (v_porto, 380.00)) as x(id, target)
   where a.id = x.id;

  -- Conferências com o banco
  update public.accounts set reconciled_on = v_today - 12, reconciled_balance = null where id = v_reserva;
  update public.accounts set reconciled_on = v_today - 5, reconciled_balance = null where id = v_acc;

  -- ------------------------------------------------------------ metas
  insert into public.goals (user_id, name, target, saved, icon, started_at, created_at)
  values (v_uid, 'Imóvel próprio', 200000, 20000, 'home', to_char(v_month - interval '24 months', 'YYYY-MM'), now() - interval '3 seconds')
  returning id into v_imovel;
  insert into public.goals (user_id, name, target, saved, deadline, icon, started_at, created_at)
  values (v_uid, 'Viagem para Portugal', 15000, 2000, to_char(v_month + interval '10 months', 'YYYY-MM'), 'plane', to_char(v_month - interval '10 months', 'YYYY-MM'), now() - interval '2 seconds')
  returning id into v_portugal;
  insert into public.goals (user_id, name, target, saved, icon, started_at, created_at)
  values (v_uid, 'Playstation 5', 4500, 600, 'target', to_char(v_month - interval '8 months', 'YYYY-MM'), now() - interval '1 second')
  returning id into v_ingles;

  insert into public.goal_deposits (user_id, goal_id, amount, date)
  select v_uid, g.goal_id, g.amount, (v_month - make_interval(months => s.i))::date + (least(6, extract(day from v_today)::int) - 1)
    from (values (v_imovel, 1500::numeric, 24), (v_portugal, 500, 10), (v_ingles, 300, 8)) as g(goal_id, amount, months)
    cross join lateral generate_series(0, g.months - 1) as s(i);

  -- ------------------------------------------------------------ perfil e tetos
  update public.profiles
     set name = 'Lucas',
         stage = 2,
         hide_balance = false,
         starting_balance = 0,
         budget_total = 7000,
         featured_goal_id = v_imovel
   where id = v_uid;

  insert into public.budget_caps (user_id, category, value) values
    (v_uid, 'moradia', 2100), (v_uid, 'alimentacao', 1400), (v_uid, 'transporte', 450),
    (v_uid, 'lazer', 600), (v_uid, 'assinaturas', 150), (v_uid, 'saude', 600), (v_uid, 'outros', 700);
end;
$$;
revoke all on function public.seed_demo_account() from public, anon;
grant execute on function public.seed_demo_account() to authenticated;
