import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react'
import { USE_SUPABASE } from '../services/http'
import { normalizeLabel, SUGGESTED_CATEGORIES } from '../data/categories'
import { savePrefs } from '../services/supabaseApi'
import { DEMO_USER, initialState, TODAY } from '../data/mock'
import { restoreSession, sessionEmail, signOut } from '../services/auth'
import { monthKey, toISO } from '../lib/format'
import { accountEffect, adjustInvoice, balanceEffect, ensureAccounts, isExpense, kindOf, processDueLocal, round2 } from '../lib/ledger'
import type { Account, AppState, Budget, CapAlert, Card, CategoryId, CategoryRule, CustomCategory, Goal, GoalDeposit, InvoiceImport, NotificationPrefs, Recurrence, Stage, Transaction, User } from '../types'

/** Each account keeps its own data: okiva:data:<email> */
const dataKey = (email: string) => `okiva:data:${email}`
/** Single-user saves from earlier prototype versions */
const LEGACY_KEYS = ['okiva:v2', 'eskgo:v1']

type Action =
  | { type: 'hydrate'; state: AppState }
  | { type: 'logout' }
  | { type: 'setBalance'; value: number }
  | { type: 'removeCap'; category: CategoryId }
  | { type: 'deleteGoal'; id: string }
  | { type: 'clearData' }
  | { type: 'setAvatar'; avatar?: string }
  | { type: 'setStage'; stage: Stage }
  | { type: 'toggleHide' }
  /** Entities arrive with the id the server (or the mock) gave them */
  | { type: 'addTx'; tx: Transaction }
  | { type: 'updateTx'; tx: Transaction }
  | { type: 'deleteTx'; id: string }
  | { type: 'importInvoice'; txs: Transaction[]; card: Card | null; invoice: InvoiceImport }
  /** Removes an imported invoice and every expense that came from it */
  | { type: 'undoInvoice'; id: string }
  | { type: 'setName'; name: string }
  | { type: 'updateDeposit'; deposit: GoalDeposit }
  | { type: 'deleteDeposit'; id: string }
  /** Removes a category: its expenses go to `moveTo` (null/ausente = sem categoria), recurrences to `moveTo` or "outros" */
  | { type: 'deleteCategory'; id: string; moveTo?: CategoryId | null }
  /** Regra aprendida "sempre usar X para este nome" (cria ou troca a categoria) */
  | { type: 'saveRule'; rule: CategoryRule }
  | { type: 'deleteRule'; id: string }
  | { type: 'saveCard'; card: Card }
  | { type: 'deleteCard'; id: string }
  | { type: 'cycleCards' }
  | { type: 'saveGoal'; goal: Goal; featured?: boolean }
  | { type: 'deposit'; deposit: GoalDeposit }
  | { type: 'feature'; goalId: string }
  | { type: 'setCap'; category: CategoryId; value: number }
  | { type: 'setBudgetTotal'; value: number }
  /** Adds (or updates) a category the person created */
  | { type: 'addCategory'; category: CustomCategory }
  /** Moves expenses into another category (a suggestion built from their names) */
  | { type: 'recategorize'; ids: string[]; category: CategoryId }
  | { type: 'reset' }
  /** Dados recarregados do servidor (ou recalculados no mock) depois de parcelas/recorrências */
  | { type: 'sync'; snapshot: Partial<AppState> }
  | { type: 'saveAccount'; account: Account }
  /** Lançamentos, recorrências e saldo inicial da conta passam para a primeira conta que sobrar */
  | { type: 'deleteAccount'; id: string }
  | { type: 'saveRecurrence'; recurrence: Recurrence }
  /** Os lançamentos já gerados continuam; só deixam de estar ligados à regra */
  | { type: 'deleteRecurrence'; id: string }
  /** Apaga todas as parcelas de uma compra */
  | { type: 'deleteGroup'; group: string }
  | { type: 'setCapAlert'; category: CategoryId; alert: CapAlert }
  | { type: 'setNotifications'; prefs: NotificationPrefs }

/** Keeps a card's invoice in sync: posted card expenses add, invoice payments subtract. */
const invoiceOf = (cards: Card[], tx: Transaction, sign: 1 | -1) => adjustInvoice(cards, tx, sign, todayISO())

/** A deposit changes both the saved amount and the deposit total that drives the monthly average. */
function addToGoal(goals: Goal[], goalId: string, delta: number) {
  return goals.map((g) =>
    g.id === goalId ? { ...g, saved: Math.max(0, g.saved + delta), deposited: Math.max(0, (g.deposited ?? 0) + delta) } : g,
  )
}

const byDateDesc = (a: { date: string }, b: { date: string }) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'hydrate':
      return action.state
    case 'logout':
      return LOGGED_OUT
    case 'setBalance': {
      // A diferença entra no saldo inicial da primeira conta (mesma regra de set_balance no banco)
      const withAccount = ensureAccounts(state)
      const diff = action.value - balanceOf(withAccount)
      const [first, ...rest] = withAccount.accounts
      return { ...withAccount, accounts: [{ ...first, startingBalance: round2(first.startingBalance + diff) }, ...rest] }
    }
    case 'removeCap': {
      const caps = { ...state.budget.caps }
      delete caps[action.category]
      const alerts = { ...state.budget.alerts }
      delete alerts[action.category]
      return { ...state, budget: { ...state.budget, caps, alerts } }
    }
    case 'deleteGoal': {
      const goals = state.goals.filter((g) => g.id !== action.id)
      const featuredGoalId = state.featuredGoalId === action.id ? (goals[0]?.id ?? '') : state.featuredGoalId
      return { ...state, goals, featuredGoalId, deposits: state.deposits.filter((d) => d.goalId !== action.id) }
    }
    case 'setName':
      return state.user ? { ...state, user: { ...state.user, name: action.name } } : state
    case 'setAvatar':
      return state.user ? { ...state, user: { ...state.user, avatar: action.avatar } } : state
    case 'clearData':
      return state.user ? { ...emptyState(state.user, 0), stage: state.stage, hideBalance: state.hideBalance } : state
    case 'setStage':
      return { ...state, stage: action.stage }
    case 'toggleHide':
      return { ...state, hideBalance: !state.hideBalance }
    case 'addTx': {
      const tx = action.tx
      return { ...state, transactions: [tx, ...state.transactions], cards: invoiceOf(state.cards, tx, 1) }
    }
    case 'updateTx': {
      const prev = state.transactions.find((t) => t.id === action.tx.id)
      if (!prev) return state
      const cards = invoiceOf(invoiceOf(state.cards, prev, -1), action.tx, 1)
      return { ...state, cards, transactions: state.transactions.map((t) => (t.id === prev.id ? action.tx : t)) }
    }
    case 'deleteTx': {
      const prev = state.transactions.find((t) => t.id === action.id)
      if (!prev) return state
      return {
        ...state,
        transactions: state.transactions.filter((t) => t.id !== action.id),
        cards: invoiceOf(state.cards, prev, -1),
      }
    }
    case 'deleteGroup': {
      const gone = state.transactions.filter((t) => t.installment?.group === action.group)
      return {
        ...state,
        transactions: state.transactions.filter((t) => t.installment?.group !== action.group),
        cards: gone.reduce((cards, t) => invoiceOf(cards, t, -1), state.cards),
      }
    }
    case 'sync':
      return { ...state, ...action.snapshot }
    case 'saveAccount': {
      const a = action.account
      const exists = state.accounts.some((x) => x.id === a.id)
      return { ...state, accounts: exists ? state.accounts.map((x) => (x.id === a.id ? a : x)) : [...state.accounts, a] }
    }
    case 'deleteAccount': {
      const gone = state.accounts.find((a) => a.id === action.id)
      if (!gone) return state
      const rest = state.accounts.filter((a) => a.id !== action.id)
      // Subconta devolve tudo para a conta mãe; conta principal, para a primeira principal que sobrar
      const target = gone.parentId ? rest.find((a) => a.id === gone.parentId) : rest.find((a) => !a.parentId)
      if (!target) return { ...state, accounts: rest }
      const between = (t: Transaction) =>
        kindOf(t) === 'transfer' &&
        ((t.accountId === gone.id && t.transferAccountId === target.id) || (t.accountId === target.id && t.transferAccountId === gone.id))
      const move = <T extends { accountId?: string }>(x: T): T => (x.accountId === gone.id ? { ...x, accountId: target.id } : x)
      return {
        ...state,
        accounts: rest.map((a) => (a.id === target.id ? { ...a, startingBalance: round2(a.startingBalance + gone.startingBalance) } : a)),
        transactions: state.transactions
          .filter((t) => !between(t))
          .map((t) => move(t.transferAccountId === gone.id ? { ...t, transferAccountId: target.id } : t)),
        recurrences: state.recurrences.map(move),
      }
    }
    case 'saveRecurrence': {
      const r = action.recurrence
      const exists = state.recurrences.some((x) => x.id === r.id)
      return { ...state, recurrences: exists ? state.recurrences.map((x) => (x.id === r.id ? r : x)) : [...state.recurrences, r] }
    }
    case 'deleteRecurrence':
      return {
        ...state,
        recurrences: state.recurrences.filter((r) => r.id !== action.id),
        transactions: state.transactions.map((t) => (t.recurrenceId === action.id ? { ...t, recurrenceId: undefined } : t)),
      }
    case 'saveRule': {
      const r = action.rule
      const rest = state.categoryRules.filter((x) => x.id !== r.id && x.pattern !== r.pattern)
      return { ...state, categoryRules: [...rest, r] }
    }
    case 'deleteRule':
      return { ...state, categoryRules: state.categoryRules.filter((r) => r.id !== action.id) }
    case 'setNotifications':
      return { ...state, notificationPrefs: action.prefs }
    case 'setCapAlert':
      return { ...state, budget: { ...state.budget, alerts: { ...state.budget.alerts, [action.category]: action.alert } } }
    case 'importInvoice': {
      const card = action.card
      return {
        ...state,
        transactions: [...action.txs, ...state.transactions],
        // The invoice read by the AI replaces the typed invoice value
        cards: card ? state.cards.map((c) => (c.id === card.id ? card : c)) : state.cards,
        invoices: [action.invoice, ...state.invoices],
      }
    }
    case 'undoInvoice': {
      const inv = state.invoices.find((i) => i.id === action.id)
      if (!inv) return state
      return {
        ...state,
        transactions: state.transactions.filter((t) => t.invoiceId !== inv.id),
        // The card goes back to the invoice value it had before the import
        cards: state.cards.map((c) => (c.id === inv.cardId && inv.previousInvoice !== null ? { ...c, invoice: inv.previousInvoice } : c)),
        invoices: state.invoices.filter((i) => i.id !== inv.id),
      }
    }
    case 'saveCard': {
      const card = action.card
      if (state.cards.some((c) => c.id === card.id)) {
        return { ...state, cards: state.cards.map((c) => (c.id === card.id ? card : c)) }
      }
      // New cards go to the front of the wallet (colors follow stack position on screen)
      return { ...state, cards: [...state.cards, card], cardOrder: [...state.cardOrder, card.id] }
    }
    case 'deleteCard':
      return {
        ...state,
        cards: state.cards.filter((c) => c.id !== action.id),
        cardOrder: state.cardOrder.filter((id) => id !== action.id),
        transactions: state.transactions
          // Ajuste da fatura só valia para este cartão
          .filter((t) => !(kindOf(t) === 'adjustment' && t.method.type === 'card' && t.method.cardId === action.id))
          .map((t) =>
            t.method.type === 'card' && t.method.cardId === action.id
              ? { ...t, kind: kindOf(t) === 'invoice_payment' ? 'expense' : t.kind, method: { type: 'cash' } }
              : t,
          ),
        recurrences: state.recurrences.map((r) => (r.method.type === 'card' && r.method.cardId === action.id ? { ...r, method: { type: 'cash' } } : r)),
        // Imported invoices stay in the history, no longer tied to a card
        invoices: state.invoices.map((i) => (i.cardId === action.id ? { ...i, cardId: null, previousInvoice: null } : i)),
      }
    case 'cycleCards': {
      if (state.cardOrder.length < 2) return state
      const front = state.cardOrder[state.cardOrder.length - 1]
      return { ...state, cardOrder: [front, ...state.cardOrder.slice(0, -1)] }
    }
    case 'saveGoal': {
      // Only one main goal exists: featuring a goal moves the previous one to the secondary list.
      const goal = action.goal
      const featuredGoalId = action.featured ? goal.id : state.featuredGoalId
      if (state.goals.some((g) => g.id === goal.id)) {
        return {
          ...state,
          goals: state.goals.map((g) => {
            if (g.id !== goal.id) return g
            // Editing "Já guardado" changes the starting amount, never the deposit history
            const deposited = g.deposited ?? 0
            return { ...g, ...goal, deposited, initialSaved: Math.max(0, goal.saved - deposited) }
          }),
          featuredGoalId,
        }
      }
      // The amount typed on creation is what the person already had: average starts at zero
      return { ...state, goals: [...state.goals, goal], featuredGoalId }
    }
    case 'deposit': {
      const d = action.deposit
      return { ...state, goals: addToGoal(state.goals, d.goalId, d.amount), deposits: [d, ...state.deposits] }
    }
    case 'updateDeposit': {
      const prev = state.deposits.find((d) => d.id === action.deposit.id)
      if (!prev) return state
      const d = action.deposit
      return {
        ...state,
        goals: addToGoal(state.goals, d.goalId, d.amount - prev.amount),
        deposits: state.deposits.map((x) => (x.id === d.id ? d : x)).sort(byDateDesc),
      }
    }
    case 'deleteDeposit': {
      const prev = state.deposits.find((d) => d.id === action.id)
      if (!prev) return state
      return { ...state, goals: addToGoal(state.goals, prev.goalId, -prev.amount), deposits: state.deposits.filter((d) => d.id !== prev.id) }
    }
    case 'deleteCategory': {
      const caps = { ...state.budget.caps }
      delete caps[action.id]
      return {
        ...state,
        customCategories: state.customCategories.filter((c) => c.id !== action.id),
        transactions: state.transactions.map((t) => (t.category === action.id && isExpense(t) ? { ...t, category: action.moveTo ?? null } : t)),
        recurrences: state.recurrences.map((r) => (r.category === action.id && r.kind === 'expense' ? { ...r, category: action.moveTo ?? 'outros' } : r)),
        categoryRules: state.categoryRules.filter((r) => r.category !== action.id),
        budget: { ...state.budget, caps },
      }
    }
    case 'feature':
      return { ...state, featuredGoalId: action.goalId }
    case 'setCap':
      return { ...state, budget: { ...state.budget, caps: { ...state.budget.caps, [action.category]: action.value } } }
    case 'setBudgetTotal':
      return { ...state, budget: { ...state.budget, total: action.value } }
    case 'addCategory': {
      const c = action.category
      const exists = state.customCategories.some((x) => x.id === c.id)
      return {
        ...state,
        customCategories: exists ? state.customCategories.map((x) => (x.id === c.id ? c : x)) : [...state.customCategories, c],
      }
    }
    case 'recategorize': {
      const ids = new Set(action.ids)
      return { ...state, transactions: state.transactions.map((t) => (ids.has(t.id) ? { ...t, category: action.category } : t)) }
    }
    case 'reset':
      return { ...initialState, user: state.user, stage: state.stage }
  }
}

const LOGGED_OUT: AppState = { ...initialState, user: null }

/** A brand-new account: nothing typed yet, so every screen shows its empty state. */
export function emptyState(user: User, balance: number): AppState {
  return {
    ...initialState,
    user,
    startingBalance: 0,
    transactions: [],
    accounts: [{ id: `a_${Date.now().toString(36)}`, name: 'Principal', kind: 'checking', startingBalance: balance }],
    recurrences: [],
    cards: [],
    cardOrder: [],
    goals: [],
    featuredGoalId: '',
    budget: { total: 0, caps: {} },
    customCategories: SUGGESTED_CATEGORIES,
    categoriesSeeded: true,
    categoryRules: [],
    deposits: [],
    invoices: [],
  }
}

function parseState(raw: string): AppState {
  const saved = { ...initialState, ...JSON.parse(raw) } as AppState
  // Saves made before custom categories existed
  saved.customCategories = saved.customCategories ?? []
  // Saves made when the app's categories were fixed: they become the person's (editable) categories
  if (!saved.categoriesSeeded) {
    const missing = SUGGESTED_CATEGORIES.filter((s) => !saved.customCategories.some((c) => c.id === s.id || normalizeLabel(c.label) === normalizeLabel(s.label)))
    saved.customCategories = [...missing, ...saved.customCategories]
    saved.categoriesSeeded = true
  }
  saved.invoices = saved.invoices ?? []
  saved.recurrences = saved.recurrences ?? []
  saved.categoryRules = saved.categoryRules ?? []
  saved.notificationPrefs = { ...initialState.notificationPrefs, ...saved.notificationPrefs }
  // Saves made before the deposit history: example goals get their example deposits
  saved.deposits = saved.deposits ?? initialState.deposits.filter((d) => saved.goals.some((g) => g.id === d.goalId && g.deposited === initialState.goals.find((x) => x.id === g.id)?.deposited))
  // Saves made before deposit tracking: example goals get the new realistic data,
  // goals created by hand treat everything saved so far as the starting amount.
  saved.goals = saved.goals.map((g) => {
    if (g.deposited !== undefined) return g
    const example = initialState.goals.find((x) => x.id === g.id)
    return example ?? { ...g, startedAt: g.startedAt ?? currentMonth(), initialSaved: g.saved, deposited: 0 }
  })
  // Saves made before accounts: the "Principal" account keeps the shown balance; due items are generated
  return processDueLocal(ensureAccounts(saved), todayISO())
}

/** Data for a signed-in account: saved data, demo examples, or an empty start. */
export function accountState(user: User, opts: { balance?: number } = {}): AppState {
  const raw = localStorage.getItem(dataKey(user.email))
  if (raw) return { ...parseState(raw), user }
  if (user.email === DEMO_USER.email) return processDueLocal({ ...initialState, user }, todayISO())
  return emptyState(user, opts.balance ?? 0)
}

function migrateLegacy() {
  for (const key of LEGACY_KEYS) {
    const raw = localStorage.getItem(key)
    if (!raw) continue
    localStorage.removeItem(key)
    try {
      const old = parseState(raw)
      if (old.user && !localStorage.getItem(dataKey(old.user.email))) {
        localStorage.setItem(dataKey(old.user.email), JSON.stringify(old))
        restoreSession(old.user)
      }
    } catch {
      /* ignore corrupted legacy data */
    }
  }
}

function load(): AppState {
  // Supabase: a conta vem do banco depois de restaurar a sessão (App.tsx)
  if (USE_SUPABASE) return LOGGED_OUT
  try {
    migrateLegacy()
    const email = sessionEmail()
    const raw = email ? localStorage.getItem(dataKey(email)) : null
    if (raw) return parseState(raw)
    if (email === DEMO_USER.email) return processDueLocal({ ...initialState, user: DEMO_USER }, todayISO())
    if (email) signOut()
  } catch {
    /* ignore corrupted storage */
  }
  return LOGGED_OUT
}

/** Deletes the saved data of an account from this browser (account deletion). */
export function forgetAccountData(email: string) {
  localStorage.removeItem(dataKey(email))
}

interface StoreValue {
  state: AppState
  dispatch: React.Dispatch<Action>
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load)
  useEffect(() => {
    // Supabase guarda tudo no banco; o protótipo guarda neste navegador
    if (!USE_SUPABASE && state.user) localStorage.setItem(dataKey(state.user.email), JSON.stringify(state))
  }, [state])

  // Okiva Plus e "Ocultar saldo" mudam direto no store: no Supabase, salvos no perfil
  const prefs = useRef<string | null>(null)
  useEffect(() => {
    if (!USE_SUPABASE || !state.user) {
      prefs.current = null
      return
    }
    const key = `${state.stage}|${state.hideBalance}`
    if (prefs.current === null) {
      prefs.current = key
      return
    }
    if (prefs.current === key) return
    prefs.current = key
    savePrefs({ stage: state.stage, hideBalance: state.hideBalance }).catch(() => undefined)
  }, [state.stage, state.hideBalance, state.user])
  const value = useMemo(() => ({ state, dispatch }), [state])
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}

/* ---------------------------------------------------------------- selectors */

export const todayISO = () => toISO(TODAY)
export const currentMonth = () => monthKey(todayISO())

export function previousMonth(key: string) {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Saldo de hoje: soma das contas (gasto no cartão só sai ao pagar a fatura). */
export function balanceOf(state: AppState) {
  const today = todayISO()
  const starts = (state.accounts ?? []).reduce((s, a) => s + a.startingBalance, 0)
  return round2((state.startingBalance ?? 0) + starts + state.transactions.reduce((s, t) => s + balanceEffect(t, today), 0))
}

/** Saldo de uma conta (só ela, sem as subcontas). Lançamentos sem conta (dados antigos) contam na primeira. */
export function accountBalance(state: AppState, accountId: string) {
  const today = todayISO()
  const account = state.accounts.find((a) => a.id === accountId)
  if (!account) return 0
  const first = state.accounts[0]?.id
  return round2(account.startingBalance + accountTransactions(state, accountId).reduce((s, t) => s + accountEffect(t, accountId, first, today), 0))
}

/** Saldo da conta somando as subcontas (o número grande do cartão da conta). */
export function accountTotal(state: AppState, accountId: string) {
  return round2(accountBalance(state, accountId) + subaccounts(state, accountId).reduce((s, a) => s + accountBalance(state, a.id), 0))
}

/** Contas principais (sem as subcontas), na ordem salva. */
export const topAccounts = (state: AppState) => state.accounts.filter((a) => !a.parentId)

/** Subcontas (poupança, caixinhas…) de uma conta. */
export const subaccounts = (state: AppState, accountId: string) => state.accounts.filter((a) => a.parentId === accountId)

/** Lançamentos que movimentaram a conta (mais recentes primeiro). Gasto e ajuste no cartão não passam pela conta. */
export function accountTransactions(state: AppState, accountId: string) {
  const first = state.accounts[0]?.id
  return state.transactions
    .filter((t) => {
      const k = kindOf(t)
      if (k === 'transfer') return t.transferAccountId === accountId || (t.accountId ?? first) === accountId
      if ((k === 'expense' || k === 'adjustment') && t.method.type === 'card') return false
      return (t.accountId ?? first) === accountId
    })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

export function accountName(state: AppState, id?: string) {
  return state.accounts.find((a) => a.id === id)?.name ?? state.accounts[0]?.name ?? 'Conta'
}

/** "Nubank · Caixinha 01" para subconta; o nome sozinho para conta principal. */
export function accountLabel(state: AppState, id?: string) {
  const a = state.accounts.find((x) => x.id === id)
  if (!a) return accountName(state, id)
  const parent = a.parentId ? state.accounts.find((x) => x.id === a.parentId) : undefined
  return parent ? `${parent.name} · ${a.name}` : a.name
}

export interface MonthSummary {
  key: string
  /** Só gastos (o que conta no teto) */
  total: number
  previousTotal: number
  /** Só gastos com categoria */
  byCategory: { category: CategoryId; amount: number }[]
  /** Gastos do mês ainda sem categoria (contam no total, em nenhum teto) */
  uncategorized: number
  /** Tudo que aconteceu no mês: gastos, receitas e pagamentos de fatura */
  transactions: Transaction[]
  income: number
  /** Mês que ainda não chegou: tudo nele é previsto (parcelas) */
  future: boolean
}

export function monthSummary(state: AppState, key: string): MonthSummary {
  const txs = state.transactions
    .filter((t) => monthKey(t.date) === key)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  const expenses = txs.filter(isExpense)
  const prevKey = previousMonth(key)
  const previousTotal = state.transactions
    .filter((t) => isExpense(t) && monthKey(t.date) === prevKey)
    .reduce((s, t) => s + t.amount, 0)
  const map = new Map<CategoryId, number>()
  for (const t of expenses) if (t.category !== null) map.set(t.category, (map.get(t.category) ?? 0) + t.amount)
  const byCategory = [...map.entries()]
    .map(([category, amount]) => ({ category, amount: round2(amount) }))
    .sort((a, b) => b.amount - a.amount)
  return {
    key,
    total: round2(expenses.reduce((s, t) => s + t.amount, 0)),
    previousTotal: round2(previousTotal),
    byCategory,
    uncategorized: round2(expenses.filter((t) => t.category === null).reduce((s, t) => s + t.amount, 0)),
    transactions: txs,
    income: round2(txs.filter((t) => kindOf(t) === 'income').reduce((s, t) => s + t.amount, 0)),
    future: key > currentMonth(),
  }
}

/** Meses com lançamento + o atual. Meses futuros aparecem só se já têm parcelas. Mais recente primeiro. */
export function availableMonths(state: AppState) {
  const set = new Set(state.transactions.map((t) => monthKey(t.date)))
  set.add(currentMonth())
  return [...set].sort().reverse()
}

/** Gastos sem categoria (pendentes), mais recentes primeiro. Parcelas da mesma compra contam uma vez. */
export function uncategorized(state: AppState) {
  const seen = new Set<string>()
  return state.transactions
    .filter((t) => isExpense(t) && t.category === null)
    .filter((t) => {
      const g = t.installment?.group
      if (!g) return true
      if (seen.has(g)) return false
      seen.add(g)
      return true
    })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

/** Categoria aprendida para um nome ("PAG*JOSE" -> Alimentação), se a pessoa ainda tem a categoria. */
export function ruleFor(state: AppState, name: string): CategoryId | undefined {
  const key = normalizeLabel(name)
  if (!key) return undefined
  const rule = state.categoryRules.find((r) => r.pattern === key)
  return rule && state.customCategories.some((c) => c.id === rule.category) ? rule.category : undefined
}

/** Aviso do teto de uma categoria (padrão: ligado em 80%). */
export function capAlert(state: AppState, category: CategoryId): CapAlert {
  return state.budget.alerts?.[category] ?? { enabled: true, percent: 80 }
}

/** Gasto da categoria no mês (só gastos). */
export function spentIn(state: AppState, category: CategoryId, key: string, exceptIds: string[] = []) {
  return round2(
    state.transactions
      .filter((t) => isExpense(t) && t.category === category && monthKey(t.date) === key && !exceptIds.includes(t.id))
      .reduce((s, t) => s + t.amount, 0),
  )
}

/**
 * Aviso de teto ao lançar `amount` na categoria no mês `key` (mês da compra / da 1ª parcela).
 * Devolve a porcentagem do teto depois do lançamento quando chega no limite de aviso escolhido.
 */
export function capWarning(state: AppState, category: CategoryId, key: string, amount: number, exceptIds: string[] = []) {
  const cap = state.budget.caps[category]
  if (!cap || amount <= 0) return null
  const alert = capAlert(state, category)
  if (!alert.enabled) return null
  const after = spentIn(state, category, key, exceptIds) + amount
  const percent = Math.round((after / cap) * 100)
  return percent >= alert.percent ? { percent, cap, after } : null
}

export function daysLeftInMonth() {
  const last = new Date(TODAY.getFullYear(), TODAY.getMonth() + 1, 0).getDate()
  return last - TODAY.getDate()
}

export function daysUntilDue(card: Card) {
  const due = new Date(TODAY.getFullYear(), TODAY.getMonth(), card.dueDay)
  if (due < TODAY) due.setMonth(due.getMonth() + 1)
  return Math.round((+due - +TODAY) / 864e5)
}

/** Monthly saving average since the goal started, and months left at that pace. */
export function goalPace(goal: Goal) {
  const [y, m] = (goal.startedAt ?? currentMonth()).split('-').map(Number)
  const months = Math.max(1, (TODAY.getFullYear() - y) * 12 + (TODAY.getMonth() + 1 - m) + 1)
  const average = (goal.deposited ?? 0) / months
  const remaining = Math.max(0, goal.target - goal.saved)
  // null = no deposit yet, so there is no pace to project
  const monthsLeft = remaining === 0 ? 0 : average > 0 ? Math.ceil(remaining / average) : null
  return { average, monthsLeft }
}

export function methodLabel(state: AppState, t: Pick<Transaction, 'method' | 'kind' | 'accountId'>) {
  if (kindOf(t) === 'income') return accountName(state, t.accountId)
  if (t.method.type === 'pix') return 'Pix'
  if (t.method.type === 'cash') return 'Dinheiro'
  const id = t.method.cardId
  const card = state.cards.find((c) => c.id === id)
  return card ? `${card.nickname} • ${card.last4}` : 'Cartão'
}

export type { Budget }
