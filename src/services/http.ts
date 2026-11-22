/**
 * Cliente HTTP único do app.
 *
 * - `VITE_API_URL`   base do backend (ex.: https://api.okiva.app). Vazio = mesmo domínio.
 * - `VITE_USE_MOCK`  "false" liga o backend real. Qualquer outro valor (ou ausente) usa os mocks locais.
 *
 * Toda chamada passa por `request`, que aplica timeout, token de sessão e converte
 * erros em `ApiError` com mensagem pronta para exibir ao usuário.
 */

/**
 * Fonte dos dados:
 *  - Supabase: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` definidos (e `VITE_USE_MOCK` diferente de "true").
 *  - Mock local: padrão quando o Supabase não está configurado (ou `VITE_USE_MOCK=true`).
 *  - API HTTP própria: `VITE_USE_MOCK=false` sem Supabase.
 */
export const USE_SUPABASE =
  !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY && import.meta.env.VITE_USE_MOCK !== 'true'
export const USE_MOCK = !USE_SUPABASE && import.meta.env.VITE_USE_MOCK !== 'false'
/** IA (leitura de fatura e assistente) continua local até existir um backend de IA em `VITE_API_URL`. */
export const USE_AI_MOCK = USE_MOCK || (USE_SUPABASE && !import.meta.env.VITE_API_URL)
const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
const TOKEN_KEY = 'okiva:token'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage indisponível: a sessão vale só nesta aba */
  }
}

function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

const FRIENDLY: Record<number, string> = {
  0: 'Sem conexão. Confira sua internet e tente de novo.',
  401: 'Sua sessão expirou. Entre de novo.',
  403: 'Você não tem acesso a isso.',
  404: 'Não encontramos esse item.',
  408: 'O servidor demorou para responder. Tente de novo.',
  409: 'Esse item mudou em outro lugar. Atualize e tente de novo.',
  413: 'O arquivo é grande demais.',
  422: 'Confira os dados e tente de novo.',
  429: 'Muitas tentativas. Espere um pouco.',
}

export async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  opts: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<T> {
  const ctrl = new AbortController()
  const timeout = window.setTimeout(() => ctrl.abort('timeout'), opts.timeoutMs ?? 15000)
  opts.signal?.addEventListener('abort', () => ctrl.abort(opts.signal?.reason))
  const isForm = body instanceof FormData
  const token = getToken()

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      signal: ctrl.signal,
      headers: {
        Accept: 'application/json',
        ...(isForm || body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    })
  } catch (err) {
    if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    throw new ApiError(FRIENDLY[ctrl.signal.reason === 'timeout' ? 408 : 0], ctrl.signal.reason === 'timeout' ? 408 : 0)
  } finally {
    window.clearTimeout(timeout)
  }

  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const message = (data && typeof data.message === 'string' && data.message) || FRIENDLY[res.status] || 'Algo deu errado. Tente de novo.'
    throw new ApiError(message, res.status, data?.code)
  }
  return data as T
}

/** Latência simulada dos mocks: deixa os estados de carregamento visíveis como no backend real. */
export const mockDelay = (ms = 280) => new Promise((r) => setTimeout(r, ms + Math.random() * 120))

/** Mensagem pronta para toast a partir de qualquer erro. */
export const errorMessage = (err: unknown, fallback = 'Algo deu errado. Tente de novo.') =>
  err instanceof ApiError ? err.message : fallback
