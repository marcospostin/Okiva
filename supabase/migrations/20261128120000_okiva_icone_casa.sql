-- =============================================================================
-- Okiva - etapa 15a: ícone de casa para metas ("Imóvel próprio")
-- (Em migration separada: valor novo de enum não pode ser usado na mesma transação.)
-- =============================================================================

alter type public.goal_icon add value if not exists 'home';
