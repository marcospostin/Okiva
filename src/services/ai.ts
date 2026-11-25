/**
 * Okiva Plus (estágio 2) — camada de IA.
 *
 * Com `VITE_USE_MOCK` (padrão) tudo responde localmente com o MESMO formato que o
 * backend deve devolver. Com `VITE_USE_MOCK=false` cada função chama a rota do servidor,
 * que fala com o provedor de IA (a chave nunca vai para o navegador):
 *
 *   POST /api/invoice    multipart (file)                      -> InvoiceResult
 *   POST /api/assistant  { question, history, context }        -> AssistantReply
 *   POST /api/insight    { context }                           -> Insight
 *
 * Contrato completo: docs/integracao-backend.md
 */
import { isExpense } from '../lib/ledger'
import { categoryMeta } from '../data/categories'
import { TODAY } from '../data/mock'
import { brlShort, monthKey, monthName, toISO } from '../lib/format'
import { balanceOf, currentMonth, goalPace, monthSummary, previousMonth } from '../state/store'
import type { AppState, CategoryId } from '../types'
import { ApiError, request, USE_AI_MOCK } from './http'

export interface InvoiceItem {
  name: string
  /** null = a IA não tem certeza (nome de CNPJ, "PAG*", etc.): a pessoa classifica */
  category: CategoryId | null
  amount: number
  date: string
  subscription: boolean
  /** Compra parcelada ("GELADEIRA PARC 04/10"): parcela desta fatura e total */
  installment?: { number: number; total: number }
}

/**
 * Reconhece compra parcelada no nome da linha da fatura: "PARC 04/10", "PARCELA 4/10", "4 DE 10"
 * ou "04/10" no fim do nome. Devolve o nome limpo ("Geladeira") e a parcela.
 */
export function detectInstallment(name: string): { name: string; installment: { number: number; total: number } } | null {
  const m =
    name.match(/\s*[-–]?\s*PARC(?:ELA)?\.?\s*(\d{1,2})\s*(?:\/|DE)\s*(\d{1,2})\b/i) ??
    name.match(/\s+(\d{1,2})\s+DE\s+(\d{1,2})\s*$/i) ??
    name.match(/\s+(\d{2})\/(\d{2})\s*$/)
  if (!m) return null
  const number = Number(m[1])
  const total = Number(m[2])
  if (!(total >= 2 && total <= 48 && number >= 1 && number <= total)) return null
  const clean = (name.slice(0, m.index) + name.slice((m.index ?? 0) + m[0].length)).replace(/[\s*–-]+$/, '').trim()
  const pretty = clean === clean.toUpperCase() ? clean.charAt(0) + clean.slice(1).toLowerCase() : clean
  return { name: pretty || name, installment: { number, total } }
}

/** Itens com a parcela reconhecida (o servidor pode já mandar `installment`; senão, lê do nome). */
export function withInstallments(items: InvoiceItem[]): InvoiceItem[] {
  return items.map((it) => {
    if (it.installment) return it
    const found = detectInstallment(it.name)
    return found ? { ...it, name: found.name, installment: found.installment } : it
  })
}

export interface InvoiceResult {
  fileName: string
  kind: 'pdf' | 'photo'
  total: number
  dueInDays: number
  items: InvoiceItem[]
}

export type AssistantReply =
  | { kind: 'text'; parts: { text: string; bold?: boolean }[] }
  | { kind: 'insight'; lead: string; value: string; consequence: string }

/** One turn of the conversation, sent back so the model keeps context. */
export interface ChatTurn {
  role: 'user' | 'assistant'
  text: string
}

export interface Insight {
  context: 'gasto' | 'assinatura' | 'objetivo'
  lead: string
  value: string
  consequence: string
}

/**
 * Resumo financeiro enviado ao backend junto da pergunta. Só números agregados:
 * nada de e-mail, foto ou nome completo.
 */
export interface AssistantContext {
  month: string
  balance: number
  spentThisMonth: number
  spentLastMonth: number
  budget: number
  byCategory: { category: CategoryId; amount: number }[]
  cards: { nickname: string; invoice: number; limit: number; dueDay: number }[]
  goals: { name: string; target: number; saved: number; monthlyAverage: number; featured: boolean }[]
  subscriptions: { name: string; amount: number }[]
}

export function buildContext(state: AppState): AssistantContext {
  const month = currentMonth()
  const summary = monthSummary(state, month)
  return {
    month,
    balance: balanceOf(state),
    spentThisMonth: summary.total,
    spentLastMonth: summary.previousTotal,
    budget: state.budget.total,
    byCategory: summary.byCategory,
    cards: state.cards.map(({ nickname, invoice, limit, dueDay }) => ({ nickname, invoice, limit, dueDay })),
    goals: state.goals.map((g) => ({ name: g.name, target: g.target, saved: g.saved, monthlyAverage: goalPace(g).average, featured: g.id === state.featuredGoalId })),
    subscriptions: summary.transactions.filter((t) => isExpense(t) && t.category === 'assinaturas').map((t) => ({ name: t.name, amount: t.amount })),
  }
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const id = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(id)
      reject(new DOMException('Aborted', 'AbortError'))
    })
  })

const monthLabel = (key: string) => monthName(Number(key.slice(5, 7)) - 1)
const categoryLabel = (state: Pick<AppState, 'customCategories'>, c: CategoryId) => categoryMeta(state, c).label.toLowerCase()
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/* ------------------------------------------------------------ invoice */

// prettier-ignore
// Linhas com categoria null imitam o que aparece em faturas reais e a IA não consegue identificar
const SAMPLE: [string, CategoryId | null, number, boolean][] = [
  ['Netflix', 'assinaturas', 55.9, true], ['Spotify', 'assinaturas', 21.9, true], ['iCloud', 'assinaturas', 14.9, true],
  ['Amazon Prime', 'assinaturas', 19.9, true], ['YouTube Premium', 'assinaturas', 24.9, true], ['Disney+', 'assinaturas', 43.9, true],
  ['iFood', 'alimentacao', 62.4, false], ['Padaria', 'alimentacao', 18.5, false], ['iFood', 'alimentacao', 48.9, false],
  ['Mercado Dia', 'alimentacao', 96.3, false], ['Café', 'alimentacao', 14, false], ['Rappi', 'alimentacao', 55.7, false],
  ['Hortifruti', 'alimentacao', 41.2, false], ['Uber', 'transporte', 23.8, false], ['99', 'transporte', 17.6, false],
  ['Posto Shell', 'transporte', 80, false], ['Uber', 'transporte', 31.4, false], ['Estacionamento', 'transporte', 22, false],
  ['Cinema', 'lazer', 64, false], ['Livraria', 'lazer', 42.9, false], ['Bar', 'lazer', 48.5, false],
  ['Show', 'lazer', 60, false], ['Farmácia', 'saude', 46.8, false], ['Academia', 'saude', 59.9, false],
  ['Drogaria', 'saude', 28.4, false], ['Loja de roupas', 'outros', 0, false], ['PAG*JOSEDASILVA', null, 35, false],
  ['PIX QRS 4471-AB', null, 12.5, false], ['12.345.678/0001-90', null, 26, false], ['Pet shop', 'outros', 38.9, false],
  ['Barbearia', 'outros', 45, false], ['Delivery farmácia', 'saude', 15.9, false], ['Sorveteria', 'alimentacao', 16, false],
  ['EC *MP*LOJA3421', null, 20, false], ['GELADEIRA PARC 04/10', 'outros', 300, false], ['Tênis Esportivo 02/03', 'lazer', 159.9, false],
]
const INVOICE_TOTAL = 1743.9

function buildItems(): InvoiceItem[] {
  const known = SAMPLE.reduce((s, [, , a]) => s + a, 0)
  return SAMPLE.map(([name, category, amount, subscription], i) => {
    const d = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1 + ((i * 3) % TODAY.getDate()))
    // The one zero-valued row absorbs the difference so items always add up to the total
    const value = amount === 0 ? Math.round((INVOICE_TOTAL - known) * 100) / 100 : amount
    return { name, category, amount: value, date: toISO(d), subscription }
  })
}

/** Reads a PDF or photo. Mock: simulates upload + OCR progress. */
export async function readInvoice(file: File, onProgress: (p: number) => void, signal?: AbortSignal): Promise<InvoiceResult> {
  if (!USE_AI_MOCK) {
    // Upload progress is not exposed by fetch; show steady steps while the server reads.
    let p = 15
    onProgress(p)
    // Eases toward 90% while waiting; jumps to 100% when the server answers
    const ticker = setInterval(() => {
      p = Math.min(90, p + Math.max(1, (90 - p) * 0.12))
      onProgress(Math.round(p))
    }, 500)
    try {
      const body = new FormData()
      body.append('file', file)
      const result = await request<InvoiceResult>('POST', '/api/invoice', body, { signal, timeoutMs: 60000 })
      onProgress(100)
      return result
    } finally {
      clearInterval(ticker)
    }
  }
  const steps = 24
  for (let i = 1; i <= steps; i++) {
    await sleep(110 + Math.random() * 90, signal)
    onProgress(Math.round((i / steps) * 100))
  }
  return {
    fileName: file.name,
    kind: file.type.startsWith('image/') ? 'photo' : 'pdf',
    total: INVOICE_TOTAL,
    dueInDays: 8,
    items: buildItems(),
  }
}

/* ---------------------------------------------------------- assistant */

const isDelivery = (name: string) => /restaurante|delivery|ifood|rappi|lanche/i.test(name)

function deliveryOf(state: AppState, key: string) {
  return state.transactions
    .filter((t) => isExpense(t) && monthKey(t.date) === key && isDelivery(t.name))
    .reduce((s, t) => s + t.amount, 0)
}

function tripPlan(state: AppState, extraPerMonth: number) {
  const goal = state.goals.find((g) => g.id === state.featuredGoalId) ?? state.goals[0]
  if (!goal) return null
  const pace = goalPace(goal).average || 500 // fallback before the first deposit
  const remaining = Math.max(0, goal.target - goal.saved)
  const now = Math.round(remaining / pace)
  const faster = Math.round(remaining / (pace + extraPerMonth))
  return { goal, monthsEarlier: Math.max(1, now - faster) }
}

const text = (...parts: (string | [string])[]): AssistantReply => ({
  kind: 'text',
  parts: parts.map((p) => (typeof p === 'string' ? { text: p } : { text: p[0], bold: true })),
})

/** Local rules with the same reply shape the model returns. */
function mockReply(question: string, state: AppState): AssistantReply {
  const q = question.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const month = currentMonth()
  const prevMonth = previousMonth(month)
  const summary = monthSummary(state, month)

  if (/^(oi|ola|bom dia|boa tarde|boa noite|e ai|hey|opa)\b/.test(q.trim())) {
    const name = state.user?.name.split(' ')[0]
    return text(`Oi${name ? `, ${name}` : ''}! Posso olhar seus gastos, cartões, assinaturas e metas. Por onde quer começar?`)
  }

  if (/obrigad|valeu|brigad/.test(q)) return text('Por nada! Se quiser, pergunte de novo quando registrar novos gastos.')

  if (/delivery|ifood|restaurante|comida|rappi/.test(q) && !/guard|econom/.test(q)) {
    const now = deliveryOf(state, month)
    const prev = deliveryOf(state, prevMonth)
    if (now === 0) return text(`Não encontrei gastos com delivery em ${monthLabel(month)}.`)
    const diff = prev ? Math.round(((now - prev) / prev) * 100) : 0
    return text('Foram ', [brlShort(now)], prev ? `, ${Math.abs(diff)}% a ${diff >= 0 ? 'mais' : 'menos'} que em ${monthLabel(prevMonth)}.` : ` em ${monthLabel(month)}.`)
  }

  if (/guard|viagem|japao|meta|objetivo|econom|poupar/.test(q)) {
    if (state.goals.length === 0) return text('Você ainda não tem metas. Crie uma em Metas e eu calculo quanto falta e em quanto tempo você chega lá.')
    const delivery = deliveryOf(state, month)
    const cut = Math.max(50, Math.round((delivery * 0.25) / 10) * 10)
    const plan = tripPlan(state, cut)
    return {
      kind: 'insight',
      lead: delivery > 0 ? 'Reduzindo delivery, você guarda' : 'Guardando um pouco mais por mês',
      value: `${brlShort(cut)} / mês`,
      consequence: plan ? `${plan.goal.name.replace('Viagem ao Japão', 'A viagem')} chega ${plural(plan.monthsEarlier, 'mês', 'meses')} antes.` : 'Seu objetivo chega antes.',
    }
  }

  if (/assinatura|netflix|spotify|streaming/.test(q)) {
    const subs = state.transactions.filter((t) => isExpense(t) && t.category === 'assinaturas' && monthKey(t.date) === month)
    if (subs.length === 0) return text('Ainda não vejo assinaturas registradas. Envie sua fatura e eu encontro as cobranças recorrentes.')
    const top = [...subs].sort((a, b) => b.amount - a.amount).slice(0, 2)
    const saving = top.reduce((s, t) => s + t.amount, 0) * 4
    return {
      kind: 'insight',
      lead: `Cancelando ${top.map((t) => t.name).join(' e ')}, você guarda`,
      value: `+ ${brlShort(Math.round(saving))}`,
      consequence: 'Em quatro meses, sem mudar mais nada.',
    }
  }

  if (/cart|fatura|limite/.test(q)) {
    const front = state.cards.find((c) => c.id === state.cardOrder[state.cardOrder.length - 1])
    if (!front) return text('Você ainda não cadastrou cartões. Adicione um em Cartões para eu acompanhar a fatura e o limite.')
    return text(`A fatura do ${front.nickname} está em `, [brlShort(front.invoice)], `, ${Math.round((front.invoice / front.limit) * 100)}% do limite.`)
  }

  if (/saldo|quanto tenho|dinheiro tenho/.test(q)) {
    return text('Seu saldo é ', [brlShort(balanceOf(state))], ', depois de tudo que você registrou.')
  }

  if (/gast|posso|sobra|teto|mes|orcamento/.test(q)) {
    if (summary.total === 0) return text(`Você ainda não registrou gastos em ${monthLabel(month)}.`)
    const top = summary.byCategory[0]
    const where = top ? `, a maior parte em ${categoryLabel(state, top.category)}. ` : '. '
    if (state.budget.total <= 0) return text('Este mês você gastou ', [brlShort(summary.total)], `${where}Defina um teto em Metas e eu digo quanto ainda pode gastar.`)
    const left = state.budget.total - summary.total
    return text('Este mês você gastou ', [brlShort(summary.total)], where, left >= 0 ? `Ainda pode gastar ${brlShort(left)}.` : `Passou ${brlShort(-left)} do teto.`)
  }

  return text('Ainda não sei responder isso. Posso falar de gastos do mês, delivery, assinaturas, cartões, saldo e metas.')
}

export async function askAssistant(question: string, history: ChatTurn[], state: AppState, signal?: AbortSignal): Promise<AssistantReply> {
  if (!USE_AI_MOCK) {
    return request<AssistantReply>('POST', '/api/assistant', { question, history: history.slice(-10), context: buildContext(state) }, { signal, timeoutMs: 30000 })
  }
  await sleep(900 + Math.random() * 600, signal)
  // QA hook: lets the error state be checked without a backend
  if (/#erro\b/i.test(question)) throw new ApiError('O assistente não respondeu. Tente de novo.', 503)
  return mockReply(question, state)
}

/** Plain text of a reply, used to send the history back to the backend. */
export const replyText = (r: AssistantReply) => (r.kind === 'text' ? r.parts.map((p) => p.text).join('') : `${r.lead} ${r.value}. ${r.consequence}`)

/* ------------------------------------------------------------ insight */

export function getInsight(state: AppState): Insight {
  const month = currentMonth()
  const subs = state.transactions.filter((t) => isExpense(t) && t.category === 'assinaturas' && monthKey(t.date) === month)
  if (subs.length >= 2) {
    const top = [...subs].sort((a, b) => b.amount - a.amount).slice(0, 2)
    const saving = Math.round(top.reduce((s, t) => s + t.amount, 0) * 4)
    return { context: 'assinatura', lead: 'Cancelando 2 assinaturas', value: `+ ${brlShort(saving)}`, consequence: 'É o que sobra em quatro meses para suas metas.' }
  }
  const delivery = deliveryOf(state, month)
  if (delivery > 0) {
    const cut = Math.max(50, Math.round((delivery * 0.25) / 10) * 10)
    const plan = tripPlan(state, cut)
    return {
      context: 'gasto',
      lead: `Delivery somou ${brlShort(delivery)} este mês`,
      value: `+ ${brlShort(cut)} / mês`,
      consequence: plan ? `Reduzindo um pouco, ${plan.goal.name} chega ${plural(plan.monthsEarlier, 'mês', 'meses')} antes.` : 'Reduzindo um pouco, sobra para suas metas.',
    }
  }
  return { context: 'objetivo', lead: 'Cancelando 2 assinaturas', value: '+ R$ 320', consequence: 'Envie a fatura para eu confirmar quais.' }
}
