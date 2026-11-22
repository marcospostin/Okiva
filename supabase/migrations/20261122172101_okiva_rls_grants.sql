-- Okiva - etapa 3: RLS, políticas e grants mínimos
-- anon: nenhum acesso. authenticated: só as próprias linhas ((select auth.uid()) = user_id).
-- profiles: SELECT e UPDATE (colunas editáveis) apenas; INSERT é do trigger on_auth_user_created
-- e DELETE é via delete_my_account() (cascata a partir de auth.users).
-- Rollback: drop policy ... / alter table ... disable row level security (NÃO recomendado).

-- ---------------------------------------------------------------- RLS
alter table public.profiles        enable row level security;
alter table public.cards           enable row level security;
alter table public.goals           enable row level security;
alter table public.goal_deposits   enable row level security;
alter table public.categories      enable row level security;
alter table public.budget_caps     enable row level security;
alter table public.invoice_imports enable row level security;
alter table public.transactions    enable row level security;

-- ---------------------------------------------------------------- grants de tabela
revoke all on public.profiles, public.cards, public.goals, public.goal_deposits, public.categories,
              public.budget_caps, public.invoice_imports, public.transactions
  from public, anon, authenticated;

grant select on public.profiles to authenticated;
grant update (name, avatar_url, starting_balance, stage, hide_balance, featured_goal_id, budget_total)
  on public.profiles to authenticated;

grant select, insert, update, delete
  on public.cards, public.goals, public.goal_deposits, public.categories,
     public.budget_caps, public.invoice_imports, public.transactions
  to authenticated;

-- ---------------------------------------------------------------- grants de função
revoke execute on all functions in schema public from public, anon, authenticated;

-- usadas por triggers/índices executados com o papel de quem chama
grant execute on function public.normalize_label(text)               to authenticated;
grant execute on function public.is_builtin_category(text)           to authenticated;
grant execute on function public.is_valid_category(uuid, text)       to authenticated;
-- RPCs
grant execute on function public.import_invoice(uuid, text, numeric, jsonb) to authenticated;
grant execute on function public.recategorize_transactions(uuid[], text)    to authenticated;
grant execute on function public.reorder_cards(uuid[])                      to authenticated;
grant execute on function public.set_balance(numeric)                       to authenticated;
grant execute on function public.clear_my_data()                            to authenticated;
grant execute on function public.delete_my_account()                        to authenticated;

-- ---------------------------------------------------------------- políticas
-- profiles
create policy profiles_select_own on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- cards
create policy cards_select_own on public.cards for select to authenticated using ((select auth.uid()) = user_id);
create policy cards_insert_own on public.cards for insert to authenticated with check ((select auth.uid()) = user_id);
create policy cards_update_own on public.cards for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy cards_delete_own on public.cards for delete to authenticated using ((select auth.uid()) = user_id);

-- goals
create policy goals_select_own on public.goals for select to authenticated using ((select auth.uid()) = user_id);
create policy goals_insert_own on public.goals for insert to authenticated with check ((select auth.uid()) = user_id);
create policy goals_update_own on public.goals for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy goals_delete_own on public.goals for delete to authenticated using ((select auth.uid()) = user_id);

-- goal_deposits
create policy goal_deposits_select_own on public.goal_deposits for select to authenticated using ((select auth.uid()) = user_id);
create policy goal_deposits_insert_own on public.goal_deposits for insert to authenticated with check ((select auth.uid()) = user_id);
create policy goal_deposits_update_own on public.goal_deposits for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy goal_deposits_delete_own on public.goal_deposits for delete to authenticated using ((select auth.uid()) = user_id);

-- categories
create policy categories_select_own on public.categories for select to authenticated using ((select auth.uid()) = user_id);
create policy categories_insert_own on public.categories for insert to authenticated with check ((select auth.uid()) = user_id);
create policy categories_update_own on public.categories for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy categories_delete_own on public.categories for delete to authenticated using ((select auth.uid()) = user_id);

-- budget_caps
create policy budget_caps_select_own on public.budget_caps for select to authenticated using ((select auth.uid()) = user_id);
create policy budget_caps_insert_own on public.budget_caps for insert to authenticated with check ((select auth.uid()) = user_id);
create policy budget_caps_update_own on public.budget_caps for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy budget_caps_delete_own on public.budget_caps for delete to authenticated using ((select auth.uid()) = user_id);

-- invoice_imports
create policy invoice_imports_select_own on public.invoice_imports for select to authenticated using ((select auth.uid()) = user_id);
create policy invoice_imports_insert_own on public.invoice_imports for insert to authenticated with check ((select auth.uid()) = user_id);
create policy invoice_imports_update_own on public.invoice_imports for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy invoice_imports_delete_own on public.invoice_imports for delete to authenticated using ((select auth.uid()) = user_id);

-- transactions
create policy transactions_select_own on public.transactions for select to authenticated using ((select auth.uid()) = user_id);
create policy transactions_insert_own on public.transactions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy transactions_update_own on public.transactions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy transactions_delete_own on public.transactions for delete to authenticated using ((select auth.uid()) = user_id);
