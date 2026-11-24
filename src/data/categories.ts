import type { AppState, BuiltinCategoryId, CategoryId, CustomCategory } from '../types'

export interface CategoryMeta {
  label: string
  /** Tile / chart color (always used with #0A0A0A text on top) */
  color: string
}

/**
 * Categorias sugeridas pelo app. Cada conta começa com elas (no banco: seed_default_categories),
 * mas a pessoa pode renomear, trocar a cor ou excluir qualquer uma. O id continua sendo a chave
 * ('moradia', 'alimentacao', ...) para os lançamentos e ícones seguirem funcionando.
 */
export const CATEGORIES: Record<BuiltinCategoryId, CategoryMeta> = {
  moradia: { label: 'Moradia', color: '#d8ccfa' },
  alimentacao: { label: 'Alimentação', color: '#e5ffb5' },
  transporte: { label: 'Transporte', color: '#f1f1ee' },
  lazer: { label: 'Lazer', color: '#bfa9fe' },
  assinaturas: { label: 'Assinaturas', color: '#c9c3dc' },
  saude: { label: 'Saúde', color: '#d6e6c4' },
  outros: { label: 'Outros', color: '#8f8f96' },
}

/** Chaves das sugestões (lista fixa, usada nas stories de ícones). */
export const CATEGORY_IDS = Object.keys(CATEGORIES) as BuiltinCategoryId[]

/** As sugestões como categorias da pessoa: o ponto de partida de toda conta nova. */
export const SUGGESTED_CATEGORIES: CustomCategory[] = CATEGORY_IDS.map((id) => ({ id, ...CATEGORIES[id] }))

/** Pastels for categories; dark text stays readable on all of them. */
export const CUSTOM_COLORS = ['#b8dff2', '#f5c6d6', '#f6dca4', '#aee5cc', '#ffcfb0', '#cfd8ff']

/** Todas as cores que a pessoa pode escolher (sugestões + extras), sem repetir. */
export const CATEGORY_PALETTE = [...new Set([...CATEGORY_IDS.map((id) => CATEGORIES[id].color), ...CUSTOM_COLORS])]

/** Chave de uma categoria sugerida pelo app (mesmo que a pessoa tenha renomeado). */
export const isBuiltin = (id: CategoryId): id is BuiltinCategoryId => id in CATEGORIES

type WithCustom = Pick<AppState, 'customCategories'>

/** Gasto ainda sem categoria: não é uma categoria (não tem teto, não pode ser editado). */
export const UNCATEGORIZED: CategoryMeta = { label: 'Sem categoria', color: '#5a5a60' }

/** Label and color of any category the person has. Categoria excluída aparece como Outros. */
export function categoryMeta(state: WithCustom, id: CategoryId | null): CategoryMeta {
  if (id === null) return UNCATEGORIZED
  const own = state.customCategories.find((c) => c.id === id)
  if (own) return own
  return { label: 'Outros', color: CATEGORIES.outros.color }
}

/** Every category the person can pick, in their order. */
export function categoryIds(state: WithCustom): CategoryId[] {
  return state.customCategories.map((c) => c.id)
}

export const hasCategory = (state: WithCustom, id: CategoryId) => state.customCategories.some((c) => c.id === id)

/** Accent- and case-insensitive key, so "Manutencao" and "manutenção" are the same category. */
export const normalizeLabel = (label: string) =>
  label
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')

/** Existing category with the same name, if any. */
export function findCategoryByLabel(state: WithCustom, label: string): CategoryId | undefined {
  const key = normalizeLabel(label)
  return state.customCategories.find((c) => normalizeLabel(c.label) === key)?.id
}

/** Next color for a new category: the first one not in use, cycling through the palette. */
export function nextCustomColor(custom: CustomCategory[]) {
  const used = new Set(custom.map((c) => c.color.toLowerCase()))
  return CUSTOM_COLORS.find((c) => !used.has(c)) ?? CUSTOM_COLORS[custom.length % CUSTOM_COLORS.length]
}
