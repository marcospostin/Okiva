import { Lock } from 'lucide-react'
import { useEffect, useRef, type RefObject } from 'react'
import { useUI, type View } from '../state/ui'
import { cx } from './ui'

const HINT_MS = 6000

/**
 * Aviso "Disponível no Okiva Plus" mostrado ao tocar num recurso bloqueado
 * (menu inferior e atalhos da Home). Fecha sozinho, no Esc, ao tocar fora e ao abrir um sheet.
 */
export function PlusHint({
  label,
  pitch,
  view,
  onClose,
  arrowLeft,
  arrow = 'bottom',
  within,
  className,
}: {
  label: string
  pitch: string
  view: View
  onClose: () => void
  /** Posição da seta (ex. "37.5%"), apontando para o item tocado */
  arrowLeft: string
  arrow?: 'bottom' | 'top' | 'left'
  /** Toques dentro deste elemento não fecham o aviso (o próprio item tocado) */
  within?: RefObject<HTMLElement | null>
  className?: string
}) {
  const { openSheet, sheet } = useUI()
  const box = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    const timer = window.setTimeout(() => close.current(), HINT_MS)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current()
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (box.current?.contains(t) || within?.current?.contains(t)) return
      close.current()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [label, within])

  useEffect(() => {
    if (sheet) close.current()
  }, [sheet])

  return (
    <div
      ref={box}
      role="dialog"
      aria-label={`${label}: disponível no Okiva Plus`}
      className={cx('relative animate-toast-in rounded-[22px] bg-esk-surface p-4 shadow-[0_12px_40px_rgba(0,0,0,0.55)] ring-1 ring-esk-track', className)}
    >
      <p className="flex items-center gap-[6px] font-mono text-[11px] font-medium tracking-[1.1px] text-esk-lilac uppercase">
        <Lock size={12} strokeWidth={2} aria-hidden />
        Disponível no Okiva Plus
      </p>
      <p className="pt-2 font-sat text-[15px] font-medium text-white">{label} é um recurso do Plus</p>
      <p className="pt-1 font-sat text-[13px] leading-[1.4] text-esk-subtle">{pitch}</p>
      <div className="flex items-center gap-2 pt-3">
        <button
          type="button"
          onClick={() => {
            onClose()
            openSheet({ type: 'plus', then: view })
          }}
          className="h-[40px] rounded-[20px] bg-esk-lime px-4 font-sat text-[14px] font-medium text-esk-ink transition active:scale-95"
        >
          Conhecer o Plus
        </button>
        <button type="button" onClick={onClose} className="h-[40px] rounded-[20px] px-4 font-sat text-[14px] font-medium text-esk-muted transition hover:text-white">
          Agora não
        </button>
      </div>
      <span
        aria-hidden
        className={cx(
          'absolute size-3 bg-esk-surface ring-1 ring-esk-track',
          arrow === 'left'
            ? 'top-1/2 -left-[6px] -translate-y-1/2 rotate-45 [clip-path:polygon(0_0,0_100%,100%_100%)]'
            : arrow === 'bottom'
              ? '-bottom-[6px] -translate-x-1/2 rotate-45 [clip-path:polygon(100%_0,100%_100%,0_100%)]'
              : '-top-[6px] -translate-x-1/2 rotate-45 [clip-path:polygon(0_0,100%_0,0_100%)]',
        )}
        style={arrow === 'left' ? undefined : { left: arrowLeft }}
      />
    </div>
  )
}

export function LockBadge({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cx('absolute grid size-[16px] place-items-center rounded-full bg-esk-lilac text-esk-ink ring-2 ring-esk-row', className)}>
      <Lock size={9} strokeWidth={2.6} />
    </span>
  )
}

export const PLUS_PITCH = {
  invoice: 'Envie o PDF ou a foto da fatura e a IA lança todas as compras para você.',
  assistant: 'Pergunte sobre seus gastos e metas e receba respostas com os seus números.',
}
