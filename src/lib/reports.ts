/**
 * Cálculos dos relatórios. Mesmas regras da Home e dos tetos:
 *  - só gastos (`expense`) em Categorias e Onde; receitas só em Mês a mês;
 *  - parcela conta no mês dela; pagamento de fatura não é gasto (a compra já contou);
 *  - "sem categoria" aparece como grupo próprio.
 */
import { normalizeLabel } from '../data/categories'
import type { AppState, CategoryId, Transaction } from '../types'
import { kindOf, round2 } from './ledger'
import { monthKey, shiftMonth, byDateDesc } from './format'

export type ReportTab = 'categorias' | 'onde' | 'mes'
export type Span = 1 | 3 | 6 | 12

/** Filtro de origem: tudo, um cartão ou uma conta */
export type SourceFilter = 'all' | `card:${string}` | `acc:${string}`

/** yyyy-mm somando meses */
export { shiftMonth }

/** Meses do período, do mais antigo ao `anchor` */
export function monthsOf(anchor: string, span: Span) {
  return Array.from({ length: span }, (_, i) => shiftMonth(anchor, i - span + 1))
}

function matchesSource(state: AppState, t: Transaction, source: SourceFilter) {
  if (source === 'all') return true
  if (source.startsWith('card:')) return t.method.type === 'card' && t.method.cardId === source.slice(5)
  const acc = source.slice(4)
  if (t.method.type === 'card' && kindOf(t) === 'expense') return false
  return (t.accountId ?? state.accounts[0]?.id) === acc
}

/** Gastos do período (mais recentes primeiro) */
export function expensesIn(state: AppState, months: string[], source: SourceFilter = 'all') {
  const set = new Set(months)
  return state.transactions
    .filter((t) => kindOf(t) === 'expense' && set.has(monthKey(t.date)) && matchesSource(state, t, source))
    .sort(byDateDesc)
}

export interface Group {
  key: string
  label: string
  amount: number
  count: number
  ids: string[]
  category: CategoryId | null
}

/** Gastos por categoria, maiores primeiro */
export function byCategory(txs: Transaction[]): Group[] {
  const map = new Map<string, Group>()
  for (const t of txs) {
    const key = t.category ?? '__none'
    const g = map.get(key) ?? { key, label: '', amount: 0, count: 0, ids: [] as string[], category: t.category }
    g.amount += t.amount
    g.count += 1
    g.ids.push(t.id)
    map.set(key, g)
  }
  return [...map.values()].map((g) => ({ ...g, amount: round2(g.amount) })).sort((a, b) => b.amount - a.amount)
}

/**
 * Gastos por estabelecimento. Nomes iguais escritos de jeitos diferentes se juntam
 * (mesma normalização das regras aprendidas). O rótulo é a grafia mais usada; a categoria,
 * a que mais aparece naquele estabelecimento (usada para a cor da barra).
 */
export function byPayee(txs: Transaction[]): Group[] {
  const map = new Map<string, Group & { spellings: Map<string, number>; cats: Map<string, number> }>()
  for (const t of txs) {
    const key = normalizeLabel(t.name) || '—'
    const g = map.get(key) ?? {
      key,
      label: t.name,
      amount: 0,
      count: 0,
      ids: [] as string[],
      category: null,
      spellings: new Map<string, number>(),
      cats: new Map<string, number>(),
    }
    g.amount += t.amount
    g.count += 1
    g.ids.push(t.id)
    g.spellings.set(t.name.trim(), (g.spellings.get(t.name.trim()) ?? 0) + 1)
    const ck = t.category ?? '__none'
    g.cats.set(ck, (g.cats.get(ck) ?? 0) + 1)
    map.set(key, g)
  }
  return [...map.values()]
    .map(({ spellings, cats, ...g }) => {
      const label = [...spellings.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? g.label
      const top = [...cats.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
      return { ...g, label, amount: round2(g.amount), category: top && top !== '__none' ? top : null }
    })
    .sort((a, b) => b.amount - a.amount)
}

/** Junta o que passa de `max` itens em um grupo "Outros" (para gráficos legíveis) */
export function topWithRest(groups: Group[], max: number): { shown: Group[]; rest: Group | null } {
  if (groups.length <= max) return { shown: groups, rest: null }
  const shown = groups.slice(0, max - 1)
  const others = groups.slice(max - 1)
  return {
    shown,
    rest: {
      key: '__rest',
      label: `Outros (${others.length})`,
      amount: round2(others.reduce((s, g) => s + g.amount, 0)),
      count: others.reduce((s, g) => s + g.count, 0),
      ids: others.flatMap((g) => g.ids),
      category: null,
    },
  }
}

export interface MonthRow {
  key: string
  income: number
  expense: number
  net: number
  incomeIds: string[]
  expenseIds: string[]
}

/** Entradas e saídas por mês (receitas x gastos), na ordem dos meses */
export function monthly(state: AppState, months: string[], source: SourceFilter = 'all'): MonthRow[] {
  return months.map((key) => {
    const txs = state.transactions.filter((t) => monthKey(t.date) === key && matchesSource(state, t, source))
    const inc = txs.filter((t) => kindOf(t) === 'income')
    const exp = txs.filter((t) => kindOf(t) === 'expense')
    const income = round2(inc.reduce((s, t) => s + t.amount, 0))
    const expense = round2(exp.reduce((s, t) => s + t.amount, 0))
    return { key, income, expense, net: round2(income - expense), incomeIds: inc.map((t) => t.id), expenseIds: exp.map((t) => t.id) }
  })
}

/* ---------------------------------------------------------- navegação */

const OPEN_KEY = 'okiva:reports-open'

/** Guarda em qual aba/mês o relatório deve abrir (Home → Relatórios). */
export function rememberReportsOpen(opts: { tab: ReportTab; month: string }) {
  try {
    sessionStorage.setItem(OPEN_KEY, JSON.stringify(opts))
  } catch {
    /* sem storage: abre no padrão */
  }
}

export function takeReportsOpen(): { tab: ReportTab; month: string } | null {
  try {
    const raw = sessionStorage.getItem(OPEN_KEY)
    sessionStorage.removeItem(OPEN_KEY)
    return raw ? (JSON.parse(raw) as { tab: ReportTab; month: string }) : null
  } catch {
    return null
  }
}

/** Evento para o detalhe pedir "ver onde gastei nesta categoria" sem sair da tela. */
export const REPORTS_EVENT = 'okiva:reports'
export type ReportsEvent = { tab: ReportTab; category?: CategoryId | null }

const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const MONTHS_LONG = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export const monthShort = (key: string) => MONTHS_SHORT[Number(key.slice(5, 7)) - 1]
export const monthLong = (key: string) => MONTHS_LONG[Number(key.slice(5, 7)) - 1]

/** "Novembro 2026" ou "set – nov 2026" */
export function periodLabel(months: string[]) {
  const first = months[0]
  const last = months[months.length - 1]
  if (months.length === 1) return `${monthLong(last)} ${last.slice(0, 4)}`
  const sameYear = first.slice(0, 4) === last.slice(0, 4)
  return `${monthShort(first)}${sameYear ? '' : ` ${first.slice(0, 4)}`} – ${monthShort(last)} ${last.slice(0, 4)}`
}
