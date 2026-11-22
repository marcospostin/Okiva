-- =============================================================================
-- Okiva - papel de ADMINISTRADOR (temporário)
-- =============================================================================
-- Admin = usuário com app_metadata.role = 'admin' (raw_app_meta_data em auth.users).
-- app_metadata só pode ser alterado pelo servidor (service role / SQL), nunca pelo
-- próprio usuário, então o claim no JWT é confiável.
--
-- As políticas abaixo SOMAM às políticas de dono (RLS permissiva = OR):
-- usuários comuns continuam vendo só os próprios dados; o admin vê e gerencia tudo.
--
-- Para remover o acesso admin de alguém:
--   update auth.users set raw_app_meta_data = raw_app_meta_data - 'role' where email = '...';
--   (vale no próximo login/refresh do token)
-- Para remover o recurso inteiro: rode o bloco "ROLLBACK" no fim deste arquivo.
-- =============================================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['cards', 'transactions', 'goals', 'goal_deposits', 'budget_caps', 'categories', 'invoice_imports'] loop
    execute format('drop policy if exists %I on public.%I', t || '_admin_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))',
      t || '_admin_all', t
    );
  end loop;
end $$;

-- profiles: só SELECT/UPDATE existem para o app (criação vem do Auth, exclusão do delete_my_account)
drop policy if exists profiles_admin_select on public.profiles;
create policy profiles_admin_select on public.profiles for select to authenticated using ((select public.is_admin()));
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Storage: admin lê e gerencia os arquivos de todos nos buckets do app
drop policy if exists okiva_storage_admin_all on storage.objects;
create policy okiva_storage_admin_all on storage.objects for all to authenticated
  using (bucket_id in ('avatars', 'invoices') and (select public.is_admin()))
  with check (bucket_id in ('avatars', 'invoices') and (select public.is_admin()));

-- ROLLBACK (manual):
-- do $$ declare t text; begin
--   foreach t in array array['cards','transactions','goals','goal_deposits','budget_caps','categories','invoice_imports'] loop
--     execute format('drop policy if exists %I on public.%I', t || '_admin_all', t);
--   end loop; end $$;
-- drop policy if exists profiles_admin_select on public.profiles;
-- drop policy if exists profiles_admin_update on public.profiles;
-- drop policy if exists okiva_storage_admin_all on storage.objects;
-- drop function if exists public.is_admin();
