import { House, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useStore } from '../state/store'
import { useUI, type View } from '../state/ui'
import { TintIcon } from './icons'
import { LockBadge, PlusHint, PLUS_PITCH } from './PlusHint'
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
    pitch: PLUS_PITCH.invoice,
  },
  {
    view: 'assistant',
    label: 'Assistente',
    icon: <Sparkles size={26} strokeWidth={1.7} aria-hidden />,
    plus: true,
    primary: true,
    pitch: PLUS_PITCH.assistant,
  },
  { view: 'cards', label: 'Cartões', icon: <TintIcon name="3b177.svg" size={ICON} /> },
  { view: 'goals', label: 'Metas', icon: <TintIcon name="3e49f.svg" size={ICON} /> },
]


export default function TabBar() {
  const { state } = useStore()
  const { view, switchTab } = useUI()
  const plus = state.stage === 2
  const [hint, setHint] = useState<Tab | null>(null)
  const barRef = useRef<HTMLDivElement>(null)
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
          <PlusHint
            key={hint.view}
            className="mb-3"
            label={hint.label}
            pitch={hint.pitch ?? ''}
            view={hint.view}
            onClose={() => setHint(null)}
            within={barRef}
            arrowLeft={`${((hintIndex + 0.5) / TABS.length) * 100}%`}
          />
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
