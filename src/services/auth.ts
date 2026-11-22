/**
 * Autenticação livre do protótipo front-end.
 *
 * Entrar e Criar conta não validam e-mail nem senha: o objetivo é navegar pelo app.
 * Contas ficam no localStorage deste navegador. Para produção, troque o corpo de
 * signUp / signIn / signOut por chamadas ao backend mantendo as mesmas assinaturas.
 */
import type { AppState, User } from '../types'
import { ApiError, USE_SUPABASE } from './http'
import { setRemember, sb } from './supabase'
import { loadAccount, sbAccountApi } from './supabaseApi'

const ACCOUNTS_KEY = 'okiva:accounts'
const SESSION_KEY = 'okiva:session'

export const DEMO_ACCOUNT = { name: 'Lucas', email: 'lucas@okiva.app' }

interface StoredAccount extends User {
  createdAt: string
}

const normalize = (email: string) => email.trim().toLowerCase()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function readAccounts(): StoredAccount[] {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? '[]') as StoredAccount[]
  } catch {
    return []
  }
}

function writeAccounts(list: StoredAccount[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list))
}

function upsert(user: User) {
  const list = readAccounts()
  const i = list.findIndex((a) => a.email === user.email)
  if (i >= 0) list[i] = { ...list[i], ...user }
  else list.push({ ...user, createdAt: new Date().toISOString() })
  writeAccounts(list)
}

/** "Lembrar de mim" keeps the session after closing the browser; otherwise it ends with the tab session. */
function startSession(email: string, remember: boolean) {
  localStorage.removeItem(SESSION_KEY)
  sessionStorage.removeItem(SESSION_KEY)
  ;(remember ? localStorage : sessionStorage).setItem(SESSION_KEY, email)
}

const nameFromEmail = (email: string) => {
  const base = email.split('@')[0].replace(/[._-]+/g, ' ').trim()
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : 'Visitante'
}

/* ------------------------------------------------------------ Supabase Auth */

/** Resultado do login/cadastro: conta pronta (com os dados do banco) ou e-mail a confirmar. */
export type AuthResult = { user: User; state?: AppState } | { confirmEmail: string }

function authError(err: { message?: string; status?: number } | null): ApiError {
  const msg = err?.message ?? ''
  if (/invalid login credentials/i.test(msg)) return new ApiError('E-mail ou senha incorretos.', 400)
  if (/email not confirmed/i.test(msg)) return new ApiError('Confirme seu e-mail pelo link que enviamos antes de entrar.', 400)
  if (/already registered|already exists/i.test(msg)) return new ApiError('Esse e-mail já tem conta. Entre com sua senha.', 409)
  if (/password should be|weak password/i.test(msg)) return new ApiError('A senha precisa ter pelo menos 6 caracteres.', 422)
  if (/rate limit|too many/i.test(msg)) return new ApiError('Muitas tentativas. Espere alguns minutos e tente de novo.', 429)
  if (/fetch|network/i.test(msg)) return new ApiError('Sem conexão. Confira sua internet e tente de novo.', 0)
  return new ApiError('Não deu para entrar agora. Tente de novo.', err?.status ?? 500)
}

async function supabaseSignIn(input: { email: string; password: string; remember: boolean }): Promise<AuthResult> {
  setRemember(input.remember)
  const { error } = await sb().auth.signInWithPassword({ email: normalize(input.email), password: input.password })
  if (error) throw authError(error)
  const state = await loadAccount()
  return { user: state.user!, state }
}

async function supabaseSignUp(input: { name: string; email: string; password: string; avatar?: string; balance: number; remember: boolean }): Promise<AuthResult> {
  setRemember(input.remember)
  const email = normalize(input.email)
  const { data, error } = await sb().auth.signUp({
    email,
    password: input.password,
    options: { data: { name: input.name.trim() || nameFromEmail(email) }, emailRedirectTo: window.location.origin },
  })
  if (error) throw authError(error)
  // E-mail já cadastrado: o Supabase devolve um usuário sem identidades (proteção contra enumeração)
  if (data.user && data.user.identities?.length === 0) throw authError({ message: 'already registered' })
  // Projeto exige confirmação de e-mail: a conta só abre depois do link
  if (!data.session) return { confirmEmail: email }
  if (input.balance > 0) await sbAccountApi.setBalance(input.balance)
  if (input.avatar) await sbAccountApi.updateProfile({ avatar: input.avatar }).catch(() => undefined)
  const state = await loadAccount()
  return { user: state.user!, state }
}

/**
 * "Ver demonstração": cria uma conta anônima temporária só deste visitante e copia
 * para ela os dados de exemplo do Lucas (seed_demo_account no banco). A sessão vale
 * só nesta aba; ao sair, a conta e os dados são apagados (ver signOut). Quem só fecha
 * a aba é removido pela limpeza agendada no banco (contas demo com mais de 24 h).
 */
export async function startDemo(): Promise<AuthResult> {
  if (!USE_SUPABASE) return { user: await localSignIn({ email: '', remember: false }) }
  setRemember(false)
  const { error } = await sb().auth.signInAnonymously()
  if (error) {
    if (/anonymous.*disabled|not enabled/i.test(error.message)) throw new ApiError('A demonstração está desativada no momento.', 503)
    throw authError(error)
  }
  const { error: seedError } = await sb().rpc('seed_demo_account')
  if (seedError) {
    await sb().auth.signOut({ scope: 'local' })
    throw new ApiError('Não deu para preparar a demonstração. Tente de novo.', 500)
  }
  const state = await loadAccount()
  return { user: state.user!, state }
}

/** Fecha a sessão no Supabase; numa conta de demonstração, apaga a conta e os dados antes. */
async function endSupabaseSession() {
  const { data } = await sb().auth.getSession()
  if (data.session?.user.is_anonymous) await sb().rpc('delete_my_account').then(undefined, () => undefined)
  await sb().auth.signOut({ scope: 'local' })
}

/** Sessão salva (ou vinda do link de confirmação): devolve a conta carregada do banco. */
export async function restoreSupabaseSession(): Promise<AppState | null> {
  if (!USE_SUPABASE) return null
  const { data } = await sb().auth.getSession()
  if (!data.session) return null
  try {
    return await loadAccount()
  } catch {
    await sb().auth.signOut({ scope: 'local' })
    return null
  }
}

/** Avisa quando a sessão termina fora do app (expirou, saiu em outra aba). */
export function onSignedOut(cb: () => void): () => void {
  if (!USE_SUPABASE) return () => undefined
  const { data } = sb().auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') cb()
  })
  return () => data.subscription.unsubscribe()
}

/* ------------------------------------------------------------ login */

/** Supabase: e-mail e senha reais. Protótipo: e-mail vazio abre a conta demo; outro e-mail abre (ou cria) aquela conta. */
export async function signIn(input: { email: string; password?: string; remember: boolean }): Promise<AuthResult> {
  if (USE_SUPABASE) return supabaseSignIn({ ...input, password: input.password ?? '' })
  return { user: await localSignIn(input) }
}

export async function signUp(input: { name: string; email: string; password?: string; avatar?: string; balance?: number; remember: boolean }): Promise<AuthResult> {
  if (USE_SUPABASE) return supabaseSignUp({ ...input, password: input.password ?? '', balance: input.balance ?? 0 })
  return { user: await localSignUp(input) }
}

async function localSignIn(input: { email: string; remember: boolean }): Promise<User> {
  await sleep(300)
  const email = normalize(input.email) || DEMO_ACCOUNT.email
  const existing = readAccounts().find((a) => a.email === email)
  const user: User = existing
    ? { name: existing.name, email, avatar: existing.avatar }
    : { name: email === DEMO_ACCOUNT.email ? DEMO_ACCOUNT.name : nameFromEmail(email), email }
  upsert(user)
  startSession(email, input.remember)
  return user
}

/** Free sign-up: every field is optional. */
async function localSignUp(input: { name: string; email: string; avatar?: string; remember: boolean }): Promise<User> {
  await sleep(400)
  const email = normalize(input.email) || `visitante-${Math.random().toString(36).slice(2, 7)}@okiva.app`
  const user: User = { name: input.name.trim() || nameFromEmail(email), email, avatar: input.avatar }
  upsert(user)
  startSession(email, input.remember)
  return user
}

export function updateAccount(user: User) {
  upsert(user)
}

/** Removes the account from this browser and ends the session (data is removed by the store). */
export function deleteLocalAccount(email: string) {
  writeAccounts(readAccounts().filter((a) => a.email !== normalize(email)))
  signOut()
}

export function signOut() {
  localStorage.removeItem(SESSION_KEY)
  sessionStorage.removeItem(SESSION_KEY)
  if (USE_SUPABASE) void endSupabaseSession()
}

export function sessionEmail() {
  return sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY)
}

/** Used when migrating an older single-user save into the account model. */
export function restoreSession(user: User) {
  upsert(user)
  startSession(user.email, true)
}
