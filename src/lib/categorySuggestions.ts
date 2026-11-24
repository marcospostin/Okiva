/**
 * Sugestões de categoria para o "Teto por categoria".
 *
 * Ordem de prioridade:
 *  1. Categorias novas sugeridas pelo nome dos lançamentos (ex.: "Oficina do Zé" → Manutenção)
 *  2. Categorias que já têm gasto e ainda não têm teto (maior gasto primeiro)
 *  3. Categorias que a pessoa criou e ainda não têm teto
 *  4. Base: as mais comuns, para o app vazio (e para completar a lista)
 *
 * A tela mostra só as que cabem em duas linhas (fitChips); criar a própria
 * categoria está sempre disponível.
 */
import { isExpense } from './ledger'
import { categoryMeta, findCategoryByLabel, hasCategory, isBuiltin, normalizeLabel } from '../data/categories'
import { TODAY } from '../data/mock'
import { toISO } from './format'
import type { AppState, BuiltinCategoryId, CategoryId } from '../types'

export interface CategorySuggestion {
  /** Stable key for React and selection */
  key: string
  label: string
  /** Category that already exists (built-in or custom); undefined = will be created */
  existingId?: CategoryId
  /** Expenses that will move into this category when the suggestion is accepted */
  txIds: string[]
  /** Names of those expenses, to explain the suggestion */
  matches: string[]
  /** Spend that backs the suggestion (last 90 days) */
  amount: number
  source: 'keyword' | 'spend' | 'custom' | 'base'
}

/** Keyword rules over expense names. `target` maps to a built-in instead of a new category. */
const RULES: { label: string; pattern: RegExp; target?: BuiltinCategoryId }[] = [
  { label: 'Manutenção', pattern: /oficina|mec[aâ]nic|borrachar|auto ?pe[cç]as|funilar|auto ?center|troca de [oó]leo|pneu|lava ?r[aá]pido/i },
  { label: 'Combustível', pattern: /posto|combust[ií]vel|gasolina|etanol|diesel|\bshell\b|ipiranga|petrobras/i },
  { label: 'Pets', pattern: /pet ?shop|\bpetz\b|cobasi|veterin[aá]ri|ra[cç][aã]o/i },
  { label: 'Educação', pattern: /escola|faculdade|universidade|\bcurso|udemy|alura|livraria|material escolar/i },
  { label: 'Academia', pattern: /academia|smart ?fit|bluefit|crossfit|pilates|muscula[cç][aã]o/i },
  { label: 'Delivery', pattern: /ifood|rappi|delivery|uber ?eats|z[eé] delivery/i },
  { label: 'Vestuário', pattern: /renner|riachuelo|\bzara\b|\bc&a\b|shein|roupa|cal[cç]ado|centauro|netshoes/i },
  { label: 'Viagem', pattern: /hotel|airbnb|booking|latam|passagem|decolar|pousada/i },
  { label: 'Casa', pattern: /leroy|tok ?& ?stok|camicado|m[oó]veis|eletrodom[eé]stic|material de constru/i },
  { label: 'Beleza', pattern: /sal[aã]o|barbearia|manicure|cabeleireir|sephora|botic[aá]rio|est[eé]tica/i },
  { label: 'Saúde', pattern: /farm[aá]cia|drogaria|drogasil|raia|consulta|exame|hospital|cl[ií]nica|dentista|laborat[oó]rio/i, target: 'saude' },
]

/** Most common budget categories, used when the account has no expenses yet. */
const BASE_ORDER: BuiltinCategoryId[] = ['alimentacao', 'moradia', 'transporte', 'saude', 'lazer', 'assinaturas', 'outros']

const WINDOW_DAYS = 90

export function suggestCategories(state: Pick<AppState, 'transactions' | 'customCategories' | 'budget'>): CategorySuggestion[] {
  const hasCap = (id: CategoryId) => state.budget.caps[id] !== undefined
  const since = new Date(TODAY)
  since.setDate(since.getDate() - WINDOW_DAYS)
  const recent = state.transactions.filter((t) => isExpense(t) && t.date >= toISO(since))

  const byKey = new Map<string, CategorySuggestion>()
  const bump = (s: Omit<CategorySuggestion, 'txIds' | 'matches' | 'amount'>, amount: number, tx?: { id: string; name: string }) => {
    const cur = byKey.get(s.key) ?? { ...s, txIds: [], matches: [], amount: 0 }
    cur.amount += amount
    if (tx) {
      cur.txIds.push(tx.id)
      if (!cur.matches.includes(tx.name)) cur.matches.push(tx.name)
    }
    byKey.set(s.key, cur)
  }

  for (const t of recent) {
    // 1. Names that point to a category the person doesn't have yet
    const rule = RULES.find((r) => r.pattern.test(t.name))
    if (rule) {
      // A sugestão só aponta para uma categoria que a pessoa ainda tem
      const existingId = (rule.target && hasCategory(state, rule.target) ? rule.target : undefined) ?? findCategoryByLabel(state, rule.label)
      // Already in that category: nothing to suggest from the name
      if (existingId !== t.category && !(existingId && hasCap(existingId))) {
        const key = existingId ? `id:${existingId}` : `new:${normalizeLabel(rule.label)}`
        const label = existingId ? categoryMeta(state, existingId).label : rule.label
        bump({ key, label, existingId: existingId ?? undefined, source: 'keyword' }, t.amount, t)
        continue
      }
    }
    // 2. Spend in a category that has no cap yet
    if (t.category !== null && !hasCap(t.category)) {
      const label = categoryMeta(state, t.category).label
      bump({ key: `id:${t.category}`, label, existingId: t.category, source: 'spend' }, t.amount)
    }
  }

  const ranked = [...byKey.values()].sort((a, b) => b.amount - a.amount)
  const seen = new Set(ranked.map((s) => s.key))
  const add = (s: CategorySuggestion) => {
    if (seen.has(s.key)) return
    seen.add(s.key)
    ranked.push(s)
  }

  // 3. Categories the person created that still have no cap
  for (const c of state.customCategories) {
    if (!isBuiltin(c.id) && !hasCap(c.id)) add({ key: `id:${c.id}`, label: c.label, existingId: c.id, txIds: [], matches: [], amount: 0, source: 'custom' })
  }
  // 4. Base suggestions (the most common ones the person still has) fill the rest
  for (const id of BASE_ORDER) {
    if (hasCategory(state, id) && !hasCap(id)) add({ key: `id:${id}`, label: categoryMeta(state, id).label, existingId: id, txIds: [], matches: [], amount: 0, source: 'base' })
  }
  return ranked
}

/* --------------------------------------------------------------- layout */

/** Chip metrics from the design system (`Chip`: px-4, 14px medium, gap-2). */
export const CHIP = { paddingX: 32, gap: 8, font: 14, weight: 500 }
/** Suggestions never take more than two rows of the sheet, and never more than this many. */
export const MAX_SUGGESTION_ROWS = 2
export const MAX_SUGGESTIONS = 5

let canvas: HTMLCanvasElement | null = null
function textWidth(text: string, fontFamily: string) {
  try {
    canvas ??= document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.font = `${CHIP.weight} ${CHIP.font}px ${fontFamily}`
      return ctx.measureText(text).width
    }
  } catch {
    /* no canvas: fall through to the estimate */
  }
  return text.length * 7.6
}

/**
 * How many suggestion chips fit in `rows` rows of `width` px, keeping room for
 * the trailing "create" chip (`trailingWidth`) on the last row. Order is kept.
 */
export function fitChips(labels: string[], width: number, fontFamily: string, trailingWidth: number, rows = MAX_SUGGESTION_ROWS) {
  if (width <= 0) return Math.min(labels.length, 3)
  const widths = labels.map((l) => Math.ceil(textWidth(l, fontFamily)) + CHIP.paddingX)
  const fits = (count: number) => {
    let row = 1
    let x = 0
    for (const w of [...widths.slice(0, count), trailingWidth]) {
      const next = x === 0 ? w : x + CHIP.gap + w
      if (next <= width) x = next
      else {
        row += 1
        x = w
        if (row > rows) return false
      }
    }
    return true
  }
  let count = Math.min(labels.length, MAX_SUGGESTIONS)
  while (count > 0 && !fits(count)) count -= 1
  return count
}

export function chipTextWidth(text: string, fontFamily: string) {
  return Math.ceil(textWidth(text, fontFamily))
}
