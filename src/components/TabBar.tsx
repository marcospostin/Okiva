import { House, Lock, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useStore } from '../state/store'
import { useUI, type View } from '../state/ui'
import { TintIcon } from './icons'
import { cx } from './ui'

/**
 * Menu inferior (Figma: "home • fixa"). Só aparece em telas pequenas (< 768px);
 * no tablet/desktop a navegação continua pelos atalhos e cabeçalhos.
 *
 * Itens do Okiva Plus ficam visíveis, porém bloqueados no modo manual: o toque
 * mostra um aviso "Disponível no Okiva Plus" com o caminho para conhecer o plano
 * (padrão de "soft paywall": o recurso aparece com cadeado e explica o porquê).
 */
interface Tab {
  view: View
  label: string
  icon: ReactNode
  /** Recurso do Okiva Plus */
  plus?: boolean
  /** Botão central de destaque (Agente) */
  primary?: boolean
  /** Texto do aviso quando bloqueado */
  pitch?: string
}

/** Tab icon size (the Agente icon is 26px too, so every icon shares one center line) */
const ICON = 26

const TABS: Tab[] = [
  { view: 'home', label: 'Início', icon: <House size={ICON} strokeWidth={1.6} aria-hidden /> },
  {
    view: 'invoice',
    label: 'Fatura',
    icon: <TintIcon name="c2640.svg" size={ICON} />,
    plus: true,
    pitch: 'Envie o PDF ou a foto da fatura e a IA lança todas as compras para você.',
  },
  {
    view: 'assistant',
    label: 'Assistente',
    icon: <Sparkles size={26} strokeWidth={1.7} aria-hidden />,
    plus: true,
    primary: true,
    pitch: 'Pergunte sobre seus gastos e metas e receba respostas com os seus números.',
  },
  { view: 'cards', label: 'Cartões', icon: <TintIcon name="3b177.svg" size={ICON} /> },
  { view: 'goals', label: 'Metas', icon: <TintIcon name="3e49f.svg" size={ICON} /> },
]

const HINT_MS = 6000

export default function TabBar() {
  const { state } = useStore()
  const { view, switchTab, openSheet, sheet } = useUI()
  const plus = state.stage === 2
  const [hint, setHint] = useState<Tab | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const barRef = useRef<HTMLDivElement>(null)

  // The hint closes by itself, on Escape, on a tap outside, and when a sheet opens
  useEffect(() => {
    if (!hint) return
    timer.current = window.setTimeout(() => setHint(null), HINT_MS)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setHint(null)
    const onDown = (e: PointerEvent) => {
      if (!barRef.current?.contains(e.target as Node)) setHint(null)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.clearTimeout(timer.current)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [hint])
  useEffect(() => {
    if (sheet) setHint(null)
  }, [sheet])
  useEffect(() => {
    if (plus) setHint(null)
  }, [plus])

  const hintIndex = hint ? TABS.indexOf(hint) : -1

  return (
    <div className="md:hidden">
      {/* Fade so the content scrolling under the bar never looks cut */}
      <div aria-hidden className="pointer-events-none fixed inset-x-0 bottom-0 z-20 h-[var(--tabbar-space)] bg-gradient-to-t from-esk-bg-2 from-40% to-transparent" />
      <div ref={barRef} className="fixed inset-x-0 bottom-0 z-30 px-[26px] pb-[max(12px,env(safe-area-inset-bottom))]">
        {hint && (
          <div
            key={hint.view}
            role="dialog"
            aria-label={`${hint.label}: disponível no Okiva Plus`}
            className="relative mb-3 animate-toast-in rounded-[22px] bg-esk-surface p-4 shadow-[0_12px_40px_rgba(0,0,0,0.55)] ring-1 ring-esk-track"
          >
            <p className="flex items-center gap-[6px] font-mono text-[11px] font-medium tracking-[1.1px] text-esk-lilac uppercase">
              <Lock size={12} strokeWidth={2} aria-hidden />
              Disponível no Okiva Plus
            </p>
            <p className="pt-2 font-sat text-[15px] font-medium text-white">{hint.label} é um recurso do Plus</p>
            <p className="pt-1 font-sat text-[13px] leading-[1.4] text-esk-subtle">{hint.pitch}</p>
            <div className="flex items-center gap-2 pt-3">
              <button
                type="button"
                onClick={() => {
                  setHint(null)
                  openSheet({ type: 'plus', then: hint.view })
                }}
                className="h-[40px] rounded-[20px] bg-esk-lime px-4 font-sat text-[14px] font-medium text-esk-ink transition active:scale-95"
              >
                Conhecer o Plus
              </button>
              <button type="button" onClick={() => setHint(null)} className="h-[40px] rounded-[20px] px-4 font-sat text-[14px] font-medium text-esk-muted transition hover:text-white">
                Agora não
              </button>
            </div>
            {/* Arrow pointing at the tapped item */}
            <span
              aria-hidden
              className="absolute -bottom-[6px] size-3 -translate-x-1/2 rotate-45 bg-esk-surface ring-1 ring-esk-track [clip-path:polygon(100%_0,100%_100%,0_100%)]"
              style={{ left: `${((hintIndex + 0.5) / TABS.length) * 100}%` }}
            />
          </div>
        )}

        <nav aria-label="Menu principal" className="flex h-[76px] items-center gap-2 rounded-[16px] bg-esk-row p-2">
          {TABS.map((tab) => {
            const locked = !!tab.plus && !plus
            const active = view === tab.view
            const onClick = () => {
              if (locked) return setHint((h) => (h?.view === tab.view ? null : tab))
              setHint(null)
              switchTab(tab.view)
            }
            if (tab.primary) {
              return (
                <div key={tab.view} className="flex h-[60px] flex-1 items-center justify-center">
                  <button
                    type="button"
                    onClick={onClick}
                    aria-label={locked ? `${tab.label} (exclusivo do Plus)` : tab.label}
                    aria-disabled={locked || undefined}
                    aria-current={active ? 'page' : undefined}
                    className={cx(
                      'relative grid size-[56px] place-items-center rounded-full text-esk-ink transition duration-200 active:scale-90',
                      locked ? 'opacity-45 saturate-50' : 'hover:brightness-105',
                      active && !locked && 'ring-2 ring-white/70 ring-offset-2 ring-offset-esk-row',
                    )}
                    style={{ backgroundImage: 'var(--esk-gradient-agent)' }}
                  >
                    {tab.icon}
                    {locked && <LockBadge className="-top-0.5 -right-0.5" />}
                  </button>
                </div>
              )
            }
            return (
              <button
                key={tab.view}
                type="button"
                onClick={onClick}
                aria-label={locked ? `${tab.label} (exclusivo do Plus)` : tab.label}
                aria-disabled={locked || undefined}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'relative flex h-[60px] flex-1 items-center justify-center rounded-[12px] transition duration-200 active:scale-90',
                  active ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]',
                )}
              >
                {/* The icon itself shows the state: lime when active, soft white otherwise */}
                <span
                  className={cx(
                    'flex transition-colors duration-300',
                    locked ? 'text-white/30' : active ? 'text-esk-lime' : 'text-white/60',
                  )}
                >
                  {tab.icon}
                </span>
                {locked && <LockBadge className="top-[8px] right-[calc(50%-22px)]" />}
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

function LockBadge({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cx('absolute grid size-[16px] place-items-center rounded-full bg-esk-lilac text-esk-ink ring-2 ring-esk-row', className)}>
      <Lock size={9} strokeWidth={2.6} />
    </span>
  )
}
