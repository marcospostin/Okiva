-- =============================================================================
-- Okiva - remove a conta demo (lucas@okiva.app) e TODOS os dados dela
-- =============================================================================
-- Use quando o app tiver dados reais. Rodar como postgres no SQL Editor do Supabase
-- (Dashboard > SQL Editor) ou com: psql "$DIRECT_URL" -f supabase/cleanup_demo.sql
--
-- O que acontece: excluir o usuário em auth.users apaga em cascata auth.identities,
-- public.profiles e, a partir do profile, cards, transactions, goals, goal_deposits,
-- budget_caps, categories e invoice_imports (testado em 2026-11-22, 0 linhas restantes).
-- Arquivos no Storage (pastas <uid>/ em avatars e invoices) NÃO são apagados por SQL
-- (o Supabase bloqueia DELETE direto em storage.objects): remova-os pelo dashboard
-- (Storage) ou pela Storage API antes/depois, se existirem. O seed não cria arquivos.
-- Irreversível. Para recriar a conta demo depois, rode supabase/seed.sql.
-- =============================================================================

begin;

-- conferência antes de apagar
select u.id, u.email,
       (select count(*) from public.transactions t where t.user_id = u.id) as gastos,
       (select count(*) from public.goal_deposits d where d.user_id = u.id) as depositos,
       (select count(*) from storage.objects o where (storage.foldername(o.name))[1] = u.id::text) as arquivos_storage
  from auth.users u
 where u.email = 'lucas@okiva.app';

delete from auth.users where email = 'lucas@okiva.app';

commit;
