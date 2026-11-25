-- =============================================================================
-- Okiva - etapa 12: "Compras parceladas" sempre visível
-- =============================================================================
-- O bloco da Home deixou de ter interruptor (útil para todos e só aparece quando há
-- compra parcelada no mês). Remove a coluna criada na etapa 11.
--
-- Rollback: reaplicar 20261126120000_okiva_destacar_parceladas.sql
-- =============================================================================

alter table public.profiles drop column if exists highlight_installments;
