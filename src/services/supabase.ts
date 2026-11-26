/**
 * Cliente Supabase do Okiva.
 *
 * Só existe quando `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` estão definidos (ver http.ts).
 * A sessão fica no localStorage ("Lembrar de mim") ou só nesta aba (sessionStorage); a escolha vale por aba.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { USE_SUPABASE } from './http'

const REMEMBER_KEY = 'okiva:remember'

const safe = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn()
  } catch {
    return fallback
  }
}

/**
 * "Lembrar de mim" vale por aba (sessionStorage). Antes ficava no localStorage, compartilhado:
 * abrir a demonstração numa aba gravava "não lembrar" e apagava a sessão salva, derrubando a
 * conta real aberta nas outras abas.
 *   - Lembrar (padrão, e abas novas): sessão no localStorage, compartilhada entre abas.
 *   - Não lembrar (login sem a opção, demonstração): sessão só no sessionStorage desta aba,
 *     sem ler nem apagar a sessão salva das outras abas.
 */
const remembers = (key: string) =>
  safe(() => {
    const flag = sessionStorage.getItem(REMEMBER_KEY)
    if (flag !== null) return flag !== 'false'
    // Aba aberta antes desta versão: se a sessão já estava só nela, continua "sem lembrar"
    // (senão uma demonstração aberta gravaria a sessão no localStorage e trocaria a conta das outras abas)
    if (sessionStorage.getItem(key) !== null) {
      sessionStorage.setItem(REMEMBER_KEY, 'false')
      return false
    }
    return true
  }, true)

const authStorage = {
  getItem: (key: string) =>
    safe(() => (remembers(key) ? (sessionStorage.getItem(key) ?? localStorage.getItem(key)) : sessionStorage.getItem(key)), null),
  setItem: (key: string, value: string) =>
    safe(() => {
      if (remembers(key)) {
        localStorage.setItem(key, value)
        sessionStorage.removeItem(key)
      } else {
        sessionStorage.setItem(key, value)
      }
    }, undefined),
  removeItem: (key: string) =>
    safe(() => {
      const remember = remembers(key)
      sessionStorage.removeItem(key)
      // Sair de uma aba "sem lembrar" (ex.: demonstração) não encerra a conta salva das outras abas
      if (remember) localStorage.removeItem(key)
    }, undefined),
}

export function setRemember(remember: boolean) {
  safe(() => sessionStorage.setItem(REMEMBER_KEY, String(remember)), undefined)
  // Valor antigo, compartilhado entre abas: não vale mais
  safe(() => localStorage.removeItem(REMEMBER_KEY), undefined)
}

let client: SupabaseClient<Database> | null = null

/** Cliente tipado. Use só quando USE_SUPABASE for true. */
export function sb(): SupabaseClient<Database> {
  if (!USE_SUPABASE) throw new Error('Supabase não configurado (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).')
  client ??= createClient<Database>(import.meta.env.VITE_SUPABASE_URL!, import.meta.env.VITE_SUPABASE_ANON_KEY!, {
    auth: { storage: authStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })
  return client
}
