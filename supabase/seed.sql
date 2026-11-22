-- =============================================================================
-- Okiva - SEED TEMPORÁRIO (dados de exemplo / conta demo)
-- =============================================================================
-- ATENÇÃO: estes dados são os mocks de src/data/mock.ts, mantidos no banco só
-- enquanto não há dados reais. Apague com supabase/cleanup_demo.sql.
--
-- Cria o usuário demo lucas@okiva.app (nome Lucas) em auth.users SEM senha
-- (encrypted_password vazio). Defina a senha depois pelo dashboard
-- (Authentication > Users > Send password recovery / magic link).
--
-- Datas relativas a current_date, como no mock:
--   thisMonth(n) = dia max(1, hoje - n) do mês atual
--   lastMonth(d) = dia d do mês anterior
--   depósitos    = dia min(5, hoje) de cada um dos últimos N meses
-- Idempotente: se o usuário demo já existir, não faz nada.
-- Rodar como postgres/service (SQL Editor ou supabase db reset).
-- =============================================================================

do $$
declare
  v_uid uuid;
  v_principal uuid;
  v_salario uuid;
  v_viagem uuid;
  v_japao uuid;
  v_reserva uuid;
  v_curso uuid;
  v_carro uuid;
  v_month date := date_trunc('month', current_date)::date;
  v_day int := extract(day from current_date)::int;
begin
  if exists (select 1 from auth.users where email = 'lucas@okiva.app') then
    raise notice 'Usuário demo já existe; seed ignorado.';
    return;
  end if;

  v_uid := gen_random_uuid();

  -- usuário sem senha, e-mail confirmado (o trigger on_auth_user_created cria o profile)
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    'lucas@okiva.app', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"Lucas","demo":true}'::jsonb,
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (
    v_uid::text, v_uid,
    jsonb_build_object('sub', v_uid::text, 'email', 'lucas@okiva.app', 'email_verified', true, 'phone_verified', false),
    'email', null, now(), now()
  );

  -- cartões (cardOrder ['viagem','salario','principal'], último = frente)
  insert into public.cards (user_id, nickname, last4, color, invoice, "limit", due_day, position)
  values (v_uid, 'Principal', '4552', 'gradient', 1284, 3000, 18, 3) returning id into v_principal;
  insert into public.cards (user_id, nickname, last4, color, invoice, "limit", due_day, position)
  values (v_uid, 'Salário', '6917', 'lilac', 640, 2000, 22, 2) returning id into v_salario;
  insert into public.cards (user_id, nickname, last4, color, invoice, "limit", due_day, position)
  values (v_uid, 'Viagem', '1180', 'offwhite', 98, 5000, 7, 1) returning id into v_viagem;

  -- gastos: as faturas acima já são os valores "digitados" do mock, então os
  -- gastos de exemplo NÃO somam de novo na fatura (flag de sessão).
  perform set_config('okiva.skip_invoice_sync', 'on', true);
  insert into public.transactions (user_id, name, category, method_type, card_id, date, amount, source) values
    (v_uid, 'Mercado',     'alimentacao', 'card', v_principal, v_month + (greatest(1, v_day - 0)  - 1), 260,  'manual'),
    (v_uid, 'Restaurante', 'alimentacao', 'card', v_principal, v_month + (greatest(1, v_day - 1)  - 1), 480,  'manual'),
    (v_uid, 'Uber',        'transporte',  'card', v_salario,   v_month + (greatest(1, v_day - 2)  - 1), 400,  'manual'),
    (v_uid, 'Netflix',     'assinaturas', 'card', v_principal, v_month + (greatest(1, v_day - 3)  - 1), 55.9, 'manual'),
    (v_uid, 'Spotify',     'assinaturas', 'card', v_viagem,    v_month + (greatest(1, v_day - 4)  - 1), 21.9, 'manual'),
    (v_uid, 'Aluguel',     'moradia',     'pix',  null,        v_month + (greatest(1, v_day - 31) - 1), 1200, 'manual'),
    (v_uid, 'Mercado',     'alimentacao', 'card', v_principal, (v_month - interval '1 month')::date + 23, 690,  'manual'),
    (v_uid, 'Restaurante', 'alimentacao', 'card', v_principal, (v_month - interval '1 month')::date + 17, 407,  'manual'),
    (v_uid, 'Uber',        'transporte',  'card', v_salario,   (v_month - interval '1 month')::date + 11, 362,  'manual'),
    (v_uid, 'Netflix',     'assinaturas', 'card', v_principal, (v_month - interval '1 month')::date + 4,  55.9, 'manual'),
    (v_uid, 'Aluguel',     'moradia',     'pix',  null,        (v_month - interval '1 month')::date + 0,  1200, 'manual');
  perform set_config('okiva.skip_invoice_sync', '', true);

  -- metas: saved = valor inicial; os depósitos abaixo somam em saved e deposited (trigger).
  -- created_at escalonado mantém a ordem do mock (a "primeira meta" vira principal se a principal for excluída).
  insert into public.goals (user_id, name, target, saved, deadline, icon, started_at, created_at)
  values (v_uid, 'Viagem ao Japão', 20000, 4600, '2027-12', 'plane', to_char(v_month - interval '14 months', 'YYYY-MM'), now() - interval '4 seconds') returning id into v_japao;
  insert into public.goals (user_id, name, target, saved, icon, started_at, created_at)
  values (v_uid, 'Reserva', 10000, 2400, 'shield', to_char(v_month - interval '11 months', 'YYYY-MM'), now() - interval '3 seconds') returning id into v_reserva;
  insert into public.goals (user_id, name, target, saved, icon, started_at, created_at)
  values (v_uid, 'Curso', 3000, 700, 'book', to_char(v_month - interval '9 months', 'YYYY-MM'), now() - interval '2 seconds') returning id into v_curso;
  insert into public.goals (user_id, name, target, saved, icon, started_at, created_at)
  values (v_uid, 'Carro novo', 70000, 5000, 'car', to_char(v_month - interval '11 months', 'YYYY-MM'), now() - interval '1 second') returning id into v_carro;

  -- 49 depósitos mensais: Japão 15×600, Reserva 12×400, Curso 10×200, Carro 12×750
  insert into public.goal_deposits (user_id, goal_id, amount, date)
  select v_uid, g.goal_id, g.amount, (v_month - make_interval(months => i))::date + (least(5, v_day) - 1)
    from (values (v_japao, 600::numeric, 15), (v_reserva, 400, 12), (v_curso, 200, 10), (v_carro, 750, 12)) as g(goal_id, amount, months)
    cross join lateral generate_series(0, g.months - 1) as i;

  -- perfil: Okiva Plus, saldo R$ 14.500 após os gastos, teto do mês 3200, meta principal Japão
  update public.profiles
     set name = 'Lucas',
         stage = 2,
         hide_balance = false,
         starting_balance = 14500 + (select sum(amount) from public.transactions where user_id = v_uid),
         budget_total = 3200,
         featured_goal_id = v_japao
   where id = v_uid;

  insert into public.budget_caps (user_id, category, value) values
    (v_uid, 'moradia', 1200), (v_uid, 'alimentacao', 1200), (v_uid, 'transporte', 1000), (v_uid, 'lazer', 300);
end;
$$;
