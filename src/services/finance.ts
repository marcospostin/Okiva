/**
 * Okiva — serviço de dados financeiros.
 *
 * Toda escrita das telas passa por aqui. Com `VITE_USE_MOCK` (padrão) as funções
 * respondem localmente, com latência simulada e o MESMO formato que o backend deve
 * devolver. Com `VITE_USE_MOCK=false` cada função chama a rota REST indicada.
 *
 * Contrato completo (rotas, payloads, erros): docs/integracao-backend.md
 */
import { uid } from '../lib/format'
import type { AppState, Budget, Card, CategoryId, CustomCategory, Goal, GoalDeposit, InvoiceImport, Transaction, User } from '../types'
import { mockDelay, request, USE_MOCK, USE_SUPABASE } from './http'
import { sbAccountApi, sbBudgetApi, sbCardsApi, sbCategoriesApi, sbGoalsApi, sbInvoicesApi, sbTransactionsApi } from './supabaseApi'

/* ------------------------------------------------------------------ DTOs */

export type TransactionInput = Omit<Transaction, 'id'>
export type CardInput = Pick<Card, 'nickname' | 'last4' | 'limit' | 'invoice' | 'dueDay'> & { color?: Card['color'] }
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
    USE_MOCK ? mock({ color: 'gradient', ...input, id: uid() } as Card) : request('POST', '/api/cards', input),

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

  /** DELETE /api/categories/:id — os lançamentos dela passam para "outros" e o teto dela é removido. */
  remove: (id: string): Promise<void> => (USE_MOCK ? mock(undefined) : request('DELETE', `/api/categories/${id}`)),

  /** POST /api/transactions/recategorize — move lançamentos para outra categoria (sugestão aceita). */
  recategorize: (ids: string[], category: CategoryId): Promise<void> =>
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
