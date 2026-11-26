/**
 * Peças compartilhadas pelos formulários de dinheiro: confirmação de exclusão, escolha de conta, tipo do lançamento.
 */
import { useRef } from 'react'
import { Repeat } from 'lucide-react'
import { Chip, cx, PrimaryButton, Switch } from '../../components/ui'
import { monthName } from '../../lib/format'
import { accountLabel, subaccounts, topAccounts, useStore } from '../../state/store'
import type { Account, AppState, PaymentMethod } from '../../types'

/** Keeps the last value of an entity so a sheet can play its exit animation after the entity is deleted. */
export function useLast<T>(value: T | undefined) {
  const ref = useRef(value)
  if (value !== undefined) ref.current = value
  return ref.current
}

export function ConfirmDelete({
  open,
  onOpen,
  onCancel,
  onConfirm,
  label,
  question,
  loading,
}: {
  open: boolean
  onOpen: () => void
  onCancel: () => void
  onConfirm: () => void
  label: string
  question: string
  loading?: boolean
}) {
  if (!open) {
    return (
      <PrimaryButton tone="danger" onClick={onOpen}>
        {label}
      </PrimaryButton>
    )
  }
  return (
    <div className="flex animate-rise flex-col gap-3 rounded-[22px] bg-esk-elevated p-4">
      <p className="font-sat text-[14px] text-white">{question}</p>
      <div className="grid grid-cols-2 gap-3">
        <PrimaryButton tone="dark" onClick={onCancel} disabled={loading}>
          Cancelar
        </PrimaryButton>
        <PrimaryButton onClick={onConfirm} loading={loading} loadingText="Removendo…">
          Confirmar
        </PrimaryButton>
      </div>
    </div>
  )
}

export const methodKey = (m: PaymentMethod) => (m.type === 'card' ? `card:${m.cardId}` : m.type)

export const keyToMethod = (k: string): PaymentMethod => (k.startsWith('card:') ? { type: 'card', cardId: k.slice(5) } : { type: k as 'pix' | 'cash' })

export const monthOf = (iso: string) => monthName(Number(iso.slice(5, 7)) - 1)

export const MAX_INSTALLMENTS = 48

/** Segmented control Gasto | Receita */
export function KindSwitch({ value, onChange }: { value: 'expense' | 'income'; onChange: (v: 'expense' | 'income') => void }) {
  return (
    <div role="radiogroup" aria-label="Tipo de lançamento" className="grid grid-cols-2 gap-1 rounded-[20px] bg-esk-elevated p-1 ring-1 ring-esk-track">
      {(['expense', 'income'] as const).map((k) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={value === k}
          onClick={() => onChange(k)}
          className={cx(
            'h-[40px] rounded-[16px] font-sat text-[14px] font-medium transition duration-200',
            value === k ? 'bg-esk-lime text-esk-ink' : 'text-esk-muted hover:text-white',
          )}
        >
          {k === 'expense' ? 'Gasto' : 'Receita'}
        </button>
      ))}
    </div>
  )
}

export function AccountChips({ value, onChange, accounts }: { value: string; onChange: (id: string) => void; accounts: Account[] }) {
  const { state } = useStore()
  // Conta e logo depois as subcontas dela ("Nubank", "Nubank · Caixinha")
  const ordered = accounts.filter((a) => !a.parentId).flatMap((a) => [a, ...accounts.filter((x) => x.parentId === a.id)])
  const rest = accounts.filter((a) => !ordered.includes(a))
  return (
    <div className="flex flex-wrap gap-2">
      {[...ordered, ...rest].map((a) => (
        <Chip key={a.id} active={value === a.id} onClick={() => onChange(a.id)}>
          {accountLabel(state, a.id)}
        </Chip>
      ))}
    </div>
  )
}

/** Linha "Repetir todo mês" */
export function RecurringRow({ checked, onChange, day, disabledReason, kind }: { checked: boolean; onChange: (v: boolean) => void; day: number; disabledReason?: string; kind: 'expense' | 'income' }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[20px] bg-esk-elevated px-4 py-3 ring-1 ring-esk-track">
      <div className="flex min-w-0 items-start gap-3">
        <Repeat size={18} strokeWidth={1.7} className={cx('mt-[2px] shrink-0', checked ? 'text-esk-lime' : 'text-esk-muted')} aria-hidden />
        <div className="min-w-0">
          <p className="font-sat text-[15px] font-medium text-white">Repetir todo mês</p>
          <p className="font-sat text-[12px] leading-[1.35] text-esk-muted">
            {disabledReason ??
              (checked
                ? `Todo dia ${day}. ${kind === 'income' ? 'Entra' : 'Sai'} sozinho no dia, sem criar meses antes da hora.`
                : `Para salário, aluguel, assinaturas…`)}
          </p>
        </div>
      </div>
      {!disabledReason && <Switch checked={checked} onChange={onChange} label="Repetir todo mês" />}
    </div>
  )
}

/* ------------------------------------------------- Adicionar / editar */

export function DetailList({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="mt-6 flex flex-col rounded-[24px] bg-esk-elevated px-5">
      {rows.map(([k, v], i) => (
        <div key={k} className={`flex justify-between gap-4 py-4 font-sat text-[15px] ${i ? 'border-t border-esk-border' : ''}`}>
          <dt className="text-esk-muted">{k}</dt>
          <dd className="text-right font-medium text-white">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Contas e subcontas em ordem: Nubank, Nubank · Caixinha, Inter… */
export function accountOptions(state: AppState) {
  return topAccounts(state).flatMap((a) => [a, ...subaccounts(state, a.id)])
}

export const monthYearOf = (iso: string) => `${monthName(Number(iso.slice(5, 7)) - 1)} de ${iso.slice(0, 4)}`
