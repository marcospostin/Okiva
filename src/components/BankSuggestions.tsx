import { BANK_LIST_ID, BANK_SUGGESTIONS } from '../data/banks'

/** Lista de bancos que o navegador sugere ao digitar no campo "Banco" (list={BANK_LIST_ID}). */
export function BankSuggestions() {
  return (
    <datalist id={BANK_LIST_ID}>
      {BANK_SUGGESTIONS.map((b) => (
        <option key={b} value={b} />
      ))}
    </datalist>
  )
}
