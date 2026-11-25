/**
 * Temas de teste: troca as cores do app sem mudar o site para ninguém.
 *
 *   ?tema=classico   cores de antes (pouco contraste)
 *   ?tema=lilas      cinzas levemente lilás
 *   ?tema=padrao     volta ao padrão (paleta A, neutra)
 *
 * A escolha fica só neste navegador (localStorage). As cores de cada tema estão em
 * src/index.css (`:root[data-theme='…']`). Para criar outro tema: um bloco novo lá + o nome aqui.
 */
export const THEMES = ['classico', 'lilas'] as const
export type ThemeName = (typeof THEMES)[number]

const KEY = 'okiva:tema'

export function applyTheme() {
  if (typeof window === 'undefined') return
  try {
    const url = new URL(window.location.href)
    const asked = url.searchParams.get('tema')
    if (asked !== null) {
      if ((THEMES as readonly string[]).includes(asked)) localStorage.setItem(KEY, asked)
      else localStorage.removeItem(KEY)
      // Tira o parâmetro do endereço (a escolha já ficou salva)
      url.searchParams.delete('tema')
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
    }
    const saved = localStorage.getItem(KEY)
    if (saved && (THEMES as readonly string[]).includes(saved)) document.documentElement.dataset.theme = saved
    else delete document.documentElement.dataset.theme
  } catch {
    /* sem storage (modo privado): fica o padrão */
  }
}
