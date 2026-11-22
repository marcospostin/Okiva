-- =============================================================================
-- Okiva - DEMONSTRAÇÃO POR VISITANTE (contas anônimas temporárias)
-- =============================================================================
-- "Ver demonstração" no login cria um usuário ANÔNIMO do Supabase Auth
-- (Authentication > Sign In / Providers > Anonymous Sign-ins) e chama
-- seed_demo_account(), que copia para ele os dados de exemplo do Lucas.
-- Cada visitante tem a própria cópia, isolada pela RLS.
--
-- Limpeza:
--   - ao sair: o app chama delete_my_account() (conta + dados somem na hora);
--   - quem só fecha a aba: pg_cron apaga, de hora em hora, contas anônimas
--     com mais de 24 h (private.cleanup_demo_accounts).
-- Contas demo não enviam arquivos ao Storage (política restritiva abaixo).
--
-- Rollback: bloco ROLLBACK no fim do arquivo.
-- =============================================================================

-- true quando a sessão é de um usuário anônimo (claim is_anonymous do JWT)
create or replace function public.is_demo()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
$$;

revoke all on function public.is_demo() from public, anon;
grant execute on function public.is_demo() to authenticated;

-- Copia os dados de exemplo (mesmos de supabase/seed.sql) para a conta demo logada.
-- SECURITY INVOKER: grava como o próprio visitante, passando pela RLS normal.
-- Idempotente: se a conta já tem dados, não faz nada.
create or replace function public.seed_demo_account()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
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
  if v_uid is null then
    raise exception 'Não autenticado.' using errcode = '42501';
  end if;
  if not public.is_demo() then
    raise exception 'Disponível só para contas de demonstração.' using errcode = '42501';
  end if;
  if exists (select 1 from public.cards where user_id = v_uid)
     or exists (select 1 from public.transactions where user_id = v_uid)
     or exists (select 1 from public.goals where user_id = v_uid) then
    return;
  end if;

  -- cartões (último = frente da carteira)
  insert into public.cards (user_id, nickname, last4, color, invoice, "limit", due_day, position)
  values (v_uid, 'Principal', '4552', 'gradient', 1284, 3000, 18, 3) returning id into v_principal;
  insert into public.cards (user_id, nickname, last4, color, invoice, "limit", due_day, position)
  values (v_uid, 'Salário', '6917', 'lilac', 640, 2000, 22, 2) returning id into v_salario;
  insert into public.cards (user_id, nickname, last4, color, invoice, "limit", due_day, position)
  values (v_uid, 'Viagem', '1180', 'offwhite', 98, 5000, 7, 1) returning id into v_viagem;

  -- gastos: as faturas acima já são os valores do exemplo, então não somam de novo
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

  -- metas (created_at escalonado mantém a ordem; a primeira vira principal se a principal for excluída)
  insert into public.goals (user_id, name, target, saved, deadline, icon, started_at, created_at)
  values (v_uid, 'Viagem ao Japão', 20000, 4600, '2027-12', 'plane', to_char(v_month - interval '14 months', 'YYYY-MM'), now() - interval '4 seconds') returning id into v_japao;
  insert into public.goals (user_id, name, target, saved, icon, started_at, created_at)
  values (v_uid, 'Reserva', 10000, 2400, 'shield', to_char(v_month - interval '11 months', 'YYYY-MM'), now() - interval '3 seconds') returning id into v_reserva;
  insert into public.goals (user_id, name, target, saved, icon, started_at, created_at)
  values (v_uid, 'Curso', 3000, 700, 'book', to_char(v_month - interval '9 months', 'YYYY-MM'), now() - interval '2 seconds') returning id into v_curso;
  insert into public.goals (user_id, name, target, saved, icon, started_at, created_at)
  values (v_uid, 'Carro novo', 70000, 5000, 'car', to_char(v_month - interval '11 months', 'YYYY-MM'), now() - interval '1 second') returning id into v_carro;

  -- 49 depósitos mensais (somam em saved/deposited pelo trigger)
  insert into public.goal_deposits (user_id, goal_id, amount, date)
  select v_uid, g.goal_id, g.amount, (v_month - make_interval(months => i))::date + (least(5, v_day) - 1)
    from (values (v_japao, 600::numeric, 15), (v_reserva, 400, 12), (v_curso, 200, 10), (v_carro, 750, 12)) as g(goal_id, amount, months)
    cross join lateral generate_series(0, g.months - 1) as i;

  -- perfil: Lucas, Okiva Plus, saldo R$ 14.500, teto 3200, meta principal Japão
  update public.profiles
     set name = 'Lucas',
         stage = 2,
         hide_balance = false,
         starting_balance = 14500 + (select coalesce(sum(amount), 0) from public.transactions where user_id = v_uid),
         budget_total = 3200,
         featured_goal_id = v_japao
   where id = v_uid;

  insert into public.budget_caps (user_id, category, value) values
    (v_uid, 'moradia', 1200), (v_uid, 'alimentacao', 1200), (v_uid, 'transporte', 1000), (v_uid, 'lazer', 300);
end;
$$;

revoke all on function public.seed_demo_account() from public, anon;
grant execute on function public.seed_demo_account() to authenticated;

-- Contas demo não sobem arquivos (foto/fatura): evita lixo no Storage que a limpeza SQL não alcança
drop policy if exists okiva_storage_no_demo_uploads on storage.objects;
create policy okiva_storage_no_demo_uploads on storage.objects as restrictive for insert to authenticated
  with check (not (select public.is_demo()));

-- Limpeza agendada (schema privado: fora da API pública)
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.cleanup_demo_accounts(p_max_age interval default '24 hours')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from auth.users
   where is_anonymous
     and created_at < now() - p_max_age;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function private.cleanup_demo_accounts(interval) from public, anon, authenticated;

create extension if not exists pg_cron;

select cron.unschedule(jobid) from cron.job where jobname = 'okiva-cleanup-demo-accounts';
select cron.schedule('okiva-cleanup-demo-accounts', '17 * * * *', $$select private.cleanup_demo_accounts('24 hours')$$);

-- ROLLBACK (manual):
-- select cron.unschedule('okiva-cleanup-demo-accounts');
-- drop function if exists private.cleanup_demo_accounts(interval);
-- drop policy if exists okiva_storage_no_demo_uploads on storage.objects;
-- drop function if exists public.seed_demo_account();
-- drop function if exists public.is_demo();
