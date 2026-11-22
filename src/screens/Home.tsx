import { ChevronDown, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { categoryMeta } from '../data/categories'
import { Asset, CategoryRowIcon, CategoryTileIcon } from '../components/icons'
import { Avatar, CountUp, cx, Page } from '../components/ui'
import { brl, brlShort, capitalize, privateExpense, privateMoney, monthName, pct, relativeDay } from '../lib/format'
import { TODAY } from '../data/mock'
import {
  availableMonths,
  balanceOf,
  currentMonth,
  methodLabel,
  monthSummary,
  previousMonth,
  useStore,
} from '../state/store'
import { useUI } from '../state/ui'

const monthLabel = (key: string) => capitalize(monthName(Number(key.slice(5, 7)) - 1))

/** Até 3 cards cabem lado a lado em qualquer largura; acima disso vira carrossel. */
const STATIC_TILES = 3

/**
 * Cards de categoria do mês.
 * - Até 3: grade fixa de 3 colunas (igual ao design original).
 * - Mais de 3: carrossel com rolagem e encaixe (scroll-snap). Mostra ~2,3 cards no
 *   celular e ~3,3 no tablet/desktop: o card cortado na borda indica que há mais.
 *   No celular o carrossel vai até a borda da tela; no desktop aparecem setas.
 */
function CategoryTiles({ count, children }: { count: number; children: ReactNode }) {
  const rail = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ prev: false, next: true })
  const carousel = count > STATIC_TILES

  const update = useCallback(() => {
    const el = rail.current
    if (!el) return
    setEdges({ prev: el.scrollLeft > 4, next: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 })
  }, [])

  useEffect(() => {
    if (!carousel) return
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [carousel, count, update])

  if (!carousel) return <div className="grid grid-cols-3 gap-3">{children}</div>

  const go = (dir: 1 | -1) => {
    const el = rail.current
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.75, behavior: 'smooth' })
  }

  return (
    <div className="relative min-w-0" role="region" aria-roledescription="carrossel" aria-label="Categorias do mês">
      <div
        ref={rail}
        onScroll={update}
        className={cx(
          '-mx-[32px] flex snap-x snap-mandatory scroll-px-[32px] gap-3 overflow-x-auto px-[32px] pb-1 [scrollbar-width:none] md:mx-0 md:scroll-px-0 md:px-0 [&::-webkit-scrollbar]:hidden',
          // Each card: ~2.3 visible on phones, ~3.3 from tablets up
          '[&>*]:shrink-0 [&>*]:basis-[calc((100%-12px)/2.3)] [&>*]:snap-start md:[&>*]:basis-[calc((100%-24px)/3.3)]',
        )}
      >
        {children}
      </div>
      {(['prev', 'next'] as const).map((side) => (
        <button
          key={side}
          type="button"
          aria-label={side === 'prev' ? 'Categorias anteriores' : 'Mais categorias'}
          onClick={() => go(side === 'prev' ? -1 : 1)}
          tabIndex={edges[side] ? 0 : -1}
          className={cx(
            'absolute top-1/2 hidden size-[36px] -translate-y-1/2 place-items-center rounded-full bg-esk-ink/85 text-white shadow-[0_6px_20px_rgba(0,0,0,0.45)] ring-1 ring-white/10 backdrop-blur transition duration-200 hover:bg-esk-ink md:grid',
            side === 'prev' ? '-left-[14px]' : '-right-[14px]',
            edges[side] ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
        >
          {side === 'prev' ? <ChevronLeft size={18} strokeWidth={2} /> : <ChevronRight size={18} strokeWidth={2} />}
        </button>
      ))}
    </div>
  )
}

export default function Home() {
  const { state, dispatch } = useStore()
  const { navigate, openSheet } = useUI()
  const [month, setMonth] = useState(currentMonth())
  const [showAll, setShowAll] = useState(false)
  const summary = useMemo(() => monthSummary(state, month), [state, month])
  const months = useMemo(() => availableMonths(state), [state])
  const balance = balanceOf(state)
  const plus = state.stage === 2
  const hidden = state.hideBalance
  const isCurrent = month === currentMonth()
  const available = state.budget.total - summary.total
  const variation = summary.previousTotal ? pct(summary.total - summary.previousTotal, summary.previousTotal) : null
  const txs = showAll ? summary.transactions : summary.transactions.slice(0, 6)

  // Cards do mês: todas as categorias com teto em Metas (mesmo sem gasto, ex.: Lazer)
  // + categorias com gasto e sem teto, para cada trecho da barra ter o seu card.
  const tiles = useMemo(() => {
    const spent = new Map(summary.byCategory.map((c) => [c.category, c.amount]))
    const capped = (Object.entries(state.budget.caps) as [string, number][]).map(([category, cap]) => ({
      category,
      amount: spent.get(category) ?? 0,
      cap: cap as number | undefined,
    }))
    const uncapped = summary.byCategory
      .filter((c) => state.budget.caps[c.category] === undefined)
      .map((c) => ({ category: c.category, amount: c.amount, cap: undefined as number | undefined }))
    return [...capped, ...uncapped].sort((a, b) => b.amount - a.amount)
  }, [summary.byCategory, state.budget.caps])

  const shortcuts = [
    { key: 'add', label: 'Adicionar', icon: <Asset name="0a681.svg" size={23} />, onClick: () => openSheet({ type: 'add' }), primary: true },
    ...(plus ? [{ key: 'invoice', label: 'Fatura', icon: <Asset name="c2640.svg" size={23} />, onClick: () => navigate('invoice') }] : []),
    { key: 'cards', label: 'Cartões', icon: <Asset name="3b177.svg" size={23} />, onClick: () => navigate('cards') },
    { key: 'goals', label: 'Metas', icon: <Asset name="3e49f.svg" size={23} />, onClick: () => navigate('goals') },
  ]

  return (
    <div className="flex min-h-[calc(100dvh-var(--tabbar-space,0px))] flex-col bg-esk-bg">
      <Page wide className="flex-1">
        {/* Header: avatar opens the account sheet. No bell, no search. */}
        <header className="flex h-[48px] items-center gap-3 mt-8">
          <button
            type="button"
            onClick={() => openSheet({ type: 'account' })}
            className="shrink-0 rounded-full transition active:scale-95"
            aria-label="Abrir conta"
          >
            <Avatar user={state.user} />
          </button>
          <div className="flex min-w-0 flex-1 flex-col gap-[2px] leading-[1.35] whitespace-nowrap">
            <p className="font-inter text-[11px] text-esk-muted">Bem-vindo de volta</p>
            <p className="font-inter-m text-[18px] font-medium text-white">Olá, {state.user?.name.split(' ')[0] ?? 'Lucas'}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {plus && <span className="hidden rounded-full bg-esk-lilac px-2 py-1 font-mono text-[9px] font-medium tracking-[0.8px] text-esk-ink sm:inline">PLUS</span>}
            <p className="font-sat text-[22px] leading-none font-bold tracking-[-0.6px] text-esk-lime md:text-[26px]">Okiva</p>
          </div>
        </header>

        <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-8 lg:gap-10 3xl:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] 3xl:gap-12">
          {/* Left: balance + shortcuts */}
          <div className="flex flex-col gap-6 md:sticky md:top-8 md:self-start">
            <section
              aria-label="Saldo disponível"
              className="relative flex min-h-[184px] flex-col gap-3 overflow-hidden rounded-[32px] px-6 py-[22px] lg:min-h-[240px] lg:rounded-[34px] lg:px-8 lg:py-7 3xl:min-h-[280px]"
              style={{ backgroundImage: 'var(--esk-gradient-hero)' }}
            >
              <div className="flex items-center justify-between">
                <p className="font-inter-m text-[11px] font-medium tracking-[1.1px] text-esk-ink">SEU SALDO</p>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'toggleHide' })}
                  aria-label={state.hideBalance ? 'Mostrar saldo' : 'Ocultar saldo'}
                  aria-pressed={state.hideBalance}
                  className="-m-2 rounded-full p-2 transition hover:bg-black/5"
                >
                  <span className={cx('block transition', state.hideBalance && 'opacity-40')}>
                    <Asset name="1548a.svg" size={21} />
                  </span>
                </button>
              </div>
              <p
                className="font-inter-m text-[43px] leading-[1.35] font-medium tracking-[-1.72px] whitespace-nowrap text-esk-ink lg:text-[56px] lg:tracking-[-2.4px] 3xl:text-[66px] 3xl:tracking-[-3px]"
                aria-live="polite"
              >
                <CountUp value={balance} format={(n) => privateMoney(brl(n), hidden)} />
              </p>
              <div className="mt-auto flex items-center justify-between gap-3">
                <div className="flex items-center gap-[6px]">
                  <Asset name="009b2.svg" size={15} />
                  <p className="font-inter text-[12px] text-esk-ink">Seu dinheiro, no seu ritmo.</p>
                </div>
                {/* Always visible: in manual mode it explains Okiva Plus and unlocks the assistant */}
                <button
                  type="button"
                  onClick={() => (plus ? navigate('assistant') : openSheet({ type: 'plus', then: 'assistant' }))}
                  className="group flex items-center gap-[6px] rounded-full bg-esk-ink py-[7px] pr-3 pl-[10px] font-inter-m text-[12px] font-medium text-esk-lime transition hover:bg-black active:scale-95"
                >
                  <Sparkles size={13} strokeWidth={1.8} className="transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
                  Assistente
                  {!plus && <span className="rounded-full bg-esk-lilac px-[6px] py-px font-mono text-[8px] tracking-[0.6px] text-esk-ink">PLUS</span>}
                </button>
              </div>
            </section>

            <nav aria-label="Atalhos" className={cx('grid', plus ? 'grid-cols-4 gap-2 sm:gap-3' : 'grid-cols-3 gap-3')}>
              {shortcuts.map((s, i) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={s.onClick}
                  style={{ animationDelay: `${i * 50}ms` }}
                  className={cx(
                    'flex h-[84px] min-w-0 animate-rise flex-col items-start gap-2 rounded-[24px] pt-[14px] pb-3 text-left transition duration-200 hover:-translate-y-0.5 active:scale-[0.96] lg:h-[96px]',
                    plus ? 'pr-2 pl-3 sm:pr-3 sm:pl-4' : 'pr-3 pl-4',
                    s.primary ? 'bg-esk-lime hover:brightness-95' : 'bg-esk-tile hover:bg-[#242427]',
                  )}
                >
                  {s.icon}
                  <span
                    className={cx(
                      'max-w-full truncate font-inter-m leading-[1.35] font-medium lg:text-[13px]',
                      plus ? 'text-[11px] tracking-[-0.2px] sm:text-[12px] sm:tracking-normal' : 'text-[12px]',
                      s.primary ? 'text-esk-ink' : 'text-white',
                    )}
                  >
                    {s.label}
                  </span>
                </button>
              ))}
            </nav>

          </div>

          {/* Right: this month + transactions */}
          {/* min-w-0: grid items grow to fit their content by default; the carousel must scroll instead */}
          <div className="grid min-w-0 gap-8 md:gap-10 3xl:grid-cols-2 3xl:gap-12">
            <section aria-label="Gastos do mês" className="flex min-w-0 flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="font-inter-m text-[11px] leading-[1.3] font-medium tracking-[1.1px] text-esk-muted">
                  {isCurrent ? 'ESTE MÊS' : 'MÊS'}
                </p>
                <label className="relative flex items-center gap-3 rounded-[16px] bg-esk-elevated py-[6px] pr-3 pl-3">
                  <span className="sr-only">Escolher mês</span>
                  <select
                    value={month}
                    onChange={(e) => {
                      setMonth(e.target.value)
                      setShowAll(false)
                    }}
                    className="cursor-pointer appearance-none bg-transparent pr-5 font-inter-m text-[12px] leading-[1.3] font-medium text-white outline-none"
                  >
                    {months.map((m) => (
                      <option key={m} value={m} className="bg-esk-elevated">
                        {monthLabel(m)}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-3">
                    <Asset name="3338f.svg" size={12} />
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-between gap-3 leading-[1.3] whitespace-nowrap">
                <p className="font-inter-m text-[36px] font-medium tracking-[-1.44px] text-white lg:text-[44px] lg:tracking-[-1.9px]">
                  <CountUp value={summary.total} format={(n) => privateMoney(brl(n), hidden)} />
                </p>
                {variation !== null && (
                  <div className="flex flex-col items-end gap-px">
                    <p className={cx('font-inter-m text-[12px] font-medium', variation <= 0 ? 'text-esk-lime' : 'text-white')}>
                      {variation <= 0 ? `↘ ${Math.abs(variation)}% menos` : `↗ ${variation}% mais`}
                    </p>
                    <p className="font-inter text-[10px] text-esk-muted">que em {monthName(Number(previousMonth(month).slice(5, 7)) - 1)}</p>
                  </div>
                )}
              </div>

              {state.budget.total <= 0 ? (
                <button
                  type="button"
                  onClick={() => openSheet({ type: 'budget' })}
                  className="self-start font-inter-m text-[12px] leading-[1.3] font-medium text-esk-lime hover:underline"
                >
                  Definir limite de gasto do mês
                </button>
              ) : (
              <div className="flex items-start justify-between leading-[1.3] whitespace-nowrap">
                <p className={cx('font-inter-m text-[12px] font-medium', available >= 0 ? 'text-esk-lime' : 'text-white')}>
                  {available >= 0 ? `${privateMoney(brlShort(available), hidden)} ainda disponíveis` : `${privateMoney(brlShort(-available), hidden)} acima do teto`}
                </p>
                <p className="font-inter text-[11px] text-esk-muted">Teto de {privateMoney(brlShort(state.budget.total), hidden)}</p>
              </div>
              )}

              <div className="flex h-[10px] gap-1 overflow-hidden rounded-[5px]" aria-hidden>
                {summary.byCategory.length === 0 ? (
                  <div className="h-full flex-1 rounded-[3px] bg-esk-track" />
                ) : (
                  summary.byCategory.map((c) => (
                    <div
                      key={c.category}
                      className="h-full origin-left animate-[grow-x_600ms_cubic-bezier(0.2,0.8,0.2,1)_both] rounded-[3px] transition-[flex-grow] duration-500"
                      style={{ flexGrow: c.amount, backgroundColor: categoryMeta(state, c.category).color }}
                    />
                  ))
                )}
              </div>

              {tiles.length > 0 && (
                <CategoryTiles count={tiles.length}>
                  {tiles.map((c, i) => (
                    <button
                      key={c.category}
                      type="button"
                      onClick={() => navigate('goals')}
                      className="flex h-[142px] min-w-0 animate-rise flex-col items-start gap-2 rounded-[26px] pt-4 pr-[10px] pb-[14px] pl-[13px] text-left text-esk-ink transition duration-200 hover:-translate-y-0.5 hover:brightness-[0.97] active:scale-[0.97] lg:h-[156px] lg:pl-4"
                      style={{ backgroundColor: categoryMeta(state, c.category).color, animationDelay: `${80 + Math.min(i, 5) * 60}ms` }}
                    >
                      <CategoryTileIcon category={c.category} />
                      <span className="flex min-w-0 flex-col gap-[3px] leading-[1.3]">
                        <span className="truncate font-inter-m text-[10px] font-medium lg:text-[11px]">{categoryMeta(state, c.category).label}</span>
                        <span className="font-inter-sb text-[18px] font-semibold tracking-[-0.54px] whitespace-nowrap lg:text-[20px]">
                          {privateMoney(brlShort(c.amount), hidden)}
                        </span>
                      </span>
                      <span className="mt-auto font-inter text-[9px] leading-[1.3] text-esk-ink-2 lg:text-[10px]">
                        {c.cap !== undefined ? `${pct(c.amount, c.cap)}% do teto` : 'Sem teto'}
                      </span>
                    </button>
                  ))}
                </CategoryTiles>
              )}
            </section>

            <section aria-label="Transações" className="flex flex-col gap-[14px]">
              <div className="flex items-center justify-between leading-[1.4] whitespace-nowrap text-esk-muted">
                <p className="font-inter-m text-[11px] font-medium tracking-[1.1px]">TRANSAÇÕES</p>
                <p className="font-inter text-[10px]">Registradas por você</p>
              </div>

              {summary.transactions.length === 0 ? (
                <div className="flex flex-col items-start gap-3 rounded-[26px] border border-dashed border-esk-track p-6">
                  <p className="font-inter-m text-[15px] font-medium text-white">Nenhum gasto em {monthName(Number(month.slice(5, 7)) - 1)}</p>
                  <p className="font-inter text-[12px] text-esk-muted">Fez uma compra? Digite o valor e o mês se mexe.</p>
                  <button
                    type="button"
                    onClick={() => openSheet({ type: 'add' })}
                    className="mt-1 rounded-[16px] bg-esk-lime px-4 py-2 font-inter-m text-[12px] font-medium text-esk-ink"
                  >
                    Adicionar gasto
                  </button>
                </div>
              ) : (
                <ul className="flex flex-col">
                  {txs.map((t, i) => (
                    <li key={t.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
                      {i > 0 && <div className="h-px bg-esk-border" />}
                      <button
                        type="button"
                        onClick={() => openSheet({ type: 'tx', id: t.id })}
                        className="-mx-2 flex min-h-[62px] w-[calc(100%+16px)] items-center gap-3 rounded-[18px] px-2 py-2 text-left transition hover:bg-white/[0.03]"
                      >
                        <span className="grid size-[44px] shrink-0 place-items-center rounded-[22px] bg-esk-row">
                          <CategoryRowIcon category={t.category} name={t.name} />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-[3px] leading-[1.4]">
                          <span className="truncate font-inter-m text-[15px] font-medium text-white">{t.name}</span>
                          <span className="truncate font-inter text-[9px] text-esk-muted md:text-[11px]">
                            {categoryMeta(state, t.category).label} · {methodLabel(state, t)}
                            {t.source === 'fatura' && <span className="ml-1 rounded-[6px] bg-esk-lilac px-[5px] py-px text-esk-ink">fatura</span>}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-[3px] leading-[1.4] whitespace-nowrap">
                          <span className="font-inter-m text-[12px] font-medium tracking-[-0.24px] text-white md:text-[14px]">{privateExpense(t.amount, hidden)}</span>
                          <span className="font-inter text-[10px] text-esk-muted md:text-[11px]">{relativeDay(t.date, TODAY)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {summary.transactions.length > 6 && (
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="flex items-center gap-1 self-start font-inter-m text-[12px] font-medium text-esk-lime"
                >
                  {showAll ? 'Mostrar menos' : `Ver mais (${summary.transactions.length - 6})`}
                  <ChevronDown size={14} className={cx('transition', showAll && 'rotate-180')} />
                </button>
              )}
            </section>
          </div>
        </div>
      </Page>
      <footer className="mt-auto px-[32px] pb-6 text-center md:px-10 md:pb-8 lg:px-14 3xl:px-16">
        <p className="font-inter text-[10px] leading-[1.4] text-esk-muted">
          Seu assistente financeiro para gastos e conquistas.
        </p>
      </footer>
    </div>
  )
}
