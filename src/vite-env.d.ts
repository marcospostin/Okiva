/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL do backend. Vazio = mesmo domínio do front. */
  readonly VITE_API_URL?: string
  /** "false" liga o backend real; qualquer outro valor usa os mocks locais. */
  readonly VITE_USE_MOCK?: string
  /** URL do projeto Supabase (https://<ref>.supabase.co). Com a chave abaixo, liga o banco real. */
  readonly VITE_SUPABASE_URL?: string
  /** Chave publishable/anon do Supabase (pública; a proteção é a RLS). */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
