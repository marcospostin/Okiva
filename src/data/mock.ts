import { toISO } from '../lib/format'
import type { AppState, GoalDeposit, Transaction } from '../types'

/** Current local date, normalized to midnight to keep date calculations stable. */
export const TODAY = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())

/** Day in the current month, `offset` days before today (never before day 1). */
const thisMonth = (offset: number) =>
  toISO(new Date(TODAY.getFullYear(), TODAY.getMonth(), Math.max(1, TODAY.getDate() - offset)))
/** Fixed day in the previous month. */
const lastMonth = (day: number) => toISO(new Date(TODAY.getFullYear(), TODAY.getMonth() - 1, day))

/** yyyy-mm, `n` months before the current month. */
const monthsAgo = (n: number) => toISO(new Date(TODAY.getFullYear(), TODAY.getMonth() - n, 1)).slice(0, 7)

/** Example expenses, always dated relative to today so the home is never empty. */
const EXAMPLE_TRANSACTIONS: Transaction[] = [
  { id: 't1', name: 'Mercado', category: 'alimentacao', method: { type: 'card', cardId: 'principal' }, date: thisMonth(0), amount: 260, source: 'manual' },
  { id: 't2', name: 'Restaurante', category: 'alimentacao', method: { type: 'card', cardId: 'principal' }, date: thisMonth(1), amount: 480, source: 'manual' },
  { id: 't3', name: 'Uber', category: 'transporte', method: { type: 'card', cardId: 'salario' }, date: thisMonth(2), amount: 400, source: 'manual' },
  { id: 't9', name: 'Netflix', category: 'assinaturas', method: { type: 'card', cardId: 'principal' }, date: thisMonth(3), amount: 55.9, source: 'manual' },
  { id: 't10', name: 'Spotify', category: 'assinaturas', method: { type: 'card', cardId: 'viagem' }, date: thisMonth(4), amount: 21.9, source: 'manual' },
  { id: 't4', name: 'Aluguel', category: 'moradia', method: { type: 'pix' }, date: thisMonth(31), amount: 1200, source: 'manual' },
  { id: 't5', name: 'Mercado', category: 'alimentacao', method: { type: 'card', cardId: 'principal' }, date: lastMonth(24), amount: 690, source: 'manual' },
  { id: 't6', name: 'Restaurante', category: 'alimentacao', method: { type: 'card', cardId: 'principal' }, date: lastMonth(18), amount: 407, source: 'manual' },
  { id: 't7', name: 'Uber', category: 'transporte', method: { type: 'card', cardId: 'salario' }, date: lastMonth(12), amount: 362, source: 'manual' },
  { id: 't11', name: 'Netflix', category: 'assinaturas', method: { type: 'card', cardId: 'principal' }, date: lastMonth(5), amount: 55.9, source: 'manual' },
  { id: 't8', name: 'Aluguel', category: 'moradia', method: { type: 'pix' }, date: lastMonth(1), amount: 1200, source: 'manual' },
]

/** Monthly deposits (day 5) since `months` months ago, matching each example goal's average. */
function monthlyDeposits(goalId: string, amount: number, months: number): GoalDeposit[] {
  return Array.from({ length: months }, (_, i) => ({
    id: `d_${goalId}_${i}`,
    goalId,
    amount,
    date: toISO(new Date(TODAY.getFullYear(), TODAY.getMonth() - i, Math.min(5, TODAY.getDate()))),
  }))
}

const EXAMPLE_DEPOSITS: GoalDeposit[] = [
  ...monthlyDeposits('japao', 600, 15),
  ...monthlyDeposits('reserva', 400, 12),
  ...monthlyDeposits('curso', 200, 10),
  ...monthlyDeposits('carro', 750, 12),
].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

export const DEMO_USER = { name: 'Lucas', email: 'lucas@okiva.app' }

/** Data copied from the site screens, treated as if Lucas typed it. */
export const initialState: AppState = {
  user: null,
  stage: 2,
  hideBalance: false,
  // Saldo starts at R$ 14.500 after the example expenses below
  startingBalance: 14500 + EXAMPLE_TRANSACTIONS.reduce((sum, t) => sum + t.amount, 0),
  transactions: EXAMPLE_TRANSACTIONS,
  cards: [
    { id: 'principal', nickname: 'Principal', last4: '4552', color: 'gradient', invoice: 1284, limit: 3000, dueDay: 18 },
    { id: 'salario', nickname: 'Salário', last4: '6917', color: 'lilac', invoice: 640, limit: 2000, dueDay: 22 },
    { id: 'viagem', nickname: 'Viagem', last4: '1180', color: 'offwhite', invoice: 98, limit: 5000, dueDay: 7 },
  ],
  cardOrder: ['viagem', 'salario', 'principal'],
  goals: [
    // R$ 600/mês × 15 meses + R$ 4.600 iniciais → faltam R$ 6.400 → 11 meses
    { id: 'japao', name: 'Viagem ao Japão', target: 20000, saved: 13600, initialSaved: 4600, deposited: 9000, deadline: '2027-12', icon: 'plane', startedAt: monthsAgo(14) },
    // R$ 400/mês × 12 meses + R$ 2.400 iniciais → faltam R$ 2.800 → 7 meses
    { id: 'reserva', name: 'Reserva', target: 10000, saved: 7200, initialSaved: 2400, deposited: 4800, icon: 'shield', startedAt: monthsAgo(11) },
    // R$ 200/mês × 10 meses + R$ 700 iniciais → faltam R$ 300 → 2 meses
    { id: 'curso', name: 'Curso', target: 3000, saved: 2700, initialSaved: 700, deposited: 2000, icon: 'book', startedAt: monthsAgo(9) },
    // R$ 750/mês × 12 meses + R$ 5.000 iniciais → faltam R$ 56.000 → 75 meses
    { id: 'carro', name: 'Carro novo', target: 70000, saved: 14000, initialSaved: 5000, deposited: 9000, icon: 'car', startedAt: monthsAgo(11) },
  ],
  featuredGoalId: 'japao',
  budget: {
    total: 3200,
    caps: { moradia: 1200, alimentacao: 1200, transporte: 1000, lazer: 300 },
  },
  customCategories: [],
  deposits: EXAMPLE_DEPOSITS,
  invoices: [],
}
