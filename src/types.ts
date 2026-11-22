export type BuiltinCategoryId =
  | 'moradia'
  | 'alimentacao'
  | 'transporte'
  | 'lazer'
  | 'assinaturas'
  | 'saude'
  | 'outros'

/** A built-in category or the id of one the person created (`string & {}` keeps autocomplete for the built-ins). */
export type CategoryId = BuiltinCategoryId | (string & {})

/** Category created by the person (or accepted from a suggestion). */
export interface CustomCategory {
  id: string
  label: string
  /** Tile / chart color, always used with #0A0A0A text on top */
  color: string
}

export type PaymentMethod = { type: 'card'; cardId: string } | { type: 'pix' } | { type: 'cash' }

export interface Transaction {
  id: string
  name: string
  category: CategoryId
  method: PaymentMethod
  /** ISO date (yyyy-mm-dd) */
  date: string
  /** Positive number, always an expense */
  amount: number
  source: 'manual' | 'fatura'
  /** Imported invoice this expense came from (source 'fatura') */
  invoiceId?: string
}

/** An invoice file read by the AI and confirmed by the person. */
export interface InvoiceImport {
  id: string
  /** Card that received the invoice total; null = expenses went in as "Dinheiro" */
  cardId: string | null
  fileName: string
  /** Total printed on the invoice */
  total: number
  /** yyyy-mm-dd */
  importedAt: string
  /** Card invoice before the import, restored when the import is undone */
  previousInvoice: number | null
}

/** Money put into a goal. Goal.saved and Goal.deposited are kept in sync with these. */
export interface GoalDeposit {
  id: string
  goalId: string
  amount: number
  /** yyyy-mm-dd */
  date: string
}

export type CardColor = 'gradient' | 'lilac' | 'offwhite'

export interface Card {
  id: string
  nickname: string
  last4: string
  color: CardColor
  /** Current invoice, typed by hand in stage 1 */
  invoice: number
  limit: number
  /** Day of month the invoice is due */
  dueDay: number
}

export interface Goal {
  id: string
  name: string
  target: number
  saved: number
  /** yyyy-mm, optional */
  deadline?: string
  icon: 'plane' | 'shield' | 'book' | 'car' | 'target'
  /** yyyy-mm when the person started saving; used to compute the monthly average */
  startedAt?: string
  /** Amount the person already had when the goal was created (not part of the monthly average) */
  initialSaved?: number
  /** Sum of deposits made after creating the goal; drives the monthly average */
  deposited?: number
}

export interface Budget {
  total: number
  caps: Partial<Record<CategoryId, number>>
}

export interface User {
  name: string
  email: string
  /** Profile photo as a resized data URL (front-end only prototype) */
  avatar?: string
  /** 'admin' = full access in the database (Supabase app_metadata.role) */
  role?: 'admin'
}

export type Stage = 1 | 2

export interface AppState {
  user: User | null
  stage: Stage
  hideBalance: boolean
  /** Balance before any registered expense; saldo = startingBalance - expenses */
  startingBalance: number
  transactions: Transaction[]
  cards: Card[]
  /** Order of the wallet stack, last = front */
  cardOrder: string[]
  goals: Goal[]
  featuredGoalId: string
  budget: Budget
  /** Categories created by the person, on top of the built-in ones */
  customCategories: CustomCategory[]
  /** Deposit history of every goal (newest first) */
  deposits: GoalDeposit[]
  /** Invoices imported with the AI reader (newest first) */
  invoices: InvoiceImport[]
}
