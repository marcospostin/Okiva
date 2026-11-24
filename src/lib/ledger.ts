/**
 * Regras de dinheiro compartilhadas pelo store, pelos mocks e pelas telas.
 * As mesmas regras rodam no banco (supabase/migrations/20261123120000_okiva_contas_recorrencias_parcelas.sql):
 *
 *  - Saldo = soma dos saldos iniciais das contas + receitas − gastos fora do cartão − pagamentos de fatura
 *    (só lançamentos com data até hoje). Gasto no cartão não mexe no saldo: o dinheiro sai ao pagar a fatura.
 *  - Teto / gastos do mês = só `expense`, no mês da data (cada parcela no mês dela).
 *  - Fatura do cartão = gastos no cartão já "postados" − pagamentos de fatura.
 */
import type { Account, AppState, Card, CategoryId, IncomeSource, Recurrence, Transaction, TxKind } from '../types'
import { toISO, uid } from './format'

export const kindOf = (t: Pick<Transaction, 'kind'>): TxKind => t.kind ?? 'expense'
export const isExpense = (t: Pick<Transaction, 'kind'>) => kindOf(t) === 'expense'

/** Parcela futura ainda não entrou na fatura. */
export const isPosted = (t: Pick<Transaction, 'posted' | 'date'>, today: string) => t.posted ?? t.date <= today

/** Quanto o lançamento soma (ou tira) da fatura do cartão. */
export function cardEffect(t: Transaction, today: string): { cardId: string; delta: number } | null {
  if (t.method.type !== 'card' || !isPosted(t, today)) return null
  const k = kindOf(t)
  if (k === 'expense') return { cardId: t.method.cardId, delta: t.amount }
  if (k === 'invoice_payment') return { cardId: t.method.cardId, delta: -t.amount }
  return null
}

/** Quanto o lançamento mexe no saldo (0 para gasto no cartão e para datas futuras). */
export function balanceEffect(t: Transaction, today: string) {
  if (t.date > today) return 0
  const k = kindOf(t)
  if (k === 'income') return t.amount
  if (k === 'invoice_payment') return -t.amount
  return t.method.type === 'card' ? 0 : -t.amount
}

/** Aplica (sign 1) ou desfaz (sign −1) o efeito de um lançamento na fatura do cartão. */
export function adjustInvoice(cards: Card[], tx: Transaction, sign: 1 | -1, today: string) {
  const e = cardEffect(tx, today)
  if (!e) return cards
  return cards.map((c) => (c.id === e.cardId ? { ...c, invoice: Math.max(0, round2(c.invoice + sign * e.delta)) } : c))
}

export const round2 = (n: number) => Math.round(n * 100) / 100

/* ------------------------------------------------------------- receitas */

export const INCOME_SOURCES: { id: IncomeSource; label: string }[] = [
  { id: 'receita_salario', label: 'Salário' },
  { id: 'receita_extra', label: 'Renda extra' },
  { id: 'receita_rendimentos', label: 'Rendimentos' },
  { id: 'receita_reembolso', label: 'Reembolso' },
  { id: 'receita_outros', label: 'Outros' },
]
export const isIncomeSource = (c: CategoryId | null): c is IncomeSource => INCOME_SOURCES.some((s) => s.id === c)
export const incomeLabel = (c: CategoryId | null) => INCOME_SOURCES.find((s) => s.id === c)?.label ?? 'Receita'

/* ------------------------------------------------------------- parcelas */

/** Divide como a maquininha: centavos que sobram vão na 1ª parcela. R$ 100 em 3x = 33,34 + 33,33 + 33,33. */
export function splitInstallments(total: number, count: number): number[] {
  const cents = Math.round(total * 100)
  const base = Math.floor(cents / count)
  const rest = cents - base * count
  return Array.from({ length: count }, (_, i) => (base + (i === 0 ? rest : 0)) / 100)
}

/** Soma meses mantendo o dia; em mês mais curto cai no último dia (31/01 + 1 mês = 28/02). */
export function addMonths(iso: string, months: number) {
  const [y, m, d] = iso.split('-').map(Number)
  const last = new Date(y, m - 1 + months + 1, 0).getDate()
  return toISO(new Date(y, m - 1 + months, Math.min(d, last)))
}

export interface InstallmentInput {
  /** Compra existente (editar) ou nova */
  group?: string
  name: string
  /** null = sem categoria (classificar depois) */
  category: CategoryId | null
  cardId: string
  total: number
  count: number
  /** Data da compra = 1ª parcela */
  firstDate: string
}

export function buildInstallments(input: InstallmentInput, today: string): Transaction[] {
  const group = input.group ?? `g_${uid()}`
  return splitInstallments(input.total, input.count).map((amount, i) => {
    const date = addMonths(input.firstDate, i)
    return {
      id: uid(),
      kind: 'expense',
      name: input.name,
      category: input.category,
      method: { type: 'card', cardId: input.cardId },
      date,
      amount,
      source: 'manual',
      installment: { group, number: i + 1, total: input.count },
      posted: date <= today,
    }
  })
}

/** Todas as parcelas da compra, em ordem. */
export function installmentGroup(state: Pick<AppState, 'transactions'>, group: string) {
  return state.transactions.filter((t) => t.installment?.group === group).sort((a, b) => a.installment!.number - b.installment!.number)
}

/* ---------------------------------------------------------- recorrências */

const lastDayOf = (y: number, m: number) => new Date(y, m, 0).getDate()

/** Datas em que a regra cai entre o último processamento e hoje (mesma regra de process_due). */
export function dueDates(rec: Recurrence, today: string): string[] {
  const from = rec.lastRun && addDays(rec.lastRun, 1) > rec.startDate ? addDays(rec.lastRun, 1) : rec.startDate
  const to = rec.endDate && rec.endDate < today ? rec.endDate : today
  if (from > to) return []
  const out: string[] = []
  let [y, m] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  while (y < ty || (y === ty && m <= tm)) {
    const d = toISO(new Date(y, m - 1, Math.min(rec.day, lastDayOf(y, m))))
    if (d >= from && d <= to) out.push(d)
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return out
}

/** Próxima data em que a regra vai gerar um lançamento (para mostrar "próximo: 07 dez"). */
export function nextDate(rec: Recurrence, today: string): string | null {
  const from = rec.lastRun && rec.lastRun >= today ? addDays(rec.lastRun, 1) : addDays(today, 1) > rec.startDate ? addDays(today, 1) : rec.startDate
  let [y, m] = from.split('-').map(Number)
  for (let i = 0; i < 14; i++) {
    const d = toISO(new Date(y, m - 1, Math.min(rec.day, lastDayOf(y, m))))
    if (d >= from) return rec.endDate && d > rec.endDate ? null : d
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return null
}

export function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map(Number)
  return toISO(new Date(y, m - 1, d + days))
}

/* ----------------------------------------------------------------- contas */

export const ACCOUNT_KINDS: { id: Account['kind']; label: string }[] = [
  { id: 'checking', label: 'Conta corrente' },
  { id: 'savings', label: 'Poupança' },
  { id: 'wallet', label: 'Carteira' },
]
export const accountKindLabel = (k: Account['kind']) => ACCOUNT_KINDS.find((x) => x.id === k)?.label ?? 'Conta'

/**
 * Garante a conta "Principal" (dados salvos antes das contas). O saldo mostrado não muda:
 * antes todo gasto saía do saldo, agora o gasto no cartão só sai ao pagar a fatura.
 */
export function ensureAccounts(state: AppState): AppState {
  if (state.accounts?.length) return state
  const cardSpent = (state.transactions ?? []).filter((t) => isExpense(t) && t.method.type === 'card').reduce((s, t) => s + t.amount, 0)
  const account: Account = { id: `a_${uid()}`, name: 'Principal', kind: 'checking', startingBalance: round2((state.startingBalance ?? 0) - cardSpent) }
  return {
    ...state,
    startingBalance: 0,
    accounts: [account],
    recurrences: state.recurrences ?? [],
    transactions: (state.transactions ?? []).map((t) => (t.accountId || (isExpense(t) && t.method.type === 'card') ? t : { ...t, accountId: account.id })),
  }
}

/** Versão local de process_due(): posta parcelas que venceram e gera as recorrências do dia. */
export function processDueLocal(input: AppState, today: string): AppState {
  let state = ensureAccounts(input)
  let cards = state.cards
  let changed = state !== input
  const transactions = state.transactions.map((t) => {
    if (t.posted === false && t.date <= today) {
      const posted = { ...t, posted: true }
      cards = adjustInvoice(cards, posted, 1, today)
      changed = true
      return posted
    }
    return t
  })
  const created: Transaction[] = []
  const recurrences = state.recurrences.map((r) => {
    const dates = dueDates(r, today)
    if (!dates.length) return r
    changed = true
    for (const date of dates) {
      if (transactions.some((t) => t.recurrenceId === r.id && t.date === date)) continue
      const tx: Transaction = {
        id: uid(),
        kind: r.kind,
        name: r.name,
        category: r.category,
        method: r.method,
        accountId: r.method.type === 'card' ? undefined : (r.accountId ?? state.accounts[0]?.id),
        date,
        amount: r.amount,
        source: 'manual',
        recurrenceId: r.id,
        posted: true,
      }
      cards = adjustInvoice(cards, tx, 1, today)
      created.push(tx)
    }
    return { ...r, lastRun: r.endDate && r.endDate < today ? r.endDate : today }
  })
  if (!changed) return state
  state = { ...state, cards, recurrences, transactions: [...created, ...transactions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)) }
  return state
}
