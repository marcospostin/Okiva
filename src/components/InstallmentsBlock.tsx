import { ChevronDown, Layers } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { brl, brlShort, HIDDEN_MONEY, monthName } from '../lib/format'
import { monthlySteps, purchasesInMonth } from '../lib/installments'
import { monthKey } from '../lib/format'
import type { AppState } from '../types'
import { cx } from './ui'

const monthYear = (iso: string) => `${monthName(Number(iso.slice(5, 7)) - 1)} de ${iso.slice(0, 4)}`
const monthShort = (key: string, withYear: boolean) => {
  const name = monthName(Number(key.slice(5, 7)) - 1).slice(0, 3)
  return withYear ? `${name}/${key.slice(2, 4)}` : name
}

/**
 * "Compras parceladas" no topo de Transações (Home).
 * Recolhido: quanto vai para compras parceladas NO MÊS escolhido, quantas são e quando a
 * última termina. Aberto: cada compra (parcela X de Y, quanto falta) e o total mês a mês.
 * Só aparece quando há parcela no mês.
 */
export function InstallmentsBlock({
  state,
  month,
  today,
  onPickMonth,
  onOpenTx,
}: {
  state: AppState
  month: string
  today: string
  onPickMonth: (key: string) => void
  onOpenTx: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const hidden = state.hideBalance
  const money = (n: number) => (hidden ? HIDDEN_MONEY : brl(n))
  const purchases = useMemo(() => purchasesInMonth(state, month, today), [state, month, today])
  const lastEnd = purchases.reduce((max, p) => (p.endDate > max ? p.endDate : max), '')
  const steps = useMemo(() => (lastEnd ? monthlySteps(state, month, monthKey(lastEnd)) : []), [state, month, lastEnd])

  if (purchases.length === 0) return null
  const monthTotal = purchases.reduce((s, p) => s + p.current.amount, 0)
  const monthLabel = monthName(Number(month.slice(5, 7)) - 1)
  const count = purchases.length
  const endsThisMonth = monthKey(lastEnd) === month

  return (
    <div className="min-w-0 animate-rise rounded-[22px] bg-esk-surface ring-1 ring-esk-track [contain:inline-size]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-3 rounded-[22px] px-4 py-3 text-left transition hover:bg-white/[0.02]"
      >
        <span className="grid size-[36px] shrink-0 place-items-center rounded-full bg-esk-row text-esk-text-2">
          <Layers size={18} strokeWidth={1.7} aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-[2px] leading-[1.4]">
          <span className="font-inter-m text-[11px] font-medium tracking-[1.1px] text-esk-muted">COMPRAS PARCELADAS</span>
          <span className="font-inter text-[13px] text-white">
            <span className="font-inter-m font-medium">{money(monthTotal)}</span> em {monthLabel}
          </span>
          <span className="font-inter text-[11px] text-esk-muted">
            {count} {count === 1 ? 'compra' : 'compras'} ·{' '}
            {endsThisMonth ? (count === 1 ? 'termina neste mês' : 'todas terminam neste mês') : `${count === 1 ? 'termina' : 'a última termina'} em ${monthYear(lastEnd)}`}
          </span>
        </span>
        <ChevronDown size={18} className={cx('shrink-0 text-esk-muted transition', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <div id={panelId} className="flex animate-rise flex-col gap-4 px-4 pb-4">
          <ul className="flex flex-col">
            {purchases.map((p, i) => {
              const done = p.remaining === 0
              return (
                <li key={p.group}>
                  {i > 0 && <div className="h-px bg-esk-border" />}
                  <button type="button" onClick={() => onOpenTx(p.current.id)} className="flex w-full flex-col gap-2 py-3 text-left transition hover:opacity-80">
                    <span className="flex items-start gap-3">
                      <span className="flex min-w-0 flex-1 flex-col gap-[2px] leading-[1.4]">
                        <span className="truncate font-inter-m text-[14px] font-medium text-white">{p.name}</span>
                        <span className="truncate font-inter text-[11px] text-esk-muted">
                          parcela {p.current.installment!.number} de {p.total} · total {hidden ? HIDDEN_MONEY : brlShort(p.purchaseTotal)}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-[2px] leading-[1.4]">
                        <span className="font-inter-m text-[13px] font-medium text-white">{money(p.current.amount)}</span>
                        <span className={cx('font-inter text-[11px]', done ? 'text-esk-positive' : 'text-esk-muted')}>
                          {done ? 'quitada' : `faltam ${money(p.remaining)}`}
                        </span>
                      </span>
                    </span>
                    <span
                      className="h-[5px] w-full overflow-hidden rounded-full bg-esk-track"
                      role="progressbar"
                      aria-label={`${p.name}: ${p.paidCount} de ${p.total} parcelas vencidas`}
                      aria-valuemin={0}
                      aria-valuemax={p.total}
                      aria-valuenow={p.paidCount}
                    >
                      <span className="block h-full rounded-full bg-esk-lilac transition-[width] duration-700" style={{ width: `${(p.paidCount / p.total) * 100}%` }} />
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          {steps.length > 1 && <StepBars rows={steps} selected={month} hidden={hidden} onPick={onPickMonth} />}
        </div>
      )}
    </div>
  )
}

/** Total das compras parceladas por mês: o valor só aparece onde muda (os "degraus"). */
function StepBars({ rows, selected, hidden, onPick }: { rows: { key: string; value: number }[]; selected: string; hidden: boolean; onPick: (key: string) => void }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  const height = 72
  const multiYear = rows[0].key.slice(0, 4) !== rows[rows.length - 1].key.slice(0, 4)
  return (
    <div className="flex flex-col gap-2 border-t border-esk-border pt-4">
      <p className="font-inter-m text-[11px] font-medium tracking-[1.1px] text-esk-muted">TOTAL POR MÊS</p>
      <div className="flex min-w-0 items-end gap-[2px] pb-1" role="list" aria-label="Total de compras parceladas por mês">
        {rows.map((r, i) => {
          const changed = i === 0 || r.value !== rows[i - 1].value
          const isSelected = r.key === selected
          // Muitos meses: rótulo a cada 3 (e sempre no escolhido) para não encavalar
          const showMonth = rows.length <= 12 || isSelected || i % 3 === 0
          return (
            <button
              key={r.key}
              type="button"
              role="listitem"
              onClick={() => onPick(r.key)}
              aria-label={`${monthName(Number(r.key.slice(5, 7)) - 1)} de ${r.key.slice(0, 4)}: ${hidden ? 'valor oculto' : brl(r.value)}`}
              aria-current={isSelected ? 'date' : undefined}
              className={cx('flex min-w-0 flex-1 flex-col items-center gap-1 rounded-[10px] pt-1 pb-1 transition hover:bg-white/[0.04]', isSelected && 'bg-white/[0.06]')}
            >
              <span className="h-[14px] font-inter text-[9px] whitespace-nowrap text-esk-muted [overflow:visible]">{changed && !hidden && r.value > 0 ? brlShort(Math.round(r.value)) : ''}</span>
              <span className="flex w-full items-end justify-center" style={{ height }}>
                <span
                  className={cx('w-full max-w-[22px] origin-bottom animate-[grow-y_700ms_cubic-bezier(0.2,0.8,0.2,1)_both] rounded-t-[5px]', isSelected ? 'bg-esk-lilac' : 'bg-esk-lilac/45')}
                  style={{ height: `${Math.max(r.value > 0 ? 3 : 0, (r.value / max) * height)}px` }}
                />
              </span>
              <span className={cx('font-inter text-[10px] whitespace-nowrap', isSelected ? 'text-white' : 'text-esk-subtle')}>{showMonth ? monthShort(r.key, multiYear && (i === 0 || r.key.endsWith('-01'))) : ' '}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
