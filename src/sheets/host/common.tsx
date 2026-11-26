/**
 * Peças compartilhadas pelos sheets de cartão, meta e teto.
 */
import { cx } from '../../components/ui'

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Shared look of read-only detail rows (Detalhe da compra, Fatura importada). */
export function DetailRows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="flex flex-col rounded-[24px] bg-esk-elevated px-5">
      {rows.map(([k, v], i) => (
        <div key={k} className={cx('flex justify-between gap-4 py-4 font-sat text-[15px]', i > 0 && 'border-t border-esk-border')}>
          <dt className="shrink-0 text-esk-muted">{k}</dt>
          <dd className="min-w-0 truncate text-right font-medium text-white">{v}</dd>
        </div>
      ))}
    </dl>
  )
}
