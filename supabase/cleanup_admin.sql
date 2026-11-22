-- =============================================================================
-- Okiva - remover o ADMIN de teste (temporário)
-- =============================================================================
-- Opção A: manter a conta, tirar só o acesso de administrador
--   (vale no próximo login ou refresh do token)
update auth.users
   set raw_app_meta_data = raw_app_meta_data - 'role'
 where email = 'marcospostin@gmail.com';

-- Opção B: apagar a conta e todos os dados dela (cascata pelo profile).
-- Descomente para usar:
-- delete from auth.users where email = 'marcospostin@gmail.com';

-- Opção C: remover o recurso de admin do banco inteiro:
-- rode o bloco ROLLBACK no fim de migrations/20261122174638_okiva_admin_role.sql
