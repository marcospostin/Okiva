/**
 * Transferências ("Mover dinheiro") e ajustes ("Conferir saldo/fatura"): como aparecem nas listas.
 * Não são gasto nem receita, então ficam com cor neutra e fora de teto e relatórios.
 */
import { accountLabel, cardShort } from './labels'
import type { AppState, Transaction } from '../types'
import { brl, HIDDEN_MONEY } from './format'
import { kindOf } from './ledger'

/** "Nubank → Nubank · Caixinha 01" / "Ajuste de saldo · Inter" / "Ajuste da fatura · Nubank" */
export function movementSubtitle(state: AppState, t: Transaction) {
  if (kindOf(t) === 'transfer') {
    const from = state.accounts.find((a) => a.id === t.accountId)
    const to = state.accounts.find((a) => a.id === t.transferAccountId)
    // Dentro da mesma conta (conta ↔ subconta): só os nomes, sem repetir o banco
    const sameMain = !!from && !!to && (from.parentId ?? from.id) === (to.parentId ?? to.id)
    if (sameMain) return `${from!.name} → ${to!.name}`
    return `${accountLabel(state, t.accountId)} → ${accountLabel(state, t.transferAccountId)}`
  }
  if (t.method.type === 'card') {
    const id = t.method.cardId
    const card = state.cards.find((c) => c.id === id)
    return `Ajuste da fatura · ${card ? cardShort(card) : 'Cartão'}`
  }
  return `Ajuste de saldo · ${accountLabel(state, t.accountId)}`
}

/**
 * Valor com sinal. Transferência vista de uma conta: entra (+) ou sai (−); vista de fora, sem sinal.
 * Ajuste: o sinal do próprio valor.
 */
export function movementAmount(t: Transaction, hidden: boolean, fromAccountId?: string) {
  const money = (n: number) => (hidden ? HIDDEN_MONEY : brl(n))
  if (kindOf(t) === 'transfer') {
    if (fromAccountId && t.transferAccountId === fromAccountId) return `+ ${money(t.amount)}`
    if (fromAccountId) return `− ${money(t.amount)}`
    return money(t.amount)
  }
  return `${t.amount >= 0 ? '+' : '−'} ${money(Math.abs(t.amount))}`
}
