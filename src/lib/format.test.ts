import { describe, expect, it } from 'vitest'
import { isValidDate } from './format'

describe('isValidDate', () => {
  it('aceita datas reais a partir de 2000', () => {
    expect(isValidDate('2026-11-26')).toBe(true)
    expect(isValidDate('2028-02-29')).toBe(true)
  })
  it('recusa datas absurdas, inexistentes ou mal formatadas', () => {
    expect(isValidDate('0202-01-01')).toBe(false)
    expect(isValidDate('20255-01-01')).toBe(false)
    expect(isValidDate('2026-02-31')).toBe(false)
    expect(isValidDate('2026-13-01')).toBe(false)
    expect(isValidDate('26/11/2026')).toBe(false)
    expect(isValidDate('')).toBe(false)
  })
})
