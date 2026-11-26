import { House, Sparkles } from 'lucide-react'
import { Isotype } from './Isotype'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useStore } from '../state/store'
import { useUI, type View } from '../state/ui'
import { TintIcon } from './icons'
import { LockBadge, PlusHint, PLUS_PITCH } from './PlusHint'
import { cx } from './ui'

/**
 * Menu inferior (Figma: "home • fixa"). Só aparece em telas pequenas (< 800px);
 * no tablet/computador vira a barra lateral em círculos (SideRail, abaixo).
 *
 * Itens do Okiva Plus ficam visíveis, porém bloqueados no modo manual: o toque
 * mostra um aviso "Disponível no Okiva Plus" com o caminho para conhecer o plano
 * (padrão de "soft paywall": o recurso aparece com cadeado e explica o porquê).
 */
interface Tab {
  view: View
  label: string
  icon: (size: number) => ReactNode
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
  { view: 'home', label: 'Início', icon: (n) => <House size={n} strokeWidth={1.6} aria-hidden /> },
  {
    view: 'invoice',
    label: 'Fatura',
    icon: (n) => <TintIcon name="c2640.svg" size={n} />,
    plus: true,
    pitch: PLUS_PITCH.invoice,
  },
  {
    view: 'assistant',
    label: 'Assistente',
    icon: (n) => <Sparkles size={n} strokeWidth={1.7} aria-hidden />,
    plus: true,
    primary: true,
    pitch: PLUS_PITCH.assistant,
  },
  { view: 'cards', label: 'Cartões', icon: (n) => <TintIcon name="3b177.svg" size={n} /> },
  { view: 'goals', label: 'Metas', icon: (n) => <TintIcon name="3e49f.svg" size={n} /> },
]

/** Barra lateral (tablet/computador): o Assistente vai para o topo, o resto segue a ordem do celular. */
const RAIL_TABS: Tab[] = [...TABS.filter((t) => t.primary), ...TABS.filter((t) => !t.primary)]


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
                    {tab.icon(ICON)}
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
                  {tab.icon(ICON)}
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

/** Tamanho do ícone dentro do círculo da barra lateral */
const RAIL_ICON = 22

/**
 * Barra lateral esquerda (a partir de 800px): isotipo no topo e os mesmos itens do menu
 * inferior em círculos, com o Assistente primeiro. O nome aparece ao passar o mouse.
 */
export function SideRail() {
  const { state } = useStore()
  const { view, switchTab } = useUI()
  const plus = state.stage === 2
  const [hint, setHint] = useState<Tab | null>(null)
  const railRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (plus) setHint(null)
  }, [plus])

  return (
    <aside
      ref={railRef}
      className={cx(
        'sticky top-0 z-30 hidden h-dvh w-[104px] shrink-0 flex-col items-center md:flex 3xl:w-[120px]',
        // mesmo fundo da tela aberta (a Home é um tom mais escura), sem emenda entre barra e conteúdo
        view === 'home' ? 'bg-esk-bg' : 'bg-esk-bg-2',
      )}
    >
      <span className="mt-10 flex h-[48px] items-center text-[32px] text-esk-lime 3xl:text-[38px]" role="img" aria-label="Okiva">
        <Isotype className="h-[0.9em]" />
      </span>

      <nav aria-label="Menu principal" className="mt-6 flex flex-col items-center gap-[var(--rail-gap)]">
        {RAIL_TABS.map((tab) => {
          const locked = !!tab.plus && !plus
          const active = view === tab.view
          const onClick = () => {
            if (locked) return setHint((h) => (h?.view === tab.view ? null : tab))
            setHint(null)
            switchTab(tab.view)
          }
          return (
            <div key={tab.view} className="group relative">
              <button
                type="button"
                onClick={onClick}
                aria-label={locked ? `${tab.label} (exclusivo do Plus)` : tab.label}
                aria-disabled={locked || undefined}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'relative grid size-[56px] place-items-center rounded-full transition duration-200 active:scale-90 3xl:size-[64px]',
                  tab.primary
                    ? cx('text-esk-ink', locked ? 'opacity-45 saturate-50' : 'hover:brightness-105', active && !locked && 'ring-2 ring-white/70 ring-offset-2 ring-offset-esk-bg')
                    : locked
                      ? 'bg-esk-row text-white/30'
                      : active
                        ? 'bg-esk-lime text-esk-ink'
                        : 'bg-esk-row text-white/70 hover:bg-esk-track hover:text-white',
                )}
                style={tab.primary ? { backgroundImage: 'var(--esk-gradient-agent)' } : undefined}
              >
                {tab.icon(RAIL_ICON)}
                {locked && <LockBadge className="-top-0.5 -right-0.5" />}
              </button>
              {/* Nome do item ao passar o mouse ou focar pelo teclado */}
              {hint?.view !== tab.view && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-full ml-3 -translate-x-1 -translate-y-1/2 rounded-full bg-esk-surface px-3 py-[6px] font-sat text-[13px] font-medium whitespace-nowrap text-white opacity-0 ring-1 ring-esk-track transition duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-has-[:focus-visible]:translate-x-0 group-has-[:focus-visible]:opacity-100"
                >
                  {tab.label}
                </span>
              )}
              {hint?.view === tab.view && (
                <PlusHint
                  key={tab.view}
                  className="absolute top-1/2 left-full z-40 ml-4 w-[300px] -translate-y-1/2"
                  label={tab.label}
                  pitch={tab.pitch ?? ''}
                  view={tab.view}
                  onClose={() => setHint(null)}
                  within={railRef}
                  arrow="left"
                  arrowLeft="0"
                />
              )}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
