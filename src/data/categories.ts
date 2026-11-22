import type { AppState, BuiltinCategoryId, CategoryId, CustomCategory } from '../types'

export interface CategoryMeta {
  label: string
  /** Tile / chart color (always used with #0A0A0A text on top) */
  color: string
}

export const CATEGORIES: Record<BuiltinCategoryId, CategoryMeta> = {
  moradia: { label: 'Moradia', color: '#d8ccfa' },
  alimentacao: { label: 'Alimentação', color: '#e5ffb5' },
  transporte: { label: 'Transporte', color: '#f1f1ee' },
  lazer: { label: 'Lazer', color: '#bfa9fe' },
  assinaturas: { label: 'Assinaturas', color: '#c9c3dc' },
  saude: { label: 'Saúde', color: '#d6e6c4' },
  outros: { label: 'Outros', color: '#8f8f96' },
}

/** Built-in categories only (for lists that must stay fixed, like the icon stories). */
export const CATEGORY_IDS = Object.keys(CATEGORIES) as BuiltinCategoryId[]

/** Pastels for categories the person creates; dark text stays readable on all of them. */
export const CUSTOM_COLORS = ['#b8dff2', '#f5c6d6', '#f6dca4', '#aee5cc', '#ffcfb0', '#cfd8ff']

export const isBuiltin = (id: CategoryId): id is BuiltinCategoryId => id in CATEGORIES

type WithCustom = Pick<AppState, 'customCategories'>

/** Label and color of any category, built-in or created by the person. */
export function categoryMeta(state: WithCustom, id: CategoryId): CategoryMeta {
  if (isBuiltin(id)) return CATEGORIES[id]
  const custom = state.customCategories.find((c) => c.id === id)
  return custom ?? { label: 'Outros', color: CATEGORIES.outros.color }
}

/** Every category the person can pick: built-ins first, then the ones they created. */
export function categoryIds(state: WithCustom): CategoryId[] {
  return [...CATEGORY_IDS, ...state.customCategories.map((c) => c.id)]
}

/** Accent- and case-insensitive key, so "Manutencao" and "manutenção" are the same category. */
export const normalizeLabel = (label: string) =>
  label
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')

/** Existing category (built-in or custom) with the same name, if any. */
export function findCategoryByLabel(state: WithCustom, label: string): CategoryId | undefined {
  const key = normalizeLabel(label)
  const builtin = CATEGORY_IDS.find((id) => normalizeLabel(CATEGORIES[id].label) === key)
  if (builtin) return builtin
  return state.customCategories.find((c) => normalizeLabel(c.label) === key)?.id
}

/** Next color for a new category, cycling through the custom palette. */
export function nextCustomColor(custom: CustomCategory[]) {
  return CUSTOM_COLORS[custom.length % CUSTOM_COLORS.length]
}
