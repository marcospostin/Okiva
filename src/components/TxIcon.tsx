import { ArrowDownLeft, ArrowLeftRight, CreditCard, Scale } from 'lucide-react'
import { kindOf } from '../lib/ledger'
import type { Transaction } from '../types'
import { CategoryRowIcon } from './icons'

/** Ícone da linha de lançamento (Home e extrato da conta): receita, pagamento, transferência, ajuste ou a categoria. */
export function TxIcon({ t, size }: { t: Transaction; size?: number }) {
  const k = kindOf(t)
  if (k === 'income') return <ArrowDownLeft size={20} strokeWidth={1.7} className="text-esk-lime" aria-hidden />
  if (k === 'invoice_payment') return <CreditCard size={19} strokeWidth={1.6} className="text-esk-text-2" aria-hidden />
  if (k === 'transfer') return <ArrowLeftRight size={19} strokeWidth={1.6} className="text-esk-text-2" aria-hidden />
  if (k === 'adjustment') return <Scale size={19} strokeWidth={1.6} className="text-esk-text-2" aria-hidden />
  return <CategoryRowIcon category={t.category} name={t.name} size={size} />
}
