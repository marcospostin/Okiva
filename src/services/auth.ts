/**
 * Autenticação livre do protótipo front-end.
 *
 * Entrar e Criar conta não validam e-mail nem senha: o objetivo é navegar pelo app.
 * Contas ficam no localStorage deste navegador. Para produção, troque o corpo de
 * signUp / signIn / signOut por chamadas ao backend mantendo as mesmas assinaturas.
 */
import type { AppState, User } from '../types'
import { ApiError, USE_SUPABASE, NETWORK_ERROR, OFFLINE_MESSAGE } from './http'
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

export function authError(err: { message?: string; status?: number } | null): ApiError {
  const msg = err?.message ?? ''
  if (/invalid login credentials/i.test(msg)) return new ApiError('E-mail ou senha incorretos.', 400)
  if (/email not confirmed/i.test(msg)) return new ApiError('Confirme seu e-mail pelo link que enviamos antes de entrar.', 400)
  if (/already registered|already exists/i.test(msg)) return new ApiError('Esse e-mail já tem conta. Entre com sua senha.', 409)
  if (/password should be|weak password/i.test(msg)) return new ApiError('A senha precisa ter pelo menos 6 caracteres.', 422)
  if (/rate limit|too many/i.test(msg)) return new ApiError('Muitas tentativas. Espere alguns minutos e tente de novo.', 429)
  if (NETWORK_ERROR.test(msg)) return new ApiError(OFFLINE_MESSAGE, 0)
  return new ApiError('Não deu para entrar agora. Tente de novo.', err?.status ?? 500)
}

async function supabaseSignIn(input: { email: string; password: string; remember: boolean }): Promise<AuthResult> {
  setRemember(input.remember)
  const { error } = await sb().auth.signInWithPassword({ email: normalize(input.email), password: input.password })
  if (error) throw authError(error)
  const state = await applyPendingAvatar(await loadAccount())
  await trackActiveUser()
  return { user: state.user!, state }
}

async function supabaseSignUp(input: { name: string; email: string; password: string; avatar?: string; balance: number; remember: boolean }): Promise<AuthResult> {
  setRemember(input.remember)
  const email = normalize(input.email)
  const { data, error } = await sb().auth.signUp({
    email,
    password: input.password,
    options: {
      // O trigger do banco cria o profile com nome e saldo inicial (funciona com ou sem confirmação de e-mail)
      data: { name: input.name.trim() || nameFromEmail(email), balance: input.balance !== 0 ? input.balance.toFixed(2) : undefined },
      emailRedirectTo: window.location.origin,
    },
  })
  if (error) throw authError(error)
  // E-mail já cadastrado: o Supabase devolve um usuário sem identidades (proteção contra enumeração)
  // Mostra a mesma tela de "confirme seu e-mail" para não revelar quem já tem conta
  if (data.user && data.user.identities?.length === 0) return { confirmEmail: email }
  // Projeto exige confirmação de e-mail: a conta só abre depois do link.
  // A foto espera neste navegador e é enviada no primeiro login.
  if (!data.session) {
    if (input.avatar) savePendingAvatar(email, input.avatar)
    return { confirmEmail: email }
  }
  if (input.avatar) await sbAccountApi.updateProfile({ avatar: input.avatar }).catch(() => undefined)
  const state = await loadAccount()
  await trackActiveUser()
  return { user: state.user!, state }
}

/* Foto escolhida no cadastro, guardada até a conta ser confirmada */
const pendingAvatarKey = (email: string) => `okiva:pending-avatar:${normalize(email)}`

function savePendingAvatar(email: string, avatar: string) {
  try {
    localStorage.setItem(pendingAvatarKey(email), avatar)
  } catch {
    /* storage cheio ou indisponível: a pessoa troca a foto depois na Conta */
  }
}

/** Envia a foto pendente do cadastro (se houver) e devolve a conta atualizada. */
async function applyPendingAvatar(state: AppState): Promise<AppState> {
  const email = state.user?.email
  if (!email || state.user?.avatar) return state
  let avatar: string | null = null
  try {
    avatar = localStorage.getItem(pendingAvatarKey(email))
  } catch {
    return state
  }
  if (!avatar) return state
  try {
    const patch = await sbAccountApi.updateProfile({ avatar })
    localStorage.removeItem(pendingAvatarKey(email))
    return { ...state, user: { ...state.user!, avatar: patch.avatar } }
  } catch {
    return state
  }
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
  setDemoAvatar(undefined)
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
  await trackActiveUser()
  return { user: state.user!, state }
}

/* Foto da demonstração: fica só nesta aba (sessionStorage), nunca vai ao Storage */
const DEMO_AVATAR_KEY = 'okiva:demo-avatar'

export function setDemoAvatar(avatar?: string) {
  try {
    if (avatar) sessionStorage.setItem(DEMO_AVATAR_KEY, avatar)
    else sessionStorage.removeItem(DEMO_AVATAR_KEY)
  } catch {
    /* sem storage: a foto vale até recarregar a página */
  }
}

function getDemoAvatar(): string | undefined {
  try {
    return sessionStorage.getItem(DEMO_AVATAR_KEY) ?? undefined
  } catch {
    return undefined
  }
}

/** Na demonstração, a foto vem da aba (se o visitante escolheu uma). */
function withDemoAvatar(state: AppState): AppState {
  if (!state.user?.demo) return state
  return { ...state, user: { ...state.user, avatar: getDemoAvatar() } }
}

/** Fecha a sessão no Supabase; numa conta de demonstração, apaga a conta e os dados antes. */
async function endSupabaseSession() {
  setDemoAvatar(undefined)
  const { data } = await sb().auth.getSession()
  if (data.session?.user.is_anonymous) await sb().rpc('delete_my_account').then(undefined, () => undefined)
  await sb().auth.signOut({ scope: 'local' })
}

/** Sessão salva (ou vinda do link de confirmação): devolve a conta carregada do banco. */
export async function restoreSupabaseSession(): Promise<AppState | null> {
  if (!USE_SUPABASE) return null
  const { data, error } = await sb().auth.getSession()
  if (error && /fetch|network|timed? ?out|abort/i.test(error.message)) throw new ApiError(OFFLINE_MESSAGE, 0)
  if (!data.session) return null
  try {
    // Recarregou a página na demonstração: a foto escolhida continua (vem da aba)
    const state = withDemoAvatar(await applyPendingAvatar(await loadAccount()))
    await trackActiveUser()
    return state
  } catch (err) {
    // Sem internet ou servidor lento: mantém a sessão e deixa tentar de novo (não pede a senha outra vez)
    if (err instanceof ApiError && (err.status === 0 || err.status === 408 || err.status >= 500)) throw err
    // Sessão que não vale mais (expirou, conta apagada): volta ao login
    await sb().auth.signOut({ scope: 'local' })
    return null
  }
}

/* ------------------------------------------------- recuperação de senha */

const RECOVERY_KEY = 'okiva:recovery-pending'

/** Chegou pelo link "Esqueci minha senha": marca para a sessão não abrir o app nem se fechar a aba. */
export function markRecoveryPending() {
  try {
    localStorage.setItem(RECOVERY_KEY, '1')
  } catch {
    /* sem storage: vale a checagem do token */
  }
}

function recoveryFlag() {
  try {
    return localStorage.getItem(RECOVERY_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Sessão aberta pelo link de recuperação de senha. Ela serve só para criar a senha nova:
 * o app não carrega a conta enquanto isso não acontecer (nem depois de recarregar a página).
 * Obs.: o Supabase registra essa sessão como "otp" (igual a um link mágico), então a marca
 * vem do próprio link (type=recovery na URL ou o evento PASSWORD_RECOVERY), guardada até o fim.
 */
export async function isRecoverySession(): Promise<boolean> {
  if (!USE_SUPABASE) return false
  const { data } = await sb().auth.getSession()
  if (!data.session) {
    try {
      localStorage.removeItem(RECOVERY_KEY)
    } catch {
      /* ignore */
    }
    return false
  }
  return recoveryFlag()
}

/** Avisa se um link de recuperação abrir sessão com o app já aberto (outra aba, mesmo navegador). */
export function onPasswordRecovery(cb: () => void): () => void {
  if (!USE_SUPABASE) return () => undefined
  const { data } = sb().auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      markRecoveryPending()
      cb()
    }
  })
  return () => data.subscription.unsubscribe()
}

/** Fim da recuperação (senha salva ou cancelada): encerra a sessão em todos os aparelhos. */
export async function finishRecovery() {
  try {
    localStorage.removeItem(RECOVERY_KEY)
  } catch {
    /* ignore */
  }
  if (!USE_SUPABASE) return
  const { error } = await sb().auth.signOut({ scope: 'global' })
  if (error) await sb().auth.signOut({ scope: 'local' })
}

/**
 * Avisa quando a sessão DESTA aba termina ou troca de pessoa fora do app (expirou, saiu em outra
 * aba com "lembrar de mim"). Os avisos chegam também de outras abas (BroadcastChannel do Supabase),
 * inclusive de uma demonstração com sessão própria: por isso confere a sessão que esta aba usa de
 * fato antes de agir, em vez de confiar no evento.
 *   - 'out': esta aba ficou sem sessão → volta ao login.
 *   - 'changed': esta aba passou a ter outra pessoa → recarrega a conta certa.
 */
export function onSessionChange(cb: (change: 'out' | 'changed') => void): () => void {
  if (!USE_SUPABASE) return () => undefined
  const { data } = sb().auth.onAuthStateChange((event) => {
    if (event !== 'SIGNED_OUT' && event !== 'SIGNED_IN') return
    // Fora do callback: o Supabase não deixa chamar getSession dentro dele (trava)
    window.setTimeout(async () => {
      const { data: current } = await sb().auth.getSession()
      const id = current.session?.user.id ?? null
      if (!id) {
        if (activeUserId) cb('out')
        activeUserId = null
      } else if (activeUserId && id !== activeUserId) {
        cb('changed')
      }
    }, 0)
  })
  return () => data.subscription.unsubscribe()
}

/** Quem está com a conta aberta nesta aba (para reconhecer troca de pessoa). */
let activeUserId: string | null = null

async function trackActiveUser() {
  const { data } = await sb().auth.getSession()
  activeUserId = data.session?.user.id ?? null
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
  void signOut()
}

/**
 * Encerra a sessão e espera terminar (na demonstração, apaga a conta temporária antes).
 * Quem chama deve aguardar antes de voltar ao login: assim a sessão antiga não "volta" num
 * recarregamento rápido nem derruba uma sessão nova aberta logo em seguida.
 */
export async function signOut(): Promise<void> {
  localStorage.removeItem(SESSION_KEY)
  sessionStorage.removeItem(SESSION_KEY)
  activeUserId = null
  if (USE_SUPABASE) await endSupabaseSession().catch(() => sb().auth.signOut({ scope: 'local' }).then(undefined, () => undefined))
}

export function sessionEmail() {
  return sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY)
}

/** Used when migrating an older single-user save into the account model. */
export function restoreSession(user: User) {
  upsert(user)
  startSession(user.email, true)
}
