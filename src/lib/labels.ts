/** Nomes de conta, cartão e forma de pagamento (regras puras, sem React). */
import type { AppState, Card, Transaction } from '../types'
import { kindOf } from './ledger'

export function accountName(state: AppState, id?: string) {
  return state.accounts.find((a) => a.id === id)?.name ?? state.accounts[0]?.name ?? 'Conta'
}

/** "Nubank · Dia a dia" (conta com apelido), "Nubank · Caixinha 01" (subconta) ou só o banco. */
export function accountLabel(state: AppState, id?: string) {
  const a = state.accounts.find((x) => x.id === id)
  if (!a) return accountName(state, id)
  const parent = a.parentId ? state.accounts.find((x) => x.id === a.parentId) : undefined
  if (parent) return `${parent.name} · ${a.name}`
  return a.nickname ? `${a.name} · ${a.nickname}` : a.name
}

/** Banco do cartão (cartões antigos sem banco: o apelido). */
export const cardName = (c: Pick<Card, 'bank' | 'nickname'>) => c.bank?.trim() || c.nickname
/** Apelido, quando é diferente do banco. */
export const cardNickname = (c: Pick<Card, 'bank' | 'nickname'>) => (c.bank && c.nickname && c.nickname !== c.bank ? c.nickname : undefined)
/** "Nubank · Viagens" (para escolher entre cartões do mesmo banco). */
export const cardShort = (c: Pick<Card, 'bank' | 'nickname'>) => (cardNickname(c) ? `${cardName(c)} · ${cardNickname(c)}` : cardName(c))
/** "Nubank · Viagens •• 4552" */
export const cardLabel = (c: Pick<Card, 'bank' | 'nickname' | 'last4'>) => `${cardShort(c)} •• ${c.last4}`

export function methodLabel(state: AppState, t: Pick<Transaction, 'method' | 'kind' | 'accountId' | 'removedCard'>) {
  if (kindOf(t) === 'income') return accountName(state, t.accountId)
  if (t.removedCard) return `${t.removedCard} (removido)`
  if (t.method.type === 'pix') return 'Pix'
  if (t.method.type === 'cash') return 'Dinheiro'
  const id = t.method.cardId
  const card = state.cards.find((c) => c.id === id)
  return card ? cardLabel(card) : 'Cartão'
}
