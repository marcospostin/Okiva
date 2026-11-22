import { AlertCircle, ArrowLeft, Check, Info, X } from 'lucide-react'
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { DEMO_USER } from '../data/mock'
import { useUI } from '../state/ui'
import type { User } from '../types'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Starts at 0 and moves to `value` after the first paint, so bars and rings fill on screen enter. */
function useMountedValue(value: number) {
  const [shown, setShown] = useState(reducedMotion() ? value : 0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(value))
    return () => cancelAnimationFrame(id)
  }, [value])
  return shown
}

/** Counts from the previous value to the new one (easeOutCubic). */
export function useCountUp(value: number, duration = 650) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    const start = from.current
    if (start === value || reducedMotion()) {
      from.current = value
      setShown(value)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      const v = start + (value - start) * eased
      from.current = v
      setShown(p === 1 ? value : Math.round(v * 100) / 100)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return shown
}

/** Money that rolls to its new value; `format` keeps the screen's own formatting (and privacy mask). */
export function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  return <>{format(useCountUp(value))}</>
}

export function Spinner({ className }: { className?: string }) {
  return <span aria-hidden className={cx('inline-block size-[16px] animate-spin rounded-full border-2 border-current border-r-transparent', className)} />
}

/* ------------------------------------------------------------------ avatar */

/** Lucas (demo account and the visitor demo) keeps the photo from the design; new accounts get initials. */
export function Avatar({ user, size = 44 }: { user: User | null; size?: number }) {
  if (user?.avatar) {
    return <img alt="" src={user.avatar} width={size} height={size} className="block shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  }
  if (!user || user.email === DEMO_USER.email || user.demo) {
    return <img alt="" src="/assets/7acab.png" width={size} height={size} className="block rounded-full" style={{ width: size, height: size }} />
  }
  const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('')
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-esk-lilac font-sat font-bold text-esk-ink"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      aria-hidden
    >
      {initials}
    </span>
  )
}

/* ------------------------------------------------------------------ layout */

export function Page({ children, className, wide }: { children: ReactNode; className?: string; wide?: boolean }) {
  return (
    <div
      className={cx(
        'mx-auto w-full max-w-[1280px] pb-16 md:px-10 lg:px-14 3xl:max-w-[1680px] 3xl:px-16',
        wide ? 'px-[32px]' : 'px-[26px]',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function RoundButton({
  label,
  children,
  className,
  ...rest
}: { label: string; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'grid size-[44px] shrink-0 place-items-center rounded-[22px] bg-esk-control text-white transition hover:bg-[#232327] active:scale-95',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

/** Screen title row: back + title + one action. Satoshi Medium 29. */
export function ScreenHeader({ title, action }: { title: string; action?: ReactNode }) {
  const { back } = useUI()
  return (
    <header className="flex items-center justify-between gap-3 pt-[20px] md:pt-10">
      <div className="flex min-w-0 items-center gap-3">
        <RoundButton label="Voltar" onClick={back}>
          <ArrowLeft size={19} strokeWidth={1.6} />
        </RoundButton>
        <h1 className="truncate font-sat text-[29px] font-medium tracking-[-1.015px] text-white md:text-[36px] md:tracking-[-1.3px] 3xl:text-[42px]">
          {title}
        </h1>
      </div>
      {action}
    </header>
  )
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="font-sat text-[21px] font-medium tracking-[-0.42px] text-white">{title}</h2>
      {action}
    </div>
  )
}

export function LinkButton({ children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className="font-sat text-[14px] font-medium text-esk-lime-soft hover:underline" {...rest}>
      {children}
    </button>
  )
}

export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx('font-mono text-[11px] font-medium tracking-[1.1px] uppercase', className)}>{children}</p>
}

/* ------------------------------------------------------------- list panel */

export function ListPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        '-mx-[14px] flex flex-col rounded-t-[32px] rounded-b-[40px] bg-esk-surface px-[14px] py-[10px] md:mx-0',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function ListRow({
  icon,
  title,
  subtitle,
  value,
  onClick,
  trailing,
  note,
  index,
}: {
  icon: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  /** Extra line under the subtitle; wraps instead of truncating */
  note?: ReactNode
  value?: ReactNode
  onClick?: () => void
  trailing?: ReactNode
  /** Position in the list: rows rise in sequence on screen enter */
  index?: number
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      style={index !== undefined ? { animationDelay: `${Math.min(index, 8) * 45}ms` } : undefined}
      className={cx(
        'grid min-h-[76px] w-full grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 rounded-[24px] py-2 text-left',
        index !== undefined && 'animate-rise',
        onClick && 'transition duration-200 hover:bg-white/[0.03] active:scale-[0.99] active:bg-white/[0.05]',
      )}
    >
      <span className="grid size-[48px] place-items-center rounded-[24px] bg-esk-row">{icon}</span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-sat text-[16px] font-medium text-white">{title}</span>
        {subtitle && <span className="truncate pt-[2px] font-sat text-[13px] text-esk-subtle">{subtitle}</span>}
        {note && <span className="pt-1 font-sat text-[12px] leading-[1.35] text-esk-muted">{note}</span>}
      </span>
      <span className="flex items-center gap-2 pr-1">
        {value !== undefined && <span className="font-sat text-[16px] font-medium whitespace-nowrap text-white">{value}</span>}
        {trailing}
      </span>
    </Tag>
  )
}

/* ------------------------------------------------------------ feature card */

export function FeatureCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx('flex min-h-[238px] flex-col justify-between rounded-[34px] p-6 text-esk-ink md:p-8', className)}
      style={{ backgroundImage: 'var(--esk-gradient-feature)' }}
    >
      {children}
    </div>
  )
}

/** Lime square + dark label (Guardar R$ 500 / Enviar outro PDF). */
export function ActionRow({ icon, label, onClick, disabled }: { icon: ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group grid w-full grid-cols-[84px_minmax(0,1fr)] gap-[10px] text-left disabled:opacity-50"
    >
      <span className="grid size-[84px] place-items-center rounded-[26px] bg-esk-lime-soft transition group-hover:brightness-95 group-active:scale-95">
        {icon}
      </span>
      <span className="flex items-center rounded-[26px] bg-esk-elevated px-6 font-sat text-[17px] font-medium text-white transition group-hover:bg-[#1f1f23]">
        {label}
      </span>
    </button>
  )
}

export function ProgressBar({ value, className, tone = 'lime' }: { value: number; className?: string; tone?: 'lime' | 'ink' }) {
  const shown = useMountedValue(value)
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cx('h-[8px] w-full overflow-hidden rounded-[4px]', tone === 'lime' ? 'bg-esk-border' : 'bg-[rgba(10,10,10,0.14)]', className)}
    >
      <div
        className={cx('h-full rounded-[4px] transition-[width] duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)]', tone === 'lime' ? 'bg-esk-lime-soft' : 'bg-esk-ink')}
        style={{ width: `${Math.min(100, Math.max(0, shown))}%` }}
      />
    </div>
  )
}

/** Goal ring, same geometry as the design (99 box, stroke 11). */
export function Ring({ value, size = 104 }: { value: number; size?: number }) {
  const r = 44
  const c = 2 * Math.PI * r
  const v = Math.min(100, Math.max(0, useMountedValue(value)))
  const label = useCountUp(Math.round(value), 900)
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 99 99" className="absolute inset-[7.69%] -rotate-90 overflow-visible" aria-hidden>
        <circle cx="49.5" cy="49.5" r={r} fill="none" stroke="#0A0A0A" strokeOpacity="0.14" strokeWidth="11" />
        <circle
          cx="49.5"
          cy="49.5"
          r={r}
          fill="none"
          stroke="#0A0A0A"
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v / 100)}
          className="transition-[stroke-dashoffset] duration-1000 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-sat text-[22px] font-bold tracking-[-0.66px] text-esk-ink tabular-nums">
        {Math.round(label)}%
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ sheet */

export function Sheet({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const { sheetClosing } = useUI()
  const panel = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    if (!panel.current?.contains(document.activeElement)) panel.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current()
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      prev?.focus?.()
    }
  }, [])
  return (
    <div className={cx('fixed inset-0 z-40 flex items-end justify-center md:items-center md:p-6', sheetClosing && 'pointer-events-none')} role="presentation">
      <div
        className={cx('absolute inset-0 bg-black/70 backdrop-blur-[2px]', sheetClosing ? 'animate-fade-out' : 'animate-fade-in')}
        onClick={onClose}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cx(
          'relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[32px] bg-esk-surface px-6 pt-3 pb-[max(24px,env(safe-area-inset-bottom))] outline-none md:max-w-[480px] md:rounded-[32px] md:px-8 md:pt-8 md:pb-8',
          sheetClosing ? 'animate-sheet-down md:animate-pop-out' : 'animate-sheet-up md:animate-pop-in',
        )}
      >
        <div className="mx-auto mb-4 h-[5px] w-[44px] rounded-[3px] bg-esk-track md:hidden" />
        <div className="mb-6 flex items-center justify-between gap-3">
          <h2 className="font-sat text-[23px] font-medium tracking-[-0.6px] text-white">{title}</h2>
          <RoundButton label="Fechar" onClick={onClose} className="size-[38px] rounded-[19px]">
            <X size={17} strokeWidth={1.7} />
          </RoundButton>
        </div>
        <div className="animate-sheet-content">{children}</div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ toast */

const TOAST_ICON = {
  success: { bg: 'bg-esk-lime', icon: <Check size={15} strokeWidth={2.4} className="animate-check-draw" /> },
  error: { bg: 'bg-esk-lilac-strong', icon: <AlertCircle size={15} strokeWidth={2.2} /> },
  info: { bg: 'bg-esk-lilac', icon: <Info size={15} strokeWidth={2.2} /> },
}

export function ToastView() {
  const { toast } = useUI()
  const look = toast ? TOAST_ICON[toast.tone] : null
  return (
    <div
      aria-live={toast?.tone === 'error' ? 'assertive' : 'polite'}
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar-space,0px)+24px)] z-50 flex justify-center px-6"
    >
      {toast && look && (
        <div
          key={toast.id}
          role={toast.tone === 'error' ? 'alert' : 'status'}
          data-tone={toast.tone}
          className={cx(
            'toast flex max-w-[480px] items-center gap-3 rounded-[22px] bg-esk-offwhite py-3 pr-5 pl-3 font-sat text-[15px] font-medium text-esk-ink shadow-[0_12px_40px_rgba(0,0,0,0.5)]',
            toast.leaving ? 'animate-toast-out' : 'animate-toast-in',
          )}
        >
          <span className={cx('grid size-[28px] shrink-0 place-items-center rounded-full', look.bg)}>{look.icon}</span>
          {toast.message}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ forms */

/**
 * Label + control + error. With an error the control gets a lilac ring and a short
 * shake; `attempt` (submit counter) replays the shake on every failed submit.
 */
export function Field({
  label,
  error,
  children,
  htmlFor,
  attempt = 0,
}: {
  label: string
  error?: string
  children: ReactNode
  htmlFor?: string
  attempt?: number
}) {
  const errorId = htmlFor ? `${htmlFor}-error` : undefined
  const box = useRef<HTMLDivElement>(null)
  const hasError = !!error
  // Shake without remounting the control, so focus and typing are never interrupted
  useEffect(() => {
    if (!hasError || reducedMotion()) return
    box.current?.animate?.(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }],
      { duration: 320, easing: 'ease-out' },
    )
  }, [hasError, attempt])
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className={cx('font-sat text-[13px] font-medium transition-colors', error ? 'text-esk-lilac' : 'text-esk-muted')}>
        {label}
      </label>
      <div
        ref={box}
        aria-describedby={error ? errorId : undefined}
        className={cx('flex flex-col gap-2', error && '[&>*:first-child]:ring-esk-lilac [&_input]:caret-esk-lilac')}
      >
        {children}
      </div>
      {error && (
        <p id={errorId} role="alert" className="animate-rise font-sat text-[13px] text-esk-lilac">
          {error}
        </p>
      )}
    </div>
  )
}

export const inputClass =
  'h-[52px] w-full rounded-[18px] bg-esk-elevated px-4 font-sat text-[16px] text-white outline-none ring-1 ring-esk-track placeholder:text-esk-subtle focus:ring-esk-lime'

/** Money input that types cents from the right: 1 → 0,01 → 0,12 → 1,23 */
export function MoneyInput({
  id,
  value,
  onChange,
  large,
  autoFocus,
}: {
  id?: string
  value: number
  onChange: (v: number) => void
  large?: boolean
  autoFocus?: boolean
}) {
  const cents = Math.round(value * 100)
  const display = (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return (
    <div
      className={cx(
        'flex items-baseline gap-2 rounded-[22px] bg-esk-elevated px-5 ring-1 ring-esk-track focus-within:ring-esk-lime',
        large ? 'py-4' : 'h-[52px] items-center',
      )}
    >
      <span className={cx('font-sat font-medium text-esk-muted', large ? 'text-[22px]' : 'text-[16px]')}>R$</span>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        value={display}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 11)
          onChange(Number(digits || '0') / 100)
        }}
        className={cx(
          'w-full min-w-0 bg-transparent font-sat font-medium text-white outline-none',
          large ? 'text-[42px] tracking-[-1.7px]' : 'text-[16px]',
        )}
      />
    </div>
  )
}

export function Chip({
  active,
  children,
  onClick,
  icon,
  dashed,
}: {
  active: boolean
  children: ReactNode
  onClick: () => void
  /** Leading icon (16px), e.g. "+" on the create chip */
  icon?: ReactNode
  /** Dashed outline for "create your own" actions next to suggestions */
  dashed?: boolean
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        'inline-flex h-[40px] items-center gap-[6px] rounded-[20px] px-4 font-sat text-[14px] font-medium whitespace-nowrap transition duration-200 active:scale-95',
        active
          ? 'bg-esk-lime text-esk-ink shadow-[0_4px_16px_rgba(229,255,181,0.18)]'
          : dashed
            ? 'border border-dashed border-esk-subtle text-esk-lime hover:border-esk-lime'
            : 'bg-esk-elevated text-white ring-1 ring-esk-track hover:bg-[#1f1f23]',
      )}
    >
      {icon}
      {children}
    </button>
  )
}

export function PrimaryButton({
  children,
  className,
  tone = 'lime',
  loading,
  loadingText,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'lime' | 'dark' | 'danger'; loading?: boolean; loadingText?: string }) {
  return (
    <button
      type="button"
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cx(
        'relative flex h-[56px] w-full items-center justify-center gap-2 rounded-[22px] font-sat text-[16px] font-medium transition duration-200 active:scale-[0.98] disabled:cursor-not-allowed',
        loading ? 'cursor-progress' : 'disabled:opacity-40',
        tone === 'lime' && 'bg-esk-lime text-esk-ink hover:brightness-95',
        tone === 'dark' && 'bg-esk-elevated text-white ring-1 ring-esk-track hover:bg-[#1f1f23]',
        tone === 'danger' && 'bg-esk-elevated text-esk-lilac ring-1 ring-esk-track hover:bg-[#1f1f23]',
        className,
      )}
      {...rest}
    >
      {loading && <Spinner />}
      {/* inline-flex keeps a leading icon on the same line as the label */}
      <span className={cx('inline-flex items-center gap-2', loading && 'animate-fade-in')}>{loading ? (loadingText ?? 'Salvando…') : children}</span>
    </button>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx('group relative h-[30px] w-[52px] shrink-0 rounded-full transition-colors duration-300', checked ? 'bg-esk-lime' : 'bg-esk-track')}
    >
      <span
        className={cx(
          'absolute top-[3px] left-[3px] h-[24px] w-[24px] rounded-full transition-all duration-300 ease-[cubic-bezier(0.3,1.4,0.5,1)] group-active:w-[28px]',
          checked ? 'translate-x-[22px] bg-esk-ink group-active:translate-x-[18px]' : 'translate-x-0 bg-white',
        )}
      />
    </button>
  )
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex animate-rise flex-col items-start gap-3 rounded-[26px] border border-dashed border-esk-track p-6">
      <p className="font-sat text-[17px] font-medium text-white">{title}</p>
      <p className="font-sat text-[14px] text-esk-muted">{text}</p>
      {action}
    </div>
  )
}

/** Placeholder while a lazily loaded screen downloads. */
export function ScreenSkeleton() {
  const bar = 'skeleton-shimmer animate-shimmer rounded-[26px]'
  return (
    <div className="min-h-[calc(100dvh-var(--tabbar-space,0px))] bg-esk-bg-2" aria-busy="true" aria-label="Carregando">
      <Page>
        <div className="flex items-center gap-3 pt-[20px] md:pt-10">
          <div className="size-[44px] animate-pulse rounded-full bg-esk-surface" />
          <div className="h-[30px] w-[180px] animate-pulse rounded-[12px] bg-esk-surface" />
        </div>
        <div className="grid gap-6 pt-6 md:grid-cols-2 md:pt-10">
          <div className={`h-[238px] ${bar}`} />
          <div className="flex flex-col gap-3">
            <div className={`h-[76px] ${bar}`} />
            <div className={`h-[76px] ${bar}`} />
            <div className={`h-[76px] ${bar}`} />
          </div>
        </div>
      </Page>
    </div>
  )
}
