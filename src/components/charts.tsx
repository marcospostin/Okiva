/**
 * Gráficos dos relatórios em SVG puro (sem biblioteca): rosca, barras horizontais e barras por mês.
 * Cores vêm das categorias; "sem categoria" e "previsto" usam listras.
 */
import { useId, type ReactNode } from 'react'
import { cx } from './ui'

export interface Slice {
  key: string
  value: number
  color: string
  /** Listrado: sem categoria / outros */
  hatched?: boolean
  label: string
}

/** Rosca com o total no meio. Tocar numa fatia chama onSelect. */
export function Donut({
  slices,
  size = 220,
  thickness = 30,
  center,
  onSelect,
  label,
}: {
  slices: Slice[]
  size?: number
  thickness?: number
  center?: ReactNode
  onSelect?: (key: string) => void
  label: string
}) {
  const id = useId().replace(/:/g, '')
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const total = slices.reduce((s, x) => s + x.value, 0)
  // Pequeno espaço entre as fatias (em comprimento de arco), só quando há mais de uma
  const gap = slices.length > 1 ? Math.min(6, c * 0.012) : 0
  let offset = 0
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={label} className="-rotate-90">
        <defs>
          <pattern id={`hatch-${id}`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="7" height="7" fill="#5a5a60" />
            <rect width="3" height="7" fill="#3a3a3f" />
          </pattern>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-esk-track)" strokeWidth={thickness} />
        {total > 0 &&
          slices.map((s) => {
            const len = (s.value / total) * c
            const dash = Math.max(0, len - gap)
            const el = (
              <circle
                key={s.key}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.hatched ? `url(#hatch-${id})` : s.color}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
                className={cx('origin-center animate-[fade-in_500ms_ease-out_both] transition-opacity', onSelect && 'cursor-pointer hover:opacity-80')}
                onClick={onSelect ? () => onSelect(s.key) : undefined}
              >
                <title>{s.label}</title>
              </circle>
            )
            offset += len
            return el
          })}
      </svg>
      {center && <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">{center}</div>}
    </div>
  )
}

/** Linha com barra horizontal proporcional (ranking de estabelecimentos / categorias). */
export function BarRow({
  label,
  value,
  max,
  color,
  hatched,
  right,
  sub,
  onClick,
  index = 0,
}: {
  label: string
  value: number
  max: number
  color: string
  hatched?: boolean
  right: ReactNode
  sub?: ReactNode
  onClick?: () => void
  index?: number
}) {
  const width = max > 0 ? Math.max(2, (value / max) * 100) : 0
  return (
    <button
      type="button"
      onClick={onClick}
      className="-mx-2 flex w-[calc(100%+16px)] animate-rise flex-col gap-[6px] rounded-[16px] px-2 py-[10px] text-left transition hover:bg-white/[0.03] active:scale-[0.99]"
      style={{ animationDelay: `${Math.min(index, 10) * 35}ms` }}
    >
      <span className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate font-sat text-[15px] font-medium text-white">{label}</span>
        <span className="shrink-0 font-sat text-[14px] font-medium whitespace-nowrap text-white">{right}</span>
      </span>
      <span className="block h-[8px] w-full overflow-hidden rounded-[4px] bg-esk-track">
        <span
          className="block h-full origin-left animate-[grow-x_700ms_cubic-bezier(0.2,0.8,0.2,1)_both] rounded-[4px]"
          style={{
            width: `${width}%`,
            backgroundColor: color,
            backgroundImage: hatched ? 'repeating-linear-gradient(135deg, rgba(0,0,0,0.35) 0 3px, transparent 3px 7px)' : undefined,
            animationDelay: `${Math.min(index, 10) * 35}ms`,
          }}
        />
      </span>
      {sub && <span className="font-sat text-[12px] text-esk-subtle">{sub}</span>}
    </button>
  )
}

/** Barras por mês: entrada (verde) e saída (vermelho) lado a lado. */
export function MonthBars({
  rows,
  labelOf,
  onPick,
  selected,
}: {
  rows: { key: string; income: number; expense: number }[]
  labelOf: (key: string) => string
  onPick?: (key: string) => void
  selected?: string
}) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.income, r.expense]))
  const height = 160
  return (
    <div className="flex items-end gap-2 overflow-x-auto pb-1" role="img" aria-label="Entradas e saídas por mês">
      {rows.map((r) => (
        <button
          key={r.key}
          type="button"
          onClick={onPick ? () => onPick(r.key) : undefined}
          className={cx(
            'flex min-w-[44px] flex-1 flex-col items-center gap-2 rounded-[14px] px-1 pt-2 pb-1 transition hover:bg-white/[0.03]',
            selected === r.key && 'bg-white/[0.05]',
          )}
        >
          <span className="flex items-end gap-[4px]" style={{ height }}>
            <span
              className="w-[12px] origin-bottom animate-[grow-y_700ms_cubic-bezier(0.2,0.8,0.2,1)_both] rounded-t-[4px] bg-esk-positive"
              style={{ height: `${(r.income / max) * height}px` }}
              title={`Entrou ${r.income}`}
            />
            <span
              className="w-[12px] origin-bottom animate-[grow-y_700ms_cubic-bezier(0.2,0.8,0.2,1)_both] rounded-t-[4px] bg-esk-negative"
              style={{ height: `${(r.expense / max) * height}px` }}
              title={`Saiu ${r.expense}`}
            />
          </span>
          <span className={cx('font-sat text-[11px]', selected === r.key ? 'text-white' : 'text-esk-subtle')}>{labelOf(r.key)}</span>
        </button>
      ))}
    </div>
  )
}
