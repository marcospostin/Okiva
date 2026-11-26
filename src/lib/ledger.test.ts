import { describe, expect, it } from 'vitest'
import type { Card, Transaction } from '../types'
import {
  adjustInvoice,
  anticipateInstallments,
  balanceEffect,
  cardEffect,
  invoiceCredit,
  invoiceDue,
  splitInstallments,
} from './ledger'

const TODAY = '2026-11-26'

const tx = (patch: Partial<Transaction>): Transaction => ({
  id: 't',
  name: 'Teste',
  category: 'outros',
  method: { type: 'pix' },
  date: TODAY,
  amount: 100,
  source: 'manual',
  ...patch,
})

const card = (invoice: number): Card =>
  ({ id: 'c1', nickname: 'Nubank', last4: '4552', limit: 5000, dueDay: 10, invoice, color: 'gradient' }) as unknown as Card

describe('saldo (balanceEffect)', () => {
  it('receita soma e gasto fora do cartão subtrai', () => {
    expect(balanceEffect(tx({ kind: 'income' }), TODAY)).toBe(100)
    expect(balanceEffect(tx({ kind: 'expense' }), TODAY)).toBe(-100)
  })
  it('gasto no cartão não mexe no saldo (sai ao pagar a fatura)', () => {
    expect(balanceEffect(tx({ method: { type: 'card', cardId: 'c1' } }), TODAY)).toBe(0)
  })
  it('pagamento de fatura subtrai', () => {
    expect(balanceEffect(tx({ kind: 'invoice_payment', method: { type: 'card', cardId: 'c1' } }), TODAY)).toBe(-100)
  })
  it('transferência não muda o total', () => {
    expect(balanceEffect(tx({ kind: 'transfer' }), TODAY)).toBe(0)
  })
  it('ajuste fora do cartão entra com o próprio sinal; no cartão, não mexe no saldo', () => {
    expect(balanceEffect(tx({ kind: 'adjustment', amount: -350 }), TODAY)).toBe(-350)
    expect(balanceEffect(tx({ kind: 'adjustment', amount: 50 }), TODAY)).toBe(50)
    expect(balanceEffect(tx({ kind: 'adjustment', method: { type: 'card', cardId: 'c1' } }), TODAY)).toBe(0)
  })
  it('compra de cartão removido fica fora do saldo; o pagamento continua saindo', () => {
    expect(balanceEffect(tx({ kind: 'expense', method: { type: 'cash' }, removedCard: 'Nubank •• 4552' }), TODAY)).toBe(0)
    expect(balanceEffect(tx({ kind: 'invoice_payment', method: { type: 'cash' }, removedCard: 'Nubank •• 4552' }), TODAY)).toBe(-100)
  })
  it('lançamento com data futura ainda não conta', () => {
    expect(balanceEffect(tx({ kind: 'income', date: '2026-12-05' }), TODAY)).toBe(0)
  })
})

describe('fatura (cardEffect / adjustInvoice)', () => {
  const onCard = { type: 'card', cardId: 'c1' } as const
  it('compra soma e pagamento subtrai', () => {
    expect(cardEffect(tx({ method: onCard }), TODAY)).toEqual({ cardId: 'c1', delta: 100 })
    expect(cardEffect(tx({ kind: 'invoice_payment', method: onCard }), TODAY)).toEqual({ cardId: 'c1', delta: -100 })
  })
  it('parcela futura e parcela que já estava na fatura não somam', () => {
    expect(cardEffect(tx({ method: onCard, posted: false, date: '2026-12-26' }), TODAY)).toBeNull()
    expect(cardEffect(tx({ method: onCard, alreadyInInvoice: true }), TODAY)).toBeNull()
  })
  it('pagar mais que a fatura deixa crédito, e desfazer volta ao valor exato', () => {
    const payment = tx({ kind: 'invoice_payment', method: onCard, amount: 150 })
    const paid = adjustInvoice([card(100)], payment, 1, TODAY)
    expect(paid[0].invoice).toBe(-50)
    expect(invoiceDue(paid[0])).toBe(0)
    expect(invoiceCredit(paid[0])).toBe(50)
    expect(adjustInvoice(paid, payment, -1, TODAY)[0].invoice).toBe(100)
  })
})

describe('parcelas', () => {
  it('divide como a maquininha: os centavos que sobram vão na 1ª', () => {
    expect(splitInstallments(100, 3)).toEqual([33.34, 33.33, 33.33])
    expect(splitInstallments(1200, 3).reduce((a, b) => a + b, 0)).toBe(1200)
  })

  it('adiantar traz as últimas parcelas para hoje, com o desconto dividido em centavos', () => {
    const group = [1, 2, 3, 4].map((n) =>
      tx({
        id: `p${n}`,
        method: { type: 'card', cardId: 'c1' },
        amount: 100,
        date: `2027-0${n}-10`,
        posted: false,
        installment: { group: 'g', number: n, total: 4 },
      }),
    )
    const done = anticipateInstallments(group, 2, 10.01, TODAY)
    expect(done.map((t) => t.installment?.number)).toEqual([4, 3])
    expect(done.every((t) => t.date === TODAY && t.posted === true)).toBe(true)
    const total = Math.round(done.reduce((s, t) => s + t.amount, 0) * 100) / 100
    expect(total).toBe(189.99)
  })
})
