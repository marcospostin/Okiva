/**
 * Busca de transações (Home, extrato da conta, detalhe dos relatórios).
 *
 * Cada palavra digitada precisa aparecer em algum lugar da transação:
 *   nome · categoria · fonte da receita · forma de pagamento (cartão, Pix, dinheiro)
 *   · conta · data · valor · etiquetas (parcela, recorrente, fatura, sem categoria).
 * Sem diferença de maiúsculas e acentos ("cafe" acha "Café").
 *
 * Valor:   "45" acha R$ 45,00 e R$ 45,90 · "45,90" ou "45.90" só R$ 45,90 · "1200" acha R$ 1.200,00
 *          ">100" mais de R$ 100 · "<50" menos de R$ 50
 * Data:    "12/11" · "12/11/2026" · "novembro" · "nov" · "2026"
 * Tipo:    "receita" · "gasto" · "pagamento" (de fatura)
 */
import { categoryMeta } from '../data/categories'
import { accountLabel, methodLabel } from '../state/store'
import type { AppState, Transaction } from '../types'
import { incomeLabel, kindOf } from './ledger'

const MONTHS = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** minúsculas, sem acentos, espaços simples */
export const normalizeSearch = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

const centsText = (n: number) => n.toFixed(2).replace('.', ',') // 1200.5 → "1200,50"

function textOf(state: AppState, t: Transaction) {
  const k = kindOf(t)
  const [y, m, d] = t.date.split('-')
  const parts = [
    t.name,
    k === 'income'
      ? `receita entrada ${incomeLabel(t.category)}`
      : k === 'invoice_payment'
        ? 'pagamento de fatura'
        : k === 'transfer'
          ? `transferencia mover guardar resgatar ${accountLabel(state, t.accountId)} ${accountLabel(state, t.transferAccountId)}`
          : k === 'adjustment'
            ? 'ajuste conferencia conferir'
            : `gasto despesa saida`,
    k === 'expense' ? (t.category === null ? 'sem categoria' : categoryMeta(state, t.category).label) : '',
    methodLabel(state, t),
    t.method.type !== 'card' ? accountLabel(state, t.accountId) : '',
    t.method.type === 'card' ? 'cartao credito' : '',
    t.recurrenceId ? 'recorrente mensal' : '',
    t.installment ? `parcela parcelado ${t.installment.number}/${t.installment.total}` : '',
    t.source === 'fatura' ? 'fatura importada' : '',
    `${d}/${m}/${y} ${Number(d)}/${Number(m)} ${MONTHS[Number(m) - 1]} ${y}`,
  ]
  return normalizeSearch(parts.join(' '))
}

function matchesAmount(token: string, amount: number): boolean | null {
  const cmp = token.match(/^([<>])=?\s*r?\$?\s*(\d+(?:[.,]\d{1,2})?)$/)
  if (cmp) {
    const v = Number(cmp[2].replace(',', '.'))
    return cmp[1] === '>' ? amount >= v : amount <= v
  }
  const num = token.replace(/^r\$/, '')
  if (!/^\d[\d.]*(,\d{0,2})?$|^\d+\.\d{1,2}$/.test(num)) return null
  // "45.90" (ponto como decimal, 1–2 casas no fim) ou "1.200,50" (ponto de milhar)
  const normalized = /^\d+\.\d{1,2}$/.test(num) ? num.replace('.', ',') : num.replace(/\./g, '')
  const value = centsText(amount)
  return normalized.includes(',') ? value.startsWith(normalized) : value.split(',')[0] === normalized
}

/** true quando a transação bate com a busca (busca vazia = tudo) */
export function matchTransaction(state: AppState, t: Transaction, query: string) {
  const q = normalizeSearch(query)
  if (!q) return true
  // "> 100" vira ">100"
  const tokens = q.replace(/([<>]=?)\s+/g, '$1').split(' ')
  let text: string | undefined
  return tokens.every((token) => {
    const byAmount = matchesAmount(token, t.amount)
    if (byAmount !== null) {
      // número também pode ser parte da data ("12/11") ou do nome ("99 Táxi")
      if (byAmount) return true
      if (/^[<>]/.test(token)) return false
    }
    text ??= textOf(state, t)
    return text.includes(token)
  })
}

export function searchTransactions<T extends Transaction>(state: AppState, list: T[], query: string): T[] {
  if (!normalizeSearch(query)) return list
  return list.filter((t) => matchTransaction(state, t, query))
}
