import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react'
import { USE_SUPABASE } from '../services/http'
import { savePrefs } from '../services/supabaseApi'
import { DEMO_USER, initialState, TODAY } from '../data/mock'
import { restoreSession, sessionEmail, signOut } from '../services/auth'
import { monthKey, toISO } from '../lib/format'
import type { AppState, Budget, Card, CategoryId, CustomCategory, Goal, GoalDeposit, InvoiceImport, Stage, Transaction, User } from '../types'

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
  /** Removes a custom category: its expenses go to "Outros" and its cap is removed */
  | { type: 'deleteCategory'; id: string }
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

/** Keeps a card's typed invoice in sync with expenses paid on it. */
function adjustInvoice(cards: Card[], tx: Pick<Transaction, 'method' | 'amount'>, sign: 1 | -1) {
  if (tx.method.type !== 'card') return cards
  const id = tx.method.cardId
  return cards.map((c) => (c.id === id ? { ...c, invoice: Math.max(0, c.invoice + sign * tx.amount) } : c))
}

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
    case 'setBalance':
      // Saldo = startingBalance - expenses, so the start absorbs the typed balance
      return { ...state, startingBalance: action.value + state.transactions.reduce((s, t) => s + t.amount, 0) }
    case 'removeCap': {
      const caps = { ...state.budget.caps }
      delete caps[action.category]
      return { ...state, budget: { ...state.budget, caps } }
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
      return { ...state, transactions: [tx, ...state.transactions], cards: adjustInvoice(state.cards, tx, 1) }
    }
    case 'updateTx': {
      const prev = state.transactions.find((t) => t.id === action.tx.id)
      if (!prev) return state
      const cards = adjustInvoice(adjustInvoice(state.cards, prev, -1), action.tx, 1)
      return { ...state, cards, transactions: state.transactions.map((t) => (t.id === prev.id ? action.tx : t)) }
    }
    case 'deleteTx': {
      const prev = state.transactions.find((t) => t.id === action.id)
      if (!prev) return state
      return {
        ...state,
        transactions: state.transactions.filter((t) => t.id !== action.id),
        cards: adjustInvoice(state.cards, prev, -1),
      }
    }
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
        transactions: state.transactions.map((t) =>
          t.method.type === 'card' && t.method.cardId === action.id ? { ...t, method: { type: 'cash' } } : t,
        ),
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
        transactions: state.transactions.map((t) => (t.category === action.id ? { ...t, category: 'outros' } : t)),
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
    startingBalance: balance,
    transactions: [],
    cards: [],
    cardOrder: [],
    goals: [],
    featuredGoalId: '',
    budget: { total: 0, caps: {} },
    customCategories: [],
    deposits: [],
    invoices: [],
  }
}

function parseState(raw: string): AppState {
  const saved = { ...initialState, ...JSON.parse(raw) } as AppState
  // Saves made before custom categories existed
  saved.customCategories = saved.customCategories ?? []
  saved.invoices = saved.invoices ?? []
  // Saves made before the deposit history: example goals get their example deposits
  saved.deposits = saved.deposits ?? initialState.deposits.filter((d) => saved.goals.some((g) => g.id === d.goalId && g.deposited === initialState.goals.find((x) => x.id === g.id)?.deposited))
  // Saves made before deposit tracking: example goals get the new realistic data,
  // goals created by hand treat everything saved so far as the starting amount.
  saved.goals = saved.goals.map((g) => {
    if (g.deposited !== undefined) return g
    const example = initialState.goals.find((x) => x.id === g.id)
    return example ?? { ...g, startedAt: g.startedAt ?? currentMonth(), initialSaved: g.saved, deposited: 0 }
  })
  return saved
}

/** Data for a signed-in account: saved data, demo examples, or an empty start. */
export function accountState(user: User, opts: { balance?: number } = {}): AppState {
  const raw = localStorage.getItem(dataKey(user.email))
  if (raw) return { ...parseState(raw), user }
  if (user.email === DEMO_USER.email) return { ...initialState, user }
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
    if (email === DEMO_USER.email) return { ...initialState, user: DEMO_USER }
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

export function balanceOf(state: AppState) {
  return state.startingBalance - state.transactions.reduce((s, t) => s + t.amount, 0)
}

export interface MonthSummary {
  key: string
  total: number
  previousTotal: number
  byCategory: { category: CategoryId; amount: number }[]
  transactions: Transaction[]
}

export function monthSummary(state: AppState, key: string): MonthSummary {
  const txs = state.transactions
    .filter((t) => monthKey(t.date) === key)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  const prevKey = previousMonth(key)
  const previousTotal = state.transactions
    .filter((t) => monthKey(t.date) === prevKey)
    .reduce((s, t) => s + t.amount, 0)
  const map = new Map<CategoryId, number>()
  for (const t of txs) map.set(t.category, (map.get(t.category) ?? 0) + t.amount)
  const byCategory = [...map.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
  return { key, total: txs.reduce((s, t) => s + t.amount, 0), previousTotal, byCategory, transactions: txs }
}

export function availableMonths(state: AppState) {
  const set = new Set(state.transactions.map((t) => monthKey(t.date)))
  set.add(currentMonth())
  return [...set].sort().reverse()
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

export function methodLabel(state: AppState, t: Pick<Transaction, 'method'>) {
  if (t.method.type === 'pix') return 'Pix'
  if (t.method.type === 'cash') return 'Dinheiro'
  const id = t.method.cardId
  const card = state.cards.find((c) => c.id === id)
  return card ? `${card.nickname} • ${card.last4}` : 'Cartão'
}

export type { Budget }
