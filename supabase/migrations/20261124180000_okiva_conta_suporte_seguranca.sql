-- =============================================================================
-- Okiva - etapa 9: Conta (notificações, suporte, avaliação) e confirmação por e-mail
-- =============================================================================
-- profiles.notification_prefs   quais avisos a pessoa quer receber (só preferência; o envio
--                               por push/e-mail depende de um serviço que ainda não existe).
-- support_requests              dúvidas, problemas relatados, sugestões e avaliações enviados pelo app.
-- recent_email_verification()   true quando a sessão foi aberta por código/link enviado ao e-mail
--                               nos últimos minutos (claim "amr" do JWT do Supabase Auth).
-- clear_my_data / delete_my_account
--                               "Começar do zero" e "Excluir conta" só passam com essa verificação
--                               recente (a senha é conferida antes, no app). Conta de demonstração
--                               (anônima) não tem e-mail: segue sem exigência.
--
-- Rollback: alter table public.profiles drop column notification_prefs; drop table public.support_requests;
--   drop function public.recent_email_verification(integer); reaplicar clear_my_data da etapa 8.
-- =============================================================================

alter table public.profiles
  add column notification_prefs jsonb not null default jsonb_build_object(
    'invoice_due', true,
    'cap_alert', true,
    'uncategorized', true,
    'recurrence', false,
    'weekly_summary', false,
    'news', false
  );
comment on column public.profiles.notification_prefs is 'Avisos que a pessoa quer receber. news (novidades/marketing) começa desligado (consentimento explícito, LGPD).';
grant update (notification_prefs) on public.profiles to authenticated;

-- ---------------------------------------------------------------- support_requests
create table public.support_requests (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('duvida', 'problema', 'sugestao', 'avaliacao')),
  message    text not null default '' check (length(message) <= 4000),
  rating     smallint check (rating between 1 and 5),
  meta       jsonb not null default '{}'::jsonb,
  status     text not null default 'aberto' check (status in ('aberto', 'respondido', 'fechado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_requests_content check (rating is not null or length(btrim(message)) > 0)
);
comment on table public.support_requests is 'Mensagens enviadas em Conta → Ajuda / Relatar um problema / Avaliar. meta: versão do app, navegador, tela.';
create index support_requests_user_idx on public.support_requests (user_id, created_at desc);
create index support_requests_open_idx on public.support_requests (status, created_at) where status = 'aberto';
create trigger set_updated_at before update on public.support_requests for each row execute function public.set_updated_at();

alter table public.support_requests enable row level security;
revoke all on public.support_requests from public, anon, authenticated;
grant select, insert on public.support_requests to authenticated;
create policy support_requests_select_own on public.support_requests for select to authenticated using ((select auth.uid()) = user_id);
create policy support_requests_insert_own on public.support_requests for insert to authenticated with check ((select auth.uid()) = user_id);
create policy support_requests_admin_all on public.support_requests for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
grant update, delete on public.support_requests to authenticated; -- só o admin passa pela política

-- ---------------------------------------------------------------- verificação recente por e-mail
create or replace function public.recent_email_verification(p_minutes integer default 15)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((
    select bool_or(
             (a ->> 'method') in ('otp', 'magiclink')
             and to_timestamp((a ->> 'timestamp')::bigint) > now() - make_interval(mins => p_minutes)
           )
      from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) as a
  ), false)
$$;
revoke execute on function public.recent_email_verification(integer) from public, anon;
grant execute on function public.recent_email_verification(integer) to authenticated;

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
  if not public.is_demo() and not public.recent_email_verification() then
    raise exception 'Confirme com o código enviado ao seu e-mail antes de apagar os dados.' using errcode = '42501';
  end if;
  perform set_config('okiva.skip_invoice_sync', 'on', true);
  delete from public.transactions    where user_id = v_uid;
  delete from public.invoice_imports where user_id = v_uid;
  delete from public.recurrences     where user_id = v_uid;
  delete from public.category_rules  where user_id = v_uid;
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
-- delete_my_account chama clear_my_data, então herda a mesma exigência.
