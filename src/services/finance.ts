/**
 * Okiva — serviço de dados financeiros.
 *
 * Toda escrita das telas passa por aqui. Com `VITE_USE_MOCK` (padrão) as funções
 * respondem localmente, com latência simulada e o MESMO formato que o backend deve
 * devolver. Com `VITE_USE_MOCK=false` cada função chama a rota REST indicada.
 *
 * Contrato completo (rotas, payloads, erros): docs/integracao-backend.md
 */
import { toISO, uid } from '../lib/format'
import { adjustInvoice, buildInstallments, buildOngoingInstallments, processDueLocal, round2, type InstallmentInput, type OngoingInstallmentInput } from '../lib/ledger'
import { TODAY } from '../data/mock'
import type { Account, AppState, Budget, CapAlert, Card, CategoryId, CategoryRule, CustomCategory, Goal, GoalDeposit, InvoiceImport, Recurrence, Transaction, User } from '../types'
import { mockDelay, request, USE_MOCK, USE_SUPABASE } from './http'
import {
  sbAccountApi,
  sbAccountsApi,
  sbBudgetApi,
  sbCardsApi,
  sbCategoriesApi,
  sbGoalsApi,
  sbInstallmentsApi,
  sbInvoicesApi,
  sbRecurrencesApi,
  sbRulesApi,
  sbTransactionsApi,
} from './supabaseApi'
import { normalizeLabel } from '../data/categories'

/* ------------------------------------------------------------------ DTOs */

export type TransactionInput = Omit<Transaction, 'id'>
export type CardInput = Pick<Card, 'bank' | 'nickname' | 'last4' | 'limit' | 'openingInvoice' | 'dueDay'> & { color?: Card['color'] }
export type GoalInput = Omit<Goal, 'id' | 'startedAt' | 'initialSaved' | 'deposited'> & { featured?: boolean }

export interface ImportInvoiceInput {
  cardId: string | null
  /** Total impresso na fatura; vira a fatura atual do cartão */
  total: number
  fileName: string
  items: TransactionInput[]
}

export interface ImportInvoiceResult {
  invoice: InvoiceImport
  /** Cada lançamento volta com `invoiceId` = invoice.id */
  transactions: Transaction[]
  card: Card | null
}

/** Dados que o backend devolve no login / ao abrir o app. */
export type AccountSnapshot = Omit<AppState, 'user' | 'stage' | 'hideBalance'>

export type AccountInput = Omit<Account, 'id'>
export type RecurrenceInput = Omit<Recurrence, 'id' | 'lastRun'>
export type { InstallmentInput, OngoingInstallmentInput }

const snapshotOf = ({ user: _u, stage: _s, hideBalance: _h, ...rest }: AppState): AccountSnapshot => rest
const today = () => toISO(TODAY)

/* ------------------------------------------------------------- mock helpers */

const mock = async <T>(value: T, ms?: number): Promise<T> => {
  await mockDelay(ms)
  return value
}

/* ------------------------------------------------------------- contas */

const accountRest = {
  /** GET /api/me/snapshot — tudo que a Home, Cartões e Metas precisam. */
  snapshot: (fallback: AccountSnapshot): Promise<AccountSnapshot> =>
    USE_MOCK ? mock(fallback, 0) : request('GET', '/api/me/snapshot'),

  /** PATCH /api/me — nome, foto. */
  updateProfile: (patch: Partial<Pick<User, 'name' | 'avatar'>>): Promise<Partial<User>> =>
    USE_MOCK ? mock(patch) : request('PATCH', '/api/me', patch),

  /** PUT /api/me/balance — saldo informado hoje. O servidor recalcula o saldo inicial. */
  setBalance: (value: number): Promise<{ balance: number }> =>
    USE_MOCK ? mock({ balance: value }) : request('PUT', '/api/me/balance', { balance: value }),

  /** DELETE /api/me/data — apaga gastos, cartões, metas, depósitos, faturas, tetos e categorias. A conta continua. */
  clearData: (): Promise<void> => (USE_MOCK ? mock(undefined) : request('DELETE', '/api/me/data')),

  /** DELETE /api/me — exclui a conta e todos os dados dela. */
  deleteAccount: (): Promise<void> => (USE_MOCK ? mock(undefined, 500) : request('DELETE', '/api/me')),
}

/* ---------------------------------------------------------- transações */

const transactionsRest = {
  /** POST /api/transactions */
  create: (input: TransactionInput): Promise<Transaction> =>
    USE_MOCK ? mock({ ...input, id: uid() }) : request('POST', '/api/transactions', input),

  /** PUT /api/transactions/:id */
  update: (tx: Transaction): Promise<Transaction> =>
    USE_MOCK ? mock(tx) : request('PUT', `/api/transactions/${tx.id}`, tx),

  /** DELETE /api/transactions/:id */
  remove: (id: string): Promise<void> => (USE_MOCK ? mock(undefined) : request('DELETE', `/api/transactions/${id}`)),
}

/* --------------------------------------------------------------- fatura */

const invoicesRest = {
  /**
   * POST /api/invoices/import — grava os lançamentos confirmados.
   * O servidor deve ser idempotente por (cardId, fileName, total) para evitar duplicatas.
   */
  import: (input: ImportInvoiceInput, currentCard: Card | null, importedAt: string): Promise<ImportInvoiceResult> => {
    if (!USE_MOCK) return request('POST', '/api/invoices/import', input)
    const invoice: InvoiceImport = {
      id: `inv_${uid()}`,
      cardId: input.cardId,
      fileName: input.fileName,
      total: input.total,
      importedAt,
      previousInvoice: currentCard?.invoice ?? null,
    }
    return mock(
      {
        invoice,
        transactions: input.items.map((t) => ({ ...t, id: uid(), invoiceId: invoice.id })),
        card: currentCard ? { ...currentCard, invoice: input.total } : null,
      },
      500,
    )
  },

  /** GET /api/invoices — faturas importadas (mais recente primeiro). Já vem no snapshot. */
  list: (fallback: InvoiceImport[]): Promise<InvoiceImport[]> => (USE_MOCK ? mock(fallback, 0) : request('GET', '/api/invoices')),

  /**
   * DELETE /api/invoices/:id — desfaz a importação: apaga os lançamentos dela e
   * devolve ao cartão a fatura de antes (previousInvoice).
   */
  remove: (id: string): Promise<void> => (USE_MOCK ? mock(undefined) : request('DELETE', `/api/invoices/${id}`)),
}

/* -------------------------------------------------------------- cartões */

const cardsRest = {
  /** POST /api/cards */
  create: (input: CardInput): Promise<Card> =>
    USE_MOCK ? mock({ color: 'gradient', ...input, invoice: input.openingInvoice, startedOn: today(), id: uid() } as Card) : request('POST', '/api/cards', input),

  /** PUT /api/cards/:id */
  update: (card: Card): Promise<Card> => (USE_MOCK ? mock(card) : request('PUT', `/api/cards/${card.id}`, card)),

  /** DELETE /api/cards/:id — gastos do cartão passam para "Dinheiro" no servidor também. */
  remove: (id: string): Promise<void> => (USE_MOCK ? mock(undefined) : request('DELETE', `/api/cards/${id}`)),

  /** PUT /api/cards/order — ordem da carteira (último = frente). Não bloqueia a UI. */
  reorder: (order: string[]): Promise<void> => (USE_MOCK ? mock(undefined, 0) : request('PUT', '/api/cards/order', { order })),
}

/* ---------------------------------------------------------------- metas */

const goalsRest = {
  /** POST /api/goals */
  create: ({ featured, ...input }: GoalInput, startedAt: string): Promise<Goal> =>
    USE_MOCK
      ? mock({ ...input, id: uid(), startedAt, initialSaved: input.saved, deposited: 0 })
      : request('POST', '/api/goals', { ...input, featured }),

  /** PUT /api/goals/:id */
  update: (goal: Goal & { featured?: boolean }): Promise<Goal> =>
    USE_MOCK ? mock(goal) : request('PUT', `/api/goals/${goal.id}`, goal),

  /** DELETE /api/goals/:id */
  remove: (id: string): Promise<void> => (USE_MOCK ? mock(undefined) : request('DELETE', `/api/goals/${id}`)),

  /** POST /api/goals/:id/deposits — { amount, date }. O servidor soma em saved e deposited. */
  deposit: (goalId: string, amount: number, date: string): Promise<GoalDeposit> =>
    USE_MOCK ? mock({ id: uid(), goalId, amount, date }) : request('POST', `/api/goals/${goalId}/deposits`, { amount, date }),

  /** GET /api/goals/:id/deposits — histórico (mais recente primeiro). Já vem no snapshot. */
  deposits: (goalId: string, fallback: GoalDeposit[]): Promise<GoalDeposit[]> =>
    USE_MOCK ? mock(fallback, 0) : request('GET', `/api/goals/${goalId}/deposits`),

  /** PUT /api/goals/:id/deposits/:depositId — corrige valor ou data. O servidor aplica a diferença na meta. */
  updateDeposit: (deposit: GoalDeposit): Promise<GoalDeposit> =>
    USE_MOCK ? mock(deposit) : request('PUT', `/api/goals/${deposit.goalId}/deposits/${deposit.id}`, deposit),

  /** DELETE /api/goals/:id/deposits/:depositId — o valor sai da meta. */
  removeDeposit: (deposit: GoalDeposit): Promise<void> =>
    USE_MOCK ? mock(undefined) : request('DELETE', `/api/goals/${deposit.goalId}/deposits/${deposit.id}`),
}

/* ------------------------------------------------------------- orçamento */

const budgetRest = {
  /** PUT /api/budget — teto do mês */
  setTotal: (total: number): Promise<Pick<Budget, 'total'>> =>
    USE_MOCK ? mock({ total }) : request('PUT', '/api/budget', { total }),

  /** DELETE /api/budget — remove o teto do mês (total volta a 0). Os tetos por categoria continuam. */
  removeTotal: (): Promise<void> => (USE_MOCK ? mock(undefined) : request('DELETE', '/api/budget')),

  /** PUT /api/budget/caps/:category */
  setCap: (category: CategoryId, value: number): Promise<{ category: CategoryId; value: number }> =>
    USE_MOCK ? mock({ category, value }) : request('PUT', `/api/budget/caps/${category}`, { value }),

  /** DELETE /api/budget/caps/:category */
  removeCap: (category: CategoryId): Promise<void> =>
    USE_MOCK ? mock(undefined) : request('DELETE', `/api/budget/caps/${category}`),

  /** PUT /api/budget/caps/:category/alert — { enabled, percent } */
  setCapAlert: (category: CategoryId, alert: CapAlert): Promise<{ category: CategoryId; alert: CapAlert }> =>
    USE_MOCK ? mock({ category, alert }) : request('PUT', `/api/budget/caps/${category}/alert`, alert),
}

/* --------------------------------------------------------------- contas */

const accountsRest = {
  /** POST /api/accounts */
  create: (input: AccountInput): Promise<Account> => (USE_MOCK ? mock({ ...input, id: `a_${uid()}` }) : request('POST', '/api/accounts', input)),
  /** PUT /api/accounts/:id */
  update: (account: Account): Promise<Account> => (USE_MOCK ? mock(account) : request('PUT', `/api/accounts/${account.id}`, account)),
  /** DELETE /api/accounts/:id — lançamentos, recorrências e saldo inicial passam para a conta mais antiga que sobrar. */
  remove: (id: string): Promise<void> => (USE_MOCK ? mock(undefined) : request('DELETE', `/api/accounts/${id}`)),
}

/* ---------------------------------------------------------- recorrências */

const recurrencesRest = {
  /** POST /api/recurrences — cria a regra e já gera o que venceu. Devolve os dados atualizados. */
  create: (input: RecurrenceInput, current: AppState): Promise<AccountSnapshot> =>
    USE_MOCK
      ? mock(snapshotOf(processDueLocal({ ...current, recurrences: [...current.recurrences, { ...input, id: `r_${uid()}` }] }, today())))
      : request('POST', '/api/recurrences', input),
  /** PUT /api/recurrences/:id — vale daqui para frente; lançamentos já gerados não mudam. */
  update: (rec: Recurrence, current: AppState): Promise<AccountSnapshot> =>
    USE_MOCK
      ? mock(snapshotOf(processDueLocal({ ...current, recurrences: current.recurrences.map((r) => (r.id === rec.id ? rec : r)) }, today())))
      : request('PUT', `/api/recurrences/${rec.id}`, rec),
  /** DELETE /api/recurrences/:id — os lançamentos já gerados continuam. */
  remove: (id: string): Promise<void> => (USE_MOCK ? mock(undefined) : request('DELETE', `/api/recurrences/${id}`)),
}

/* -------------------------------------------------------------- parcelas */

const installmentsRest = {
  /** PUT /api/installments — cria ou substitui (input.group) uma compra parcelada. Devolve os dados atualizados. */
  save: (input: InstallmentInput, current: AppState): Promise<AccountSnapshot> => {
    if (!USE_MOCK) return request('PUT', '/api/installments', input)
    const t = today()
    const old = input.group ? current.transactions.filter((x) => x.installment?.group === input.group) : []
    const fresh = buildInstallments(input, t)
    let cards = old.reduce((c, x) => adjustInvoice(c, x, -1, t), current.cards)
    cards = fresh.reduce((c, x) => adjustInvoice(c, x, 1, t), cards)
    const transactions = [...fresh, ...current.transactions.filter((x) => !old.includes(x))].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    return mock(snapshotOf({ ...current, cards, transactions }))
  },
  /** POST /api/installments/ongoing — compra parcelada que começou antes do Okiva (da parcela atual em diante). */
  saveOngoing: (input: OngoingInstallmentInput, current: AppState): Promise<AccountSnapshot> => {
    if (!USE_MOCK) return request('POST', '/api/installments/ongoing', input)
    const t = today()
    const fresh = buildOngoingInstallments(input, current.cards.find((c) => c.id === input.cardId), t)
    // Importação: o total lido já virou a fatura; parcelas com invoiceId não somam ao entrar (igual ao banco)
    const cards = fresh.filter((x) => !x.invoiceId).reduce((c, x) => adjustInvoice(c, x, 1, t), current.cards)
    const transactions = [...fresh, ...current.transactions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    return mock(snapshotOf({ ...current, cards, transactions }))
  },
  /** PATCH /api/installments/:group — muda nome, categoria e valor da parcela em todas as parcelas (compra em andamento). */
  updateGroup: (group: string, patch: { name: string; category: CategoryId | null; amount: number }, current: AppState): Promise<AccountSnapshot> => {
    if (!USE_MOCK) return request('PATCH', `/api/installments/${group}`, patch)
    const t = today()
    const old = current.transactions.filter((x) => x.installment?.group === group)
    const fresh = old.map((x) => ({ ...x, name: patch.name, category: patch.category, amount: round2(patch.amount) }))
    let cards = old.reduce((c, x) => adjustInvoice(c, x, -1, t), current.cards)
    cards = fresh.reduce((c, x) => adjustInvoice(c, x, 1, t), cards)
    const byId = new Map(fresh.map((x) => [x.id, x]))
    return mock(snapshotOf({ ...current, cards, transactions: current.transactions.map((x) => byId.get(x.id) ?? x) }))
  },
  /** DELETE /api/installments/:group — apaga todas as parcelas da compra. */
  remove: (group: string): Promise<void> => (USE_MOCK ? mock(undefined) : request('DELETE', `/api/installments/${group}`)),
}

/* ------------------------------------------------- regras aprendidas */

const rulesRest = {
  /** PUT /api/category-rules — { pattern, category }. O servidor normaliza o nome; um nome tem uma regra só. */
  save: (pattern: string, category: CategoryId, existingId?: string): Promise<CategoryRule> =>
    USE_MOCK ? mock({ id: existingId ?? `rule_${uid()}`, pattern: normalizeLabel(pattern), category }) : request('PUT', '/api/category-rules', { pattern, category }),
  /** DELETE /api/category-rules/:id */
  remove: (id: string): Promise<void> => (USE_MOCK ? mock(undefined) : request('DELETE', `/api/category-rules/${id}`)),
}

/* ------------------------------------------------------------ categorias */

export type CategoryInput = Omit<CustomCategory, 'id'>

const categoriesRest = {
  /** POST /api/categories — categoria criada pela pessoa. O servidor recusa nome repetido (409). */
  create: (input: CategoryInput): Promise<CustomCategory> =>
    USE_MOCK ? mock({ ...input, id: `c_${uid()}` }) : request('POST', '/api/categories', input),

  /** PUT /api/categories/:id — renomeia (mesma regra de nome único). */
  update: (category: CustomCategory): Promise<CustomCategory> =>
    USE_MOCK ? mock(category) : request('PUT', `/api/categories/${category.id}`, category),

  /** DELETE /api/categories/:id?moveTo= — os gastos dela passam para `moveTo` (sem moveTo = ficam sem categoria) e o teto dela é removido. */
  remove: (id: CategoryId, moveTo?: CategoryId | null): Promise<void> =>
    USE_MOCK ? mock(undefined) : request('DELETE', `/api/categories/${id}${moveTo ? `?moveTo=${encodeURIComponent(moveTo)}` : ''}`),

  /** POST /api/transactions/recategorize — move gastos para outra categoria (null = sem categoria). */
  recategorize: (ids: string[], category: CategoryId | null): Promise<void> =>
    USE_MOCK ? mock(undefined, 0) : request('POST', '/api/transactions/recategorize', { ids, category }),
}

/* ------------------------------------------------- fonte de dados ativa */

// Com o Supabase configurado (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY) as telas usam o banco real;
// senão, mock local ou API HTTP (mesmas assinaturas).
export const accountApi: typeof accountRest = USE_SUPABASE ? sbAccountApi : accountRest
export const transactionsApi: typeof transactionsRest = USE_SUPABASE ? sbTransactionsApi : transactionsRest
export const invoicesApi: typeof invoicesRest = USE_SUPABASE ? sbInvoicesApi : invoicesRest
export const cardsApi: typeof cardsRest = USE_SUPABASE ? sbCardsApi : cardsRest
export const goalsApi: typeof goalsRest = USE_SUPABASE ? sbGoalsApi : goalsRest
export const budgetApi: typeof budgetRest = USE_SUPABASE ? sbBudgetApi : budgetRest
export const categoriesApi: typeof categoriesRest = USE_SUPABASE ? sbCategoriesApi : categoriesRest
export const accountsApi: typeof accountsRest = USE_SUPABASE ? sbAccountsApi : accountsRest
export const recurrencesApi: typeof recurrencesRest = USE_SUPABASE ? sbRecurrencesApi : recurrencesRest
export const installmentsApi: typeof installmentsRest = USE_SUPABASE ? sbInstallmentsApi : installmentsRest
export const rulesApi: typeof rulesRest = USE_SUPABASE ? sbRulesApi : rulesRest
