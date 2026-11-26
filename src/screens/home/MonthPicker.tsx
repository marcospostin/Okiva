/**
 * Seletor de mês da Home (lista com rolagem até o mês escolhido).
 */
import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cx } from '../../components/ui'
import { capitalize, monthName } from '../../lib/format'
import { currentMonth } from '../../state/store'

export const monthLabel = (key: string) => {
  const name = capitalize(monthName(Number(key.slice(5, 7)) - 1))
  return key.slice(0, 4) === currentMonth().slice(0, 4) ? name : `${name} ${key.slice(0, 4)}`
}

/**
 * Seletor de mês. Fechado mostra só o nome; aberto marca "(atual)" e deixa os meses
 * que ainda não chegaram (só parcelas) num tom mais leve.
 */
/** Rola só a lista (não a página) até o mês escolhido */
const centerInList = (el: HTMLLIElement | null) => {
  const list = el?.parentElement
  if (el && list) list.scrollTop = el.offsetTop - list.clientHeight / 2 + el.clientHeight / 2
}

export function MonthPicker({ months, value, onChange }: { months: string[]; value: string; onChange: (m: string) => void }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const current = currentMonth()
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  const future = value > current
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Escolher mês: ${monthLabel(value)}`}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-[16px] bg-esk-elevated py-[6px] pr-3 pl-3 font-inter-m text-[12px] leading-[1.3] font-medium transition hover:bg-esk-hover"
      >
        <span className={future ? 'text-esk-muted' : 'text-white'}>{monthLabel(value)}</span>
        <ChevronDown size={12} className={cx('text-esk-muted transition', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label="Meses"
          className="absolute top-[calc(100%+6px)] right-0 z-30 max-h-[300px] min-w-[220px] animate-rise overflow-y-auto rounded-[18px] bg-esk-elevated p-1 shadow-[0_12px_32px_rgba(0,0,0,0.5)] ring-1 ring-esk-track"
        >
          {months.map((m) => {
            const isFuture = m > current
            const selected = m === value
            return (
              <li key={m} role="option" aria-selected={selected} ref={selected ? centerInList : undefined}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(m)
                    setOpen(false)
                  }}
                  className={cx(
                    'flex w-full items-center justify-between gap-3 rounded-[14px] px-3 py-[9px] text-left font-inter-m text-[13px] font-medium transition hover:bg-white/[0.05]',
                    isFuture ? 'text-esk-muted' : 'text-white',
                    selected && 'bg-white/[0.06]',
                  )}
                >
                  <span className="whitespace-nowrap">
                    {monthLabel(m)}
                    {m === current && <span className="text-esk-lime"> (atual)</span>}
                    {isFuture && <span className="ml-2 rounded-[6px] bg-white/[0.06] px-[5px] py-px text-[10px] text-esk-muted">previsto</span>}
                  </span>
                  {selected && <Check size={14} className="text-esk-lime" aria-hidden />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
