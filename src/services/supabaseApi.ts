/**
 * Implementação Supabase dos serviços de finance.ts (mesmas assinaturas).
 *
 * - Tabelas em snake_case → tipos do front em camelCase (mapeadores to* / from*).
 * - RLS garante que cada pessoa só vê os próprios dados; `user_id` é preenchido
 *   pelo banco (default auth.uid()).
 * - Regras de negócio (fatura do cartão, depósitos → meta, exclusões em cascata)
 *   rodam em triggers no banco; o store do front aplica as mesmas regras localmente.
 */
import type { PostgrestError } from '@supabase/supabase-js'
import type { AppState, Card, CategoryId, CustomCategory, Goal, GoalDeposit, InvoiceImport, Stage, Transaction, User } from '../types'
import type { Database } from './database.types'
import type { AccountSnapshot, CardInput, CategoryInput, GoalInput, ImportInvoiceInput, ImportInvoiceResult, TransactionInput } from './finance'
import { ApiError } from './http'
import { sb } from './supabase'

type Tables = Database['public']['Tables']
type Row<T extends keyof Tables> = Tables[T]['Row']

/* ------------------------------------------------------------- erros */

/** Converte erros do Supabase/Postgres em mensagens prontas para o toast. */
export function toApiError(error: PostgrestError | { message: string; code?: string; status?: number } | null): ApiError {
  const code = error && 'code' in error ? error.code : undefined
  const msg = error?.message ?? ''
  if (code === '23505') return new ApiError('Já existe um item com esse nome.', 409, code)
  if (code === '42501' || /row-level security|permission denied/i.test(msg)) return new ApiError('Você não tem acesso a isso. Entre de novo.', 403, code)
  if (code === '23514' || code === '22023' || code === '23503' || code === 'P0001') return new ApiError(msg || 'Confira os dados e tente de novo.', 422, code)
  if (code === 'PGRST116') return new ApiError('Não encontramos esse item.', 404, code)
  if (/fetch|network|Failed to fetch/i.test(msg)) return new ApiError('Sem conexão. Confira sua internet e tente de novo.', 0, code)
  return new ApiError('Não deu para salvar. Tente de novo.', 500, code)
}

async function run<R extends { data: unknown; error: PostgrestError | null }>(query: PromiseLike<R>): Promise<NonNullable<R['data']>> {
  const { data, error } = await query
  if (error) throw toApiError(error)
  return data as NonNullable<R['data']>
}

async function uid(): Promise<string> {
  const { data } = await sb().auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new ApiError('Sua sessão expirou. Entre de novo.', 401)
  return id
}

const num = (v: number | string | null | undefined) => (v === null || v === undefined ? 0 : Number(v))

/* ------------------------------------------------------------ mapeadores */

export const toTx = (r: Row<'transactions'>): Transaction => ({
  id: r.id,
  name: r.name,
  category: r.category,
  method: r.method_type === 'card' && r.card_id ? { type: 'card', cardId: r.card_id } : r.method_type === 'pix' ? { type: 'pix' } : { type: 'cash' },
  date: r.date,
  amount: num(r.amount),
  source: r.source,
  invoiceId: r.invoice_id ?? undefined,
})

const fromTx = (t: TransactionInput) => ({
  name: t.name,
  category: t.category,
  method_type: t.method.type,
  card_id: t.method.type === 'card' ? t.method.cardId : null,
  date: t.date,
  amount: t.amount,
  source: t.source,
  invoice_id: t.invoiceId ?? null,
})

export const toCard = (r: Row<'cards'>): Card => ({
  id: r.id,
  nickname: r.nickname,
  last4: r.last4,
  color: r.color,
  invoice: num(r.invoice),
  limit: num(r.limit),
  dueDay: r.due_day,
})

export const toGoal = (r: Row<'goals'>): Goal => ({
  id: r.id,
  name: r.name,
  target: num(r.target),
  saved: num(r.saved),
  deadline: r.deadline ?? undefined,
  icon: r.icon,
  startedAt: r.started_at,
  initialSaved: num(r.initial_saved),
  deposited: num(r.deposited),
})

const toDeposit = (r: Row<'goal_deposits'>): GoalDeposit => ({ id: r.id, goalId: r.goal_id, amount: num(r.amount), date: r.date })

export const toInvoice = (r: Row<'invoice_imports'>): InvoiceImport => ({
  id: r.id,
  cardId: r.card_id,
  fileName: r.file_name,
  total: num(r.total),
  importedAt: r.imported_at,
  previousInvoice: r.previous_invoice === null ? null : num(r.previous_invoice),
})

const toCategory = (r: Row<'categories'>): CustomCategory => ({ id: r.id, label: r.label, color: r.color })

/* ------------------------------------------------------------- avatar */

const AVATARS = 'avatars'
const SIGNED_URL_TTL = 60 * 60 * 24 * 7

async function avatarUrl(path: string | null): Promise<string | undefined> {
  if (!path) return undefined
  if (/^(https?:|data:)/.test(path)) return path
  const { data } = await sb().storage.from(AVATARS).createSignedUrl(path, SIGNED_URL_TTL)
  return data?.signedUrl
}

async function uploadAvatar(dataUrl: string): Promise<string> {
  const id = await uid()
  const blob = await (await fetch(dataUrl)).blob()
  const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${id}/avatar-${Date.now()}.${ext}`
  const { error } = await sb().storage.from(AVATARS).upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: true })
  if (error) throw new ApiError('Não deu para enviar a foto. Tente de novo.', 500)
  return path
}

/** Apaga as fotos antigas da pasta da pessoa (mantém `keep`). */
async function clearAvatars(keep?: string) {
  const id = await uid()
  const { data } = await sb().storage.from(AVATARS).list(id)
  const old = (data ?? []).map((f) => `${id}/${f.name}`).filter((p) => p !== keep)
  if (old.length) await sb().storage.from(AVATARS).remove(old)
}

/* ------------------------------------------------------------- conta */

/** Tudo que o app precisa ao abrir: perfil + dados da conta (RLS devolve só os da pessoa). */
export async function loadAccount(): Promise<AppState> {
  const db = sb()
  // Sempre filtra pela própria conta: um admin enxerga todas as linhas via RLS,
  // mas o app mostra só os dados de quem está logado.
  const me = await uid()
  const [profile, cards, txs, goals, deposits, caps, categories, invoices] = await Promise.all([
    run(db.from('profiles').select('*').eq('id', me).single()),
    run(db.from('cards').select('*').eq('user_id', me).order('position', { ascending: true })),
    run(db.from('transactions').select('*').eq('user_id', me).order('date', { ascending: false }).order('created_at', { ascending: false })),
    run(db.from('goals').select('*').eq('user_id', me).order('created_at', { ascending: true })),
    run(db.from('goal_deposits').select('*').eq('user_id', me).order('date', { ascending: false })),
    run(db.from('budget_caps').select('*').eq('user_id', me)),
    run(db.from('categories').select('*').eq('user_id', me).order('created_at', { ascending: true })),
    run(db.from('invoice_imports').select('*').eq('user_id', me).order('imported_at', { ascending: false }).order('created_at', { ascending: false })),
  ])
  // Papel vem do app_metadata do Auth (só o servidor altera)
  const { data: session } = await db.auth.getSession()
  const role = session.session?.user.app_metadata?.role === 'admin' ? 'admin' : undefined
  const user: User = { name: profile.name, email: profile.email, avatar: await avatarUrl(profile.avatar_url), role }
  return {
    user,
    stage: (profile.stage === 1 ? 1 : 2) as Stage,
    hideBalance: profile.hide_balance,
    startingBalance: num(profile.starting_balance),
    transactions: txs.map(toTx),
    cards: cards.map(toCard),
    cardOrder: cards.map((c) => c.id),
    goals: goals.map(toGoal),
    featuredGoalId: profile.featured_goal_id ?? '',
    budget: { total: num(profile.budget_total), caps: Object.fromEntries(caps.map((c) => [c.category, num(c.value)])) },
    customCategories: categories.map(toCategory),
    deposits: deposits.map(toDeposit),
    invoices: invoices.map(toInvoice),
  }
}

/** Preferências que o app muda sem serviço próprio (Okiva Plus, ocultar saldo). */
export async function savePrefs(prefs: { stage: Stage; hideBalance: boolean }) {
  const id = await uid()
  await run(sb().from('profiles').update({ stage: prefs.stage, hide_balance: prefs.hideBalance }).eq('id', id))
}

async function updateProfile(patch: Partial<Pick<User, 'name' | 'avatar'>>): Promise<Partial<User>> {
  const id = await uid()
  const update: Tables['profiles']['Update'] = {}
  const result: Partial<User> = {}
  if (patch.name !== undefined) update.name = result.name = patch.name
  if ('avatar' in patch) {
    if (patch.avatar) {
      const path = await uploadAvatar(patch.avatar)
      update.avatar_url = path
      result.avatar = await avatarUrl(path)
      await clearAvatars(path).catch(() => undefined)
    } else {
      update.avatar_url = null
      result.avatar = undefined
      await clearAvatars().catch(() => undefined)
    }
  }
  await run(sb().from('profiles').update(update).eq('id', id))
  return result
}

export const sbAccountApi = {
  snapshot: async (): Promise<AccountSnapshot> => {
    const { user: _u, stage: _s, hideBalance: _h, ...snapshot } = await loadAccount()
    return snapshot
  },
  updateProfile,
  setBalance: async (value: number) => {
    await run(sb().rpc('set_balance', { p_balance: value }))
    return { balance: value }
  },
  clearData: async () => {
    await run(sb().rpc('clear_my_data'))
  },
  deleteAccount: async () => {
    await clearAvatars().catch(() => undefined)
    await run(sb().rpc('delete_my_account'))
    await sb().auth.signOut({ scope: 'local' })
  },
}

/* ---------------------------------------------------------- transações */

export const sbTransactionsApi = {
  create: async (input: TransactionInput) => toTx(await run(sb().from('transactions').insert(fromTx(input)).select().single())),
  update: async (tx: Transaction) => toTx(await run(sb().from('transactions').update(fromTx(tx)).eq('id', tx.id).select().single())),
  remove: async (id: string) => {
    await run(sb().from('transactions').delete().eq('id', id))
  },
}

/* --------------------------------------------------------------- fatura */

interface ImportRpcResult {
  invoice: Row<'invoice_imports'>
  transactions: Row<'transactions'>[]
  card: Row<'cards'> | null
  duplicate: boolean
}

export const sbInvoicesApi = {
  import: async (input: ImportInvoiceInput): Promise<ImportInvoiceResult> => {
    const items = input.items.map((t) => ({
      name: t.name,
      category: t.category,
      amount: t.amount,
      date: t.date,
      method_type: t.method.type,
      card_id: t.method.type === 'card' ? t.method.cardId : null,
    }))
    const r = (await run(
      sb().rpc('import_invoice', { p_card_id: input.cardId as string, p_file_name: input.fileName, p_total: input.total, p_items: items }),
    )) as unknown as ImportRpcResult
    // Idempotência: a mesma fatura (cartão + arquivo + total) não entra duas vezes
    if (r.duplicate) throw new ApiError('Essa fatura já foi importada. Veja em Cartões → Faturas importadas.', 409)
    return { invoice: toInvoice(r.invoice), transactions: r.transactions.map(toTx), card: r.card ? toCard(r.card) : null }
  },
  list: async () =>
    (await run(sb().from('invoice_imports').select('*').eq('user_id', await uid()).order('imported_at', { ascending: false }))).map(toInvoice),
  remove: async (id: string) => {
    await run(sb().from('invoice_imports').delete().eq('id', id))
  },
}

/* -------------------------------------------------------------- cartões */

export const sbCardsApi = {
  create: async (input: CardInput) =>
    toCard(
      await run(
        sb()
          .from('cards')
          .insert({ nickname: input.nickname, last4: input.last4, limit: input.limit, invoice: input.invoice, due_day: input.dueDay, color: input.color ?? 'gradient' })
          .select()
          .single(),
      ),
    ),
  update: async (card: Card) =>
    toCard(
      await run(
        sb()
          .from('cards')
          .update({ nickname: card.nickname, last4: card.last4, limit: card.limit, invoice: card.invoice, due_day: card.dueDay, color: card.color })
          .eq('id', card.id)
          .select()
          .single(),
      ),
    ),
  remove: async (id: string) => {
    await run(sb().from('cards').delete().eq('id', id))
  },
  reorder: async (order: string[]) => {
    await run(sb().rpc('reorder_cards', { p_order: order }))
  },
}

/* ---------------------------------------------------------------- metas */

async function setFeatured(goalId: string) {
  const id = await uid()
  await run(sb().from('profiles').update({ featured_goal_id: goalId }).eq('id', id))
}

export const sbGoalsApi = {
  create: async ({ featured, ...input }: GoalInput, startedAt: string) => {
    const goal = toGoal(
      await run(
        sb()
          .from('goals')
          .insert({ name: input.name, target: input.target, saved: input.saved, deadline: input.deadline ?? null, icon: input.icon, started_at: startedAt })
          .select()
          .single(),
      ),
    )
    if (featured) await setFeatured(goal.id)
    return goal
  },
  update: async ({ featured, ...goal }: Goal & { featured?: boolean }) => {
    const saved = toGoal(
      await run(
        sb()
          .from('goals')
          .update({ name: goal.name, target: goal.target, saved: goal.saved, deadline: goal.deadline ?? null, icon: goal.icon })
          .eq('id', goal.id)
          .select()
          .single(),
      ),
    )
    if (featured) await setFeatured(saved.id)
    return saved
  },
  remove: async (id: string) => {
    await run(sb().from('goals').delete().eq('id', id))
  },
  deposit: async (goalId: string, amount: number, date: string) =>
    toDeposit(await run(sb().from('goal_deposits').insert({ goal_id: goalId, amount, date }).select().single())),
  deposits: async (goalId: string) =>
    (await run(sb().from('goal_deposits').select('*').eq('user_id', await uid()).eq('goal_id', goalId).order('date', { ascending: false }))).map(toDeposit),
  updateDeposit: async (d: GoalDeposit) =>
    toDeposit(await run(sb().from('goal_deposits').update({ amount: d.amount, date: d.date }).eq('id', d.id).select().single())),
  removeDeposit: async (d: GoalDeposit) => {
    await run(sb().from('goal_deposits').delete().eq('id', d.id))
  },
}

/* ------------------------------------------------------------- orçamento */

export const sbBudgetApi = {
  setTotal: async (total: number) => {
    const id = await uid()
    await run(sb().from('profiles').update({ budget_total: total }).eq('id', id))
    return { total }
  },
  removeTotal: async () => {
    const id = await uid()
    await run(sb().from('profiles').update({ budget_total: 0 }).eq('id', id))
  },
  setCap: async (category: CategoryId, value: number) => {
    const id = await uid()
    const r = await run(sb().from('budget_caps').upsert({ user_id: id, category, value }, { onConflict: 'user_id,category' }).select().single())
    return { category: r.category, value: num(r.value) }
  },
  removeCap: async (category: CategoryId) => {
    // user_id explícito: a chave do teto é (user_id, category) e um admin alcança todas as linhas
    const id = await uid()
    await run(sb().from('budget_caps').delete().eq('user_id', id).eq('category', category))
  },
}

/* ------------------------------------------------------------ categorias */

export const sbCategoriesApi = {
  create: async (input: CategoryInput) => toCategory(await run(sb().from('categories').insert({ label: input.label, color: input.color }).select().single())),
  update: async (c: CustomCategory) => toCategory(await run(sb().from('categories').update({ label: c.label, color: c.color }).eq('id', c.id).select().single())),
  remove: async (id: string) => {
    await run(sb().from('categories').delete().eq('id', id))
  },
  recategorize: async (ids: string[], category: CategoryId) => {
    await run(sb().rpc('recategorize_transactions', { p_ids: ids, p_category: category }))
  },
}
