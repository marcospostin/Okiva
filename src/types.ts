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

/** Categoria da pessoa: as sugeridas pelo app (id = chave, ex. 'moradia') e as que ela criou. Todas editáveis. */
export interface CustomCategory {
  /** Id usado nos lançamentos: a chave da sugestão ('moradia') ou o uuid da criada */
  id: string
  /** Linha no banco quando o id é uma chave de sugestão */
  rowId?: string
  label: string
  /** Tile / chart color, always used with #0A0A0A text on top */
  color: string
}

export type PaymentMethod = { type: 'card'; cardId: string } | { type: 'pix' } | { type: 'cash' }

/** expense = gasto · income = receita (soma no saldo) · invoice_payment = pagamento de fatura do cartão */
export type TxKind = 'expense' | 'income' | 'invoice_payment'

/** Origem de uma receita (não é categoria de gasto e não tem teto) */
export type IncomeSource = 'receita_salario' | 'receita_extra' | 'receita_rendimentos' | 'receita_reembolso' | 'receita_outros'

/** Parcela de uma compra parcelada no cartão: cada parcela é um lançamento no mês dela. */
export interface Installment {
  /** Mesmo id para todas as parcelas da compra */
  group: string
  /** 1..total */
  number: number
  total: number
}

export interface Transaction {
  id: string
  /** Ausente = 'expense' (dados salvos antes das receitas) */
  kind?: TxKind
  name: string
  /** Gasto: categoria (null = ainda sem categoria, pendente). Receita: IncomeSource. Pagamento de fatura: 'outros'. */
  category: CategoryId | null
  /** Receita ignora o método (o dinheiro entra em accountId) */
  method: PaymentMethod
  /** Conta de onde o dinheiro sai (Pix, dinheiro, pagamento de fatura) ou onde entra (receita) */
  accountId?: string
  /** ISO date (yyyy-mm-dd). Parcelas futuras têm data no futuro. */
  date: string
  /** Positive number; the sign comes from `kind` */
  amount: number
  installment?: Installment
  /** Lançamento gerado por uma recorrência */
  recurrenceId?: string
  /** false = parcela futura, ainda fora da fatura do cartão */
  posted?: boolean
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

export interface CapAlert {
  enabled: boolean
  /** Avisa ao atingir esta porcentagem do teto (1–100) */
  percent: number
}

export interface Budget {
  total: number
  caps: Partial<Record<CategoryId, number>>
  /** Aviso por categoria com teto. Ausente = ligado em 80%. */
  alerts?: Partial<Record<CategoryId, CapAlert>>
}

/** Regra aprendida: lançamentos com este nome (normalizado) entram nesta categoria. */
export interface CategoryRule {
  id: string
  /** Nome normalizado (sem acento, minúsculo, espaços simples) */
  pattern: string
  category: CategoryId
}

/** Avisos que a pessoa quer receber. `news` (novidades) começa desligado: consentimento explícito. */
export interface NotificationPrefs {
  invoice_due: boolean
  cap_alert: boolean
  uncategorized: boolean
  recurrence: boolean
  weekly_summary: boolean
  news: boolean
}

export type AccountKind = 'checking' | 'savings' | 'wallet'

/** Conta da pessoa (onde o dinheiro está). Saldo da Home = soma de todas. */
export interface Account {
  id: string
  name: string
  kind: AccountKind
  startingBalance: number
}

/** Regra "todo mês, no dia X". O lançamento só é criado quando a data chega. */
export interface Recurrence {
  id: string
  kind: 'expense' | 'income'
  name: string
  category: CategoryId
  method: PaymentMethod
  accountId?: string
  amount: number
  /** Dia do mês (1–31). Em meses mais curtos, cai no último dia. */
  day: number
  /** yyyy-mm-dd: primeira data possível */
  startDate: string
  /** yyyy-mm-dd: depois disso não gera mais */
  endDate?: string
  /** yyyy-mm-dd: último dia já processado */
  lastRun?: string
}

export interface User {
  name: string
  email: string
  /** Profile photo as a resized data URL (front-end only prototype) */
  avatar?: string
  /** 'admin' = full access in the database (Supabase app_metadata.role) */
  role?: 'admin'
  /** Temporary demo account (Supabase anonymous user with the example data); deleted on sign-out */
  demo?: boolean
}

export type Stage = 1 | 2

export interface AppState {
  user: User | null
  stage: Stage
  hideBalance: boolean
  /** Bloco "Compras parceladas" na Home (Conta → Preferências). Ausente em dados antigos = ligado. */
  highlightInstallments?: boolean
  /** Legado (antes das contas). Hoje o saldo inicial fica em cada conta; vale 0 depois da migração. */
  startingBalance: number
  transactions: Transaction[]
  /** Contas (sempre ao menos uma depois de carregar) */
  accounts: Account[]
  /** Gastos e receitas que se repetem todo mês */
  recurrences: Recurrence[]
  cards: Card[]
  /** Order of the wallet stack, last = front */
  cardOrder: string[]
  goals: Goal[]
  featuredGoalId: string
  budget: Budget
  /** Todas as categorias da pessoa, na ordem dela (as sugestões do app entram aqui e podem ser editadas/excluídas) */
  customCategories: CustomCategory[]
  /** Nomes que a pessoa já classificou: "sempre usar Alimentação para PAG*JOSE" */
  categoryRules: CategoryRule[]
  /** Avisos que a pessoa quer receber (Conta → Notificações) */
  notificationPrefs: NotificationPrefs
  /** Dados locais já receberam as categorias sugeridas (protótipo sem Supabase) */
  categoriesSeeded?: boolean
  /** Deposit history of every goal (newest first) */
  deposits: GoalDeposit[]
  /** Invoices imported with the AI reader (newest first) */
  invoices: InvoiceImport[]
}
