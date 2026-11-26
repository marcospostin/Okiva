const brlCents = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const brlInt = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
})

/** R$ 14.500,00 */
export const brl = (n: number) => brlCents.format(n).replace(/\u00a0/g, ' ')
/** R$ 14.500 (drops cents when whole) */
export const brlShort = (n: number) =>
  (Number.isInteger(n) ? brlInt.format(n) : brlCents.format(n)).replace(/\u00a0/g, ' ')
export const expense = (n: number) => `− ${brl(n)}`
export const HIDDEN_MONEY = 'R$ ••••••'

/** Masks a monetary value without changing the underlying financial calculation. */
export const privateMoney = (value: string, hidden: boolean) => (hidden ? HIDDEN_MONEY : value)
export const privateExpense = (n: number, hidden: boolean) => (hidden ? `− ${HIDDEN_MONEY}` : expense(n))
export const income = (n: number) => `+ ${brl(n)}`
export const privateIncome = (n: number, hidden: boolean) => (hidden ? `+ ${HIDDEN_MONEY}` : income(n))
/** "7 dez" */
export const shortDate = (iso: string) => {
  const d = parseISO(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`
}

/** Keeps assistant copy private when it contains a BRL value or an amount per month. */
export const privateMoneyText = (text: string, hidden: boolean) =>
  hidden ? text.replace(/[+−-]?\s*R\$\s?[\d.]+(?:,\d{2})?(?:\s*\/\s*mês)?/g, HIDDEN_MONEY) : text

export const pct = (part: number, whole: number) =>
  whole <= 0 ? 0 : Math.round((part / whole) * 100)

const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]
export const monthName = (m: number) => MONTHS[m]
export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const parseISO = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const monthKey = (s: string) => s.slice(0, 7)

/** Ordena do mais recente para o mais antigo (datas ISO). */
export const byDateDesc = (a: { date: string }, b: { date: string }) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)

/** "2026-11" + delta meses → "2026-12" (delta negativo volta). */
export function shiftMonth(key: string, delta: number) {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Menor data aceita nos formulários (evita "0202" ou "20255" digitados à mão). */
export const MIN_DATE = '2000-01-01'

/** Data yyyy-mm-dd que existe de verdade (sem 31/02) e não é absurda (de 2000 a 2100). */
export function isValidDate(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || s < MIN_DATE || s > '2100-12-31') return false
  const d = parseISO(s)
  return toISO(d) === s
}

export function relativeDay(iso: string, today: Date) {
  const d = parseISO(iso)
  const diff = Math.round((+new Date(today.getFullYear(), today.getMonth(), today.getDate()) - +d) / 864e5)
  if (diff === 0) return 'Hoje'
  if (diff === 1) return 'Ontem'
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()].slice(0, 3)}`
}

export function longDate(iso: string) {
  const d = parseISO(iso)
  return `${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`
}

export function deadlineLabel(ym?: string) {
  if (!ym) return undefined
  const [y, m] = ym.split('-').map(Number)
  return `${capitalize(MONTHS[m - 1].slice(0, 3))} ${y}`
}

export const uid = () => Math.random().toString(36).slice(2, 10)
