/**
 * Serviços da tela Conta: segurança (e-mail, senha, sessões, confirmação por e-mail),
 * notificações e suporte. Com Supabase usam o Auth e as tabelas reais; no protótipo
 * respondem localmente com a mesma assinatura.
 */
import type { NotificationPrefs } from '../types'
import type { Json } from './database.types'
import { ApiError, friendlyMessage, mockDelay, USE_SUPABASE, NETWORK_ERROR, OFFLINE_MESSAGE } from './http'
import { sb } from './supabase'
import { authError } from './auth'

export const APP_VERSION = '1.1.0'

/** Endereço de suporte (Ajuda, Política de privacidade). É o mesmo Gmail que envia os e-mails do Supabase. */
export const SUPPORT_EMAIL = 'okiva.financial@gmail.com'

/** Lojas para "Avaliar o Okiva". Vazio = app ainda não publicado nessa loja. */
export const STORE_URLS = { ios: '', android: '' }

const mock = async <T>(value: T, ms?: number) => {
  await mockDelay(ms)
  return value
}

async function currentEmail() {
  const { data } = await sb().auth.getUser()
  const email = data.user?.email
  if (!email) throw new ApiError('Sua sessão expirou. Entre de novo.', 401)
  return email
}

/** Esconde parte do e-mail: marcos@gmail.com → m•••s@gmail.com */
export function maskEmail(email: string) {
  const [name, domain] = email.split('@')
  if (!domain) return email
  if (name.length <= 2) return `${name[0] ?? ''}•@${domain}`
  return `${name[0]}•••${name[name.length - 1]}@${domain}`
}

/** Erro ao enviar e-mail (link ou código): mensagem sobre o envio, não sobre "entrar". */
function sendError(err: { message?: string; status?: number }) {
  const msg = err.message ?? ''
  if (/rate limit|too many|seconds/i.test(msg)) return new ApiError('Muitos pedidos seguidos. Espere alguns minutos e tente de novo.', 429)
  if (NETWORK_ERROR.test(msg)) return new ApiError(OFFLINE_MESSAGE, 0)
  if (/invalid.*email|email.*invalid/i.test(msg)) return new ApiError('Confira o e-mail digitado.', 422)
  return new ApiError('Não deu para enviar o e-mail agora. Tente de novo em alguns minutos.', err.status ?? 500)
}

/* ------------------------------------------------------------- segurança */

export const securityApi = {
  /** Confere a senha atual (reautenticação). Não muda nada se estiver errada. */
  checkPassword: async (password: string): Promise<void> => {
    if (!USE_SUPABASE) return mock(undefined)
    const email = await currentEmail()
    const { error } = await sb().auth.signInWithPassword({ email, password })
    if (error) throw /invalid login/i.test(error.message) ? new ApiError('Senha incorreta.', 400) : authError(error)
  },

  /**
   * Envia um código (e um link) para o e-mail da conta. Usar o código ou o link abre uma sessão
   * "verificada por e-mail", que o banco exige para apagar dados (recent_email_verification).
   */
  sendEmailCode: async (redirect: string): Promise<string> => {
    if (!USE_SUPABASE) return mock('voce@email.com')
    const email = await currentEmail()
    const { error } = await sb().auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: redirect } })
    if (error) throw sendError(error)
    return email
  },

  verifyEmailCode: async (code: string): Promise<void> => {
    if (!USE_SUPABASE) return mock(undefined)
    const email = await currentEmail()
    const { error } = await sb().auth.verifyOtp({ email, token: code.trim(), type: 'email' })
    if (error) throw /expired|invalid/i.test(error.message) ? new ApiError('Código inválido ou vencido. Peça outro.', 400) : authError(error)
  },

  /** Troca de e-mail: o Supabase manda um link de confirmação (para o e-mail novo e, com "Secure email change", também para o atual). */
  changeEmail: async (newEmail: string): Promise<void> => {
    if (!USE_SUPABASE) return mock(undefined)
    const { error } = await sb().auth.updateUser({ email: newEmail.trim().toLowerCase() }, { emailRedirectTo: window.location.origin })
    if (error) {
      // Mensagem genérica: não revela se o e-mail já é usado por outra conta
      if (/already|registered|exists/i.test(error.message)) throw new ApiError('Não deu para usar esse e-mail. Confira e tente outro.', 422)
      throw sendError(error)
    }
  },

  /** Troca de senha com a senha atual conferida antes. */
  changePassword: async (current: string, next: string): Promise<void> => {
    if (!USE_SUPABASE) return mock(undefined)
    await securityApi.checkPassword(current)
    const { error } = await sb().auth.updateUser({ password: next })
    if (error) {
      if (/different|same/i.test(error.message)) throw new ApiError('A nova senha precisa ser diferente da atual.', 422)
      throw authError(error)
    }
    // Senha nova: as outras sessões (outros aparelhos) deixam de valer
    await sb().auth.signOut({ scope: 'others' }).catch(() => undefined)
  },

  /** O banco considera a sessão verificada por e-mail nos últimos 15 min? (link "confirmar" do e-mail) */
  isEmailVerifiedRecently: async (): Promise<boolean> => {
    if (!USE_SUPABASE) return true
    const { data, error } = await sb().rpc('recent_email_verification')
    return !error && data === true
  },

  /** Nova senha depois do link "Esqueci minha senha" (a sessão de recuperação já está aberta). */
  setNewPassword: async (next: string): Promise<void> => {
    if (!USE_SUPABASE) return mock(undefined)
    const { error } = await sb().auth.updateUser({ password: next })
    if (error) throw authError(error)
  },

  /** Link para redefinir a senha (tela de login). */
  requestPasswordReset: async (email: string): Promise<void> => {
    if (!USE_SUPABASE) return mock(undefined)
    const { error } = await sb().auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: window.location.origin })
    if (error) throw sendError(error)
  },

  /** Encerra a sessão em todos os aparelhos (inclusive este). */
  signOutEverywhere: async (): Promise<void> => {
    if (!USE_SUPABASE) return mock(undefined)
    const { error } = await sb().auth.signOut({ scope: 'global' })
    if (error) throw authError(error)
  },
}

/* ---------------------------------------------------------- notificações */

export const DEFAULT_NOTIFICATIONS: NotificationPrefs = {
  invoice_due: true,
  cap_alert: true,
  uncategorized: true,
  recurrence: false,
  weekly_summary: false,
  news: false,
}

export const notificationsApi = {
  save: async (prefs: NotificationPrefs): Promise<NotificationPrefs> => {
    if (!USE_SUPABASE) return mock(prefs)
    const { data } = await sb().auth.getUser()
    const id = data.user?.id
    if (!id) throw new ApiError('Sua sessão expirou. Entre de novo.', 401)
    const { error } = await sb().from('profiles').update({ notification_prefs: prefs as unknown as Json }).eq('id', id)
    if (error) throw new ApiError('Não deu para salvar. Tente de novo.', 500)
    return prefs
  },
}

/* ---------------------------------------------------------------- suporte */

export type SupportKind = 'duvida' | 'problema' | 'sugestao' | 'avaliacao'

/** Informações técnicas anexadas a um relato (mostradas à pessoa antes de enviar). */
export function deviceInfo() {
  return {
    app: APP_VERSION,
    navegador: navigator.userAgent,
    tela: `${window.innerWidth}×${window.innerHeight}`,
    idioma: navigator.language,
    endereco: window.location.origin,
  }
}

export const supportApi = {
  send: async (input: { kind: SupportKind; message: string; rating?: number; meta?: Record<string, unknown> }): Promise<void> => {
    if (!USE_SUPABASE) return mock(undefined, 500)
    const { error } = await sb()
      .from('support_requests')
      .insert({ kind: input.kind, message: input.message.trim(), rating: input.rating ?? null, meta: (input.meta ?? deviceInfo()) as never })
    if (error) {
      // Limites do banco (demonstração, muitas mensagens seguidas) já vêm com a mensagem pronta
      const own = friendlyMessage(error.message)
      if ((error.code === 'P0001' || error.code === '42501') && own) throw new ApiError(own, 429)
      if (/fetch|network|Failed to fetch|Load failed/i.test(error.message)) throw new ApiError(OFFLINE_MESSAGE, 0)
      throw new ApiError('Não deu para enviar agora. Tente de novo.', 500)
    }
  },
}
