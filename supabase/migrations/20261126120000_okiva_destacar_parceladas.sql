-- =============================================================================
-- Okiva - etapa 11: preferência "Destacar compras parceladas"
-- =============================================================================
-- Liga/desliga o bloco "Compras parceladas" da Home (Conta → Preferências).
-- Começa ligado: o bloco só aparece quando há compra parcelada no mês, e quem mais
-- precisa do destaque é quem menos iria procurar para ligá-lo.
--
-- Rollback: alter table public.profiles drop column highlight_installments;
-- =============================================================================

alter table public.profiles
  add column highlight_installments boolean not null default true;
comment on column public.profiles.highlight_installments is 'Mostra o bloco "Compras parceladas" na Home.';

grant update (highlight_installments) on public.profiles to authenticated;
