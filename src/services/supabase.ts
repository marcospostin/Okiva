/**
 * Cliente Supabase do Okiva.
 *
 * Só existe quando `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` estão definidos (ver http.ts).
 * A sessão fica no localStorage ("Lembrar de mim") ou só nesta aba (sessionStorage).
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

/** Grava a sessão onde a pessoa escolheu ("Lembrar de mim" = localStorage). */
const authStorage = {
  getItem: (key: string) => safe(() => sessionStorage.getItem(key) ?? localStorage.getItem(key), null),
  setItem: (key: string, value: string) =>
    safe(() => {
      const remember = localStorage.getItem(REMEMBER_KEY) !== 'false'
      ;(remember ? localStorage : sessionStorage).setItem(key, value)
      ;(remember ? sessionStorage : localStorage).removeItem(key)
    }, undefined),
  removeItem: (key: string) =>
    safe(() => {
      localStorage.removeItem(key)
      sessionStorage.removeItem(key)
    }, undefined),
}

export function setRemember(remember: boolean) {
  safe(() => localStorage.setItem(REMEMBER_KEY, String(remember)), undefined)
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
