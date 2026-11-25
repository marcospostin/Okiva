/**
 * Compras parceladas (bloco "Compras parceladas" da Home).
 *
 * Tudo é calculado para UM mês (o do seletor da Home), porque o total muda mês a mês:
 * entra uma compra, o valor sobe; termina outra, desce. Por isso nada de "R$ X por mês
 * até tal data" — o resumo diz o valor daquele mês e a data em que a última compra termina;
 * os degraus aparecem no gráfico.
 */
import type { AppState, Transaction } from '../types'
import { monthKey } from './format'
import { addMonths, kindOf, round2 } from './ledger'

export interface InstallmentPurchase {
  group: string
  name: string
  cardId?: string
  /** Parcela que cai no mês escolhido */
  current: Transaction
  total: number
  /** Valor total da compra */
  purchaseTotal: number
  /** Parcelas com data até hoje */
  paidCount: number
  /** Soma das parcelas que ainda não venceram (depois de hoje) */
  remaining: number
  /** Data da última parcela */
  endDate: string
}

function groupsOf(state: Pick<AppState, 'transactions'>) {
  const map = new Map<string, Transaction[]>()
  for (const t of state.transactions) {
    if (!t.installment || kindOf(t) !== 'expense') continue
    const list = map.get(t.installment.group)
    if (list) list.push(t)
    else map.set(t.installment.group, [t])
  }
  for (const list of map.values()) list.sort((a, b) => a.installment!.number - b.installment!.number)
  return map
}

/** Compras com uma parcela no mês (YYYY-MM), da que termina primeiro para a última. */
export function purchasesInMonth(state: Pick<AppState, 'transactions'>, month: string, today: string): InstallmentPurchase[] {
  const out: InstallmentPurchase[] = []
  for (const [group, list] of groupsOf(state)) {
    const current = list.find((t) => monthKey(t.date) === month)
    if (!current) continue
    const last = list[list.length - 1]
    // Compra que começou antes do Okiva: as parcelas anteriores à primeira lançada já foram pagas
    const before = list[0].installment!.number - 1
    out.push({
      group,
      name: current.name,
      cardId: current.method.type === 'card' ? current.method.cardId : undefined,
      current,
      total: current.installment!.total,
      purchaseTotal: round2(list.reduce((s, t) => s + t.amount, 0) + before * list[0].amount),
      paidCount: before + list.filter((t) => t.date <= today).length,
      remaining: round2(list.filter((t) => t.date > today).reduce((s, t) => s + t.amount, 0)),
      endDate: last.date,
    })
  }
  return out.sort((a, b) => (a.endDate < b.endDate ? -1 : a.endDate > b.endDate ? 1 : a.name.localeCompare(b.name)))
}

/** Total das compras parceladas em cada mês, de `from` até a última parcela das compras dadas. */
export function monthlySteps(state: Pick<AppState, 'transactions'>, from: string, until: string) {
  const totals = new Map<string, number>()
  for (const t of state.transactions) {
    if (!t.installment || kindOf(t) !== 'expense') continue
    const key = monthKey(t.date)
    if (key < from || key > until) continue
    totals.set(key, (totals.get(key) ?? 0) + t.amount)
  }
  const rows: { key: string; value: number }[] = []
  for (let key = from; key <= until; key = monthKey(addMonths(`${key}-01`, 1))) {
    rows.push({ key, value: round2(totals.get(key) ?? 0) })
    if (rows.length > 60) break
  }
  return rows
}
