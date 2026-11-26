import { describe, expect, it } from 'vitest'
import { friendlyMessage } from './http'

describe('friendlyMessage', () => {
  it('deixa passar as mensagens escritas pelo Okiva', () => {
    for (const msg of ['Parcelas entre 2 e 48.', 'Apague as subcontas desta conta antes.', 'Só faltam 4 parcelas desta compra.', 'Categoria inválida: pets']) {
      expect(friendlyMessage(msg)).toBe(msg)
    }
  })
  it('esconde as mensagens técnicas do banco', () => {
    for (const msg of [
      'new row for relation "transactions" violates check constraint "transactions_amount_check"',
      'duplicate key value violates unique constraint "categories_user_label_key"',
      'new row violates row-level security policy for table "support_requests"',
      'value too long for type character varying(30)',
      'invalid input syntax for type uuid: "x"',
      'JWT expired',
    ]) {
      expect(friendlyMessage(msg)).toBeUndefined()
    }
  })
})
