-- =============================================================================
-- Okiva - etapa 14a: novos tipos de lançamento
-- =============================================================================
-- transfer    "Mover dinheiro" entre contas/subcontas. Não é gasto nem receita.
-- adjustment  "Ajuste de saldo/fatura" da conferência ("Não sei"). Valor com sinal.
-- (Em migration separada: valores novos de enum não podem ser usados na mesma transação.)
-- =============================================================================

alter type public.tx_kind add value if not exists 'transfer';
alter type public.tx_kind add value if not exists 'adjustment';
