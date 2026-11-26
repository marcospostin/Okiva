import { ArrowDownLeft, ArrowLeftRight, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, CreditCard, Repeat, Scale, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { categoryMeta, UNCATEGORIZED } from '../data/categories'
import { Asset, CategoryRowIcon, CategoryTileIcon } from '../components/icons'
import { Avatar, CountUp, cx, Page, SearchField, SearchSummary } from '../components/ui'
import { searchTransactions } from '../lib/search'
import { movementAmount, movementSubtitle } from '../lib/movements'
import { InstallmentsBlock } from '../components/InstallmentsBlock'
import { brl, brlShort, capitalize, privateExpense, privateIncome, privateMoney, monthName, pct, relativeDay } from '../lib/format'
import { incomeLabel, kindOf } from '../lib/ledger'
import { today } from '../data/mock'
import { toISO } from '../lib/format'
import {
  availableMonths,
  balanceOf,
  currentMonth,
  methodLabel,
  monthSummary,
  previousMonth,
  accountName,
  topAccounts,
  uncategorized,
  useStore,
} from '../state/store'
import type { Transaction } from '../types'
import { useUI } from '../state/ui'
import { Donut } from '../components/charts'
import { rememberReportsOpen, type ReportTab } from '../lib/reports'
import { LockBadge, PlusHint, PLUS_PITCH } from '../components/PlusHint'
import { Isotype } from '../components/Isotype'

const monthLabel = (key: string) => {
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

function MonthPicker({ months, value, onChange }: { months: string[]; value: string; onChange: (m: string) => void }) {
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

function TxRowIcon({ t }: { t: Transaction }) {
  const k = kindOf(t)
  if (k === 'income') return <ArrowDownLeft size={20} strokeWidth={1.7} className="text-esk-lime" aria-hidden />
  if (k === 'invoice_payment') return <CreditCard size={19} strokeWidth={1.6} className="text-esk-text-2" aria-hidden />
  if (k === 'transfer') return <ArrowLeftRight size={19} strokeWidth={1.6} className="text-esk-text-2" aria-hidden />
  if (k === 'adjustment') return <Scale size={19} strokeWidth={1.6} className="text-esk-text-2" aria-hidden />
  return <CategoryRowIcon category={t.category} name={t.name} />
}

/** Até 3 cards cabem lado a lado em qualquer largura; acima disso vira carrossel. */
const STATIC_TILES = 3
/** Máximo de cards na Home (o último vira "Ver todos" somando o restante). */
const MAX_TILES_WIDE = 8
const MAX_TILES_NARROW = 6
/** Cor do trecho "restante" na barra e do marcador no card "Ver todos". */
const REST_COLOR = '#4e4e55'

/** true quando a media query bate (atualiza ao redimensionar). */
function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setMatches(window.matchMedia(query).matches)
    on()
    // 'change' cobre a maioria dos navegadores; 'resize' garante quando o evento não dispara
    mq.addEventListener('change', on)
    window.addEventListener('resize', on)
    return () => {
      mq.removeEventListener('change', on)
      window.removeEventListener('resize', on)
    }
  }, [query])
  return matches
}

/**
 * Cards de categoria do mês.
 * - Até 3: grade fixa de 3 colunas (igual ao design original).
 * - Mais de 3: carrossel com rolagem e encaixe (scroll-snap). Mostra ~2,3 cards no
 *   celular e ~3,3 no tablet/desktop: o card cortado na borda indica que há mais.
 *   No celular o carrossel vai até a borda da tela. Com mouse/trackpad (qualquer
 *   largura) aparecem setas; em tela de toque, desliza com o dedo.
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
    <div className="@container relative min-w-0" role="region" aria-roledescription="carrossel" aria-label="Categorias do mês">
      <div
        ref={rail}
        onScroll={update}
        className={cx(
          '-mx-[32px] flex snap-x snap-mandatory scroll-px-[32px] gap-3 overflow-x-auto px-[32px] pb-1 [scrollbar-width:none] md:mx-0 md:scroll-px-0 md:px-0 [&::-webkit-scrollbar]:hidden',
          // Quantos cards cabem depende da largura da coluna (não da tela): ~2.3 até 460px
          // (celular e tablet, onde a coluna é estreita), ~3.3 a partir daí (computador)
          '[&>*]:shrink-0 [&>*]:basis-[calc((100%-12px)/2.3)] [&>*]:snap-start @min-[460px]:[&>*]:basis-[calc((100%-24px)/3.3)]',
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
            // Arrows on any width when there is a mouse/trackpad (hover); touch screens swipe instead
            'absolute top-1/2 hidden size-[36px] -translate-y-1/2 place-items-center rounded-full bg-esk-ink/85 text-white shadow-[0_6px_20px_rgba(0,0,0,0.45)] ring-1 ring-white/10 backdrop-blur transition duration-200 hover:bg-esk-ink [@media(hover:hover)]:grid',
            side === 'prev' ? 'left-[-10px] md:-left-[14px]' : 'right-[-10px] md:-right-[14px]',
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
  // Mês que sumiu (ex.: compra parcelada apagada): volta para o atual
  useEffect(() => {
    if (!months.includes(month)) setMonth(currentMonth())
  }, [months, month])
  // Virou o mês com o app aberto: quem estava no mês atual passa para o novo (outra escolha fica)
  const nowMonth = currentMonth()
  const lastNowMonth = useRef(nowMonth)
  useEffect(() => {
    if (lastNowMonth.current === nowMonth) return
    setMonth((m) => (m === lastNowMonth.current ? nowMonth : m))
    lastNowMonth.current = nowMonth
  }, [nowMonth])
  const balance = balanceOf(state)
  const plus = state.stage === 2
  const hidden = state.hideBalance
  const isCurrent = month === currentMonth()
  const isFuture = summary.future
  const available = state.budget.total - summary.total
  const budgetUsed = pct(summary.total, state.budget.total)
  const variation = summary.previousTotal ? pct(summary.total - summary.previousTotal, summary.previousTotal) : null
  const todayKey = toISO(today())
  // Busca: procura em todos os meses (não só no escolhido)
  const [query, setQuery] = useState('')
  const searching = query.trim().length > 0
  const results = useMemo(() => {
    if (!searching) return []
    const all = [...state.transactions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    return searchTransactions(state, all, query)
  }, [state, query, searching])
  const listSource = searching ? results : summary.transactions
  const listLimit = searching ? 20 : 6
  const txs = showAll ? listSource : listSource.slice(0, listLimit)
  const thisYear = todayKey.slice(0, 4)
  const dayLabel = (iso: string) => {
    const base = relativeDay(iso, today())
    return searching && iso.slice(0, 4) !== thisYear ? `${base} ${iso.slice(0, 4)}` : base
  }

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

  // Limite de cards: 8 a partir do tablet, 6 no celular. Passou disso, o último card
  // vira "Ver todos" e soma as categorias que não aparecem (o mesmo vale na barra).
  const wide = useMediaQuery('(min-width: 768px)')
  const maxTiles = wide ? MAX_TILES_WIDE : MAX_TILES_NARROW
  const overflow = tiles.length > maxTiles
  const shownTiles = overflow ? tiles.slice(0, maxTiles - 1) : tiles
  const restTiles = overflow ? tiles.slice(maxTiles - 1) : []
  const restAmount = restTiles.reduce((s, t) => s + t.amount, 0)
  const barSegments = useMemo(() => {
    const rest = new Set(restTiles.map((t) => t.category))
    const segs = summary.byCategory
      .filter((c) => !rest.has(c.category))
      .map((c) => ({ key: c.category, amount: c.amount, color: categoryMeta(state, c.category).color }))
    if (restAmount > 0) segs.push({ key: '__rest', amount: restAmount, color: REST_COLOR })
    // Gasto sem categoria: entra no total do mês, num trecho cinza listrado no fim da barra
    if (summary.uncategorized > 0) segs.push({ key: '__none', amount: summary.uncategorized, color: UNCATEGORIZED.color })
    return segs
  }, [summary.byCategory, summary.uncategorized, restTiles, restAmount, state])
  const pendingCount = useMemo(() => uncategorized(state).length, [state])
  // Prévia dos relatórios: mesmas fatias da barra do mês (com teto ou não), maiores primeiro
  const reportSlices = useMemo(
    () =>
      [
        ...summary.byCategory.map((c) => ({ key: c.category, value: c.amount, color: categoryMeta(state, c.category).color, label: categoryMeta(state, c.category).label })),
        ...(summary.uncategorized > 0 ? [{ key: '__none', value: summary.uncategorized, color: UNCATEGORIZED.color, label: 'Sem categoria', hatched: true }] : []),
      ].sort((a, b) => b.value - a.value),
    [summary.byCategory, summary.uncategorized, state],
  )
  const reportTop = reportSlices.slice(0, 3)
  const openReports = (tab: ReportTab) => {
    rememberReportsOpen({ tab, month })
    navigate('reports')
  }

  // Fatura fica sempre visível; sem o Plus aparece bloqueada e o toque explica o recurso
  const [plusHint, setPlusHint] = useState(false)
  const shortcutsRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (plus) setPlusHint(false)
  }, [plus])
  const shortcuts = [
    { key: 'add', label: 'Adicionar', icon: <Asset name="0a681.svg" size={23} />, onClick: () => openSheet({ type: 'add' }), primary: true, locked: false },
    {
      key: 'invoice',
      label: 'Fatura',
      icon: <Asset name="c2640.svg" size={23} />,
      onClick: () => (plus ? navigate('invoice') : setPlusHint((v) => !v)),
      primary: false,
      locked: !plus,
    },
    { key: 'cards', label: 'Cartões', icon: <Asset name="3b177.svg" size={23} />, onClick: () => navigate('cards'), primary: false, locked: false },
    { key: 'goals', label: 'Metas', icon: <Asset name="3e49f.svg" size={23} />, onClick: () => navigate('goals'), primary: false, locked: false },
  ]

  return (
    <div className="flex min-h-[calc(100dvh-var(--tabbar-space,0px))] flex-col bg-esk-bg">
      <Page wide className="flex-1">
        {/* Header: avatar opens the account sheet. No bell, no search. */}
        <header className="mt-8 flex h-[48px] items-center gap-3 md:mt-10">
          <button
            type="button"
            onClick={() => navigate('settings')}
            className="shrink-0 rounded-full transition active:scale-95"
            aria-label="Abrir conta"
          >
            <Avatar user={state.user} />
          </button>
          <div className="flex min-w-0 flex-1 flex-col gap-[2px] leading-[1.35] whitespace-nowrap">
            <p className="font-inter text-[11px] text-esk-muted">Bem-vindo de volta</p>
            <p className="font-inter-m text-[18px] font-medium text-white">Olá, {state.user?.name.split(' ')[0] ?? 'Lucas'}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-[6px] md:flex-row-reverse md:items-center md:gap-2">
            <p className="flex items-center gap-[0.22em] font-logo text-[22px] leading-none font-bold tracking-[-0.6px] text-esk-lime md:text-[26px]"><Isotype className="md:hidden" />Okiva</p>
            {plus && <span className="rounded-full bg-esk-lilac px-2 py-1 font-mono text-[9px] leading-none font-medium tracking-[0.8px] text-esk-ink">PLUS</span>}
          </div>
        </header>

        <div className="mt-6 grid gap-6 wide:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-8 lg:gap-10 wide:3xl:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] 3xl:gap-12">
          {/* Left: balance + shortcuts */}
          <div className="flex flex-col gap-6 wide:sticky wide:top-8 wide:self-start">
            <section
              aria-label="Saldo disponível"
              className="@container relative flex min-h-[184px] flex-col gap-3 overflow-hidden rounded-[32px] px-6 py-[22px] lg:min-h-[240px] lg:rounded-[34px] lg:px-8 lg:py-7 3xl:min-h-[280px]"
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
                className="font-inter-m text-[min(43px,var(--fit))] leading-[1.35] font-medium tracking-[-0.04em] whitespace-nowrap text-esk-ink lg:text-[min(56px,var(--fit))] 3xl:text-[min(66px,var(--fit))] 3xl:tracking-[-0.045em]"
                // Cabe sempre no cartão: cada caractere ocupa ~0,5 da altura da letra, então a letra
                // pode ter até 96% da largura útil dividida por (0,5 × caracteres)
                style={{ '--fit': `${Math.min(16, 192 / Math.max(brl(balance).length, 1))}cqw` } as CSSProperties}
                aria-live="polite"
              >
                <CountUp value={balance} format={(n) => privateMoney(brl(n), hidden)} />
              </p>
              <div className="mt-auto flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => navigate('accounts')}
                  className="group -m-1 flex items-center gap-[6px] rounded-full p-1 transition hover:bg-black/5"
                >
                  <Asset name="009b2.svg" size={15} />
                  <span className="font-inter-m text-[12px] font-medium text-esk-ink">
                    {topAccounts(state).length > 1 ? `${topAccounts(state).length} contas` : 'Ver contas'}
                  </span>
                  <ChevronRight size={13} strokeWidth={2.2} className="text-esk-ink transition group-hover:translate-x-0.5" aria-hidden />
                </button>
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

            <div className="flex flex-col gap-3">
            <nav ref={shortcutsRef} aria-label="Atalhos" className="grid grid-cols-4 gap-2 sm:gap-3">
              {shortcuts.map((s, i) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={s.onClick}
                  aria-label={s.locked ? `${s.label} (exclusivo do Plus)` : undefined}
                  aria-disabled={s.locked || undefined}
                  aria-expanded={s.locked ? plusHint : undefined}
                  style={{ animationDelay: `${i * 50}ms` }}
                  className={cx(
                    'relative flex h-[84px] min-w-0 animate-rise flex-col items-start gap-2 rounded-[24px] pt-[14px] pr-2 pb-3 pl-3 text-left transition duration-200 active:scale-[0.96] sm:pr-3 sm:pl-4 lg:h-[96px]',
                    s.primary ? 'bg-esk-lime hover:-translate-y-0.5 hover:brightness-95' : 'bg-esk-tile hover:bg-[#242427]',
                    !s.locked && !s.primary && 'hover:-translate-y-0.5',
                  )}
                >
                  <span className={cx(s.locked && 'opacity-40 saturate-50')}>{s.icon}</span>
                  <span
                    className={cx(
                      'max-w-full truncate font-inter-m text-[11px] leading-[1.35] font-medium tracking-[-0.2px] sm:text-[12px] sm:tracking-normal lg:text-[13px]',
                      s.primary ? 'text-esk-ink' : s.locked ? 'text-white/40' : 'text-white',
                    )}
                  >
                    {s.label}
                  </span>
                  {s.locked && <LockBadge className="top-[10px] right-[10px] ring-esk-tile" />}
                </button>
              ))}
            </nav>
            {plusHint && !plus && (
              <PlusHint
                label="Fatura"
                pitch={PLUS_PITCH.invoice}
                view="invoice"
                arrow="top"
                arrowLeft="37.5%"
                within={shortcutsRef}
                onClose={() => setPlusHint(false)}
              />
            )}
            </div>

          </div>

          {/* Right: this month + transactions */}
          {/* min-w-0: grid items grow to fit their content by default; the carousel must scroll instead */}
          {/* Tela larga: gastos à esquerda; relatórios e, logo abaixo, transações à direita */}
          <div className="grid min-w-0 gap-8 md:gap-10 3xl:grid-cols-2 3xl:grid-rows-[auto_1fr] 3xl:items-start 3xl:gap-x-12 3xl:gap-y-10">
            <section aria-label="Gastos do mês" className="flex min-w-0 flex-col gap-4 3xl:row-span-2">
              <div className="flex items-center justify-between">
                <p className="font-inter-m text-[11px] leading-[1.3] font-medium tracking-[1.1px] text-esk-muted">
                  {isCurrent ? 'ESTE MÊS' : isFuture ? 'PREVISTO · PARCELAS' : 'MÊS'}
                </p>
                <MonthPicker
                  months={months}
                  value={month}
                  onChange={(m) => {
                    setMonth(m)
                    setShowAll(false)
                  }}
                />
              </div>

              {/* Gasto do mês e teto num card só: o total e o quanto dele já foi usado */}
              <div className={cx('flex flex-col gap-4 rounded-[26px] bg-esk-surface px-5 pt-[18px] pb-5', isFuture && 'opacity-80')}>
                <div className="flex items-center justify-between gap-3 leading-[1.3] whitespace-nowrap">
                  <p className={cx('font-inter-m text-[36px] font-medium tracking-[-1.44px] lg:text-[44px] lg:tracking-[-1.9px]', isFuture ? 'text-esk-muted' : 'text-white')}>
                    <CountUp value={summary.total} format={(n) => privateMoney(brl(n), hidden)} />
                  </p>
                  {isFuture && <p className="font-inter text-[11px] whitespace-normal text-right text-esk-muted">Já comprometido</p>}
                  {variation !== null && !isFuture && (
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
                  <button
                    type="button"
                    onClick={() => openSheet({ type: 'budget' })}
                    aria-label={`Teto do mês: ${budgetUsed}% usado. Toque para ajustar.`}
                    className="-mx-2 -mb-2 flex flex-col gap-[10px] rounded-[18px] px-2 pt-1 pb-2 text-left transition hover:bg-white/[0.03] active:scale-[0.99]"
                  >
                    <span className="block h-[8px] w-full overflow-hidden rounded-[4px] bg-esk-track">
                      <span
                        className={cx(
                          'block h-full origin-left animate-[grow-x_700ms_cubic-bezier(0.2,0.8,0.2,1)_both] rounded-[4px] transition-[width] duration-700',
                          available >= 0 ? 'bg-esk-lime' : 'bg-esk-lilac',
                        )}
                        style={{ width: `${Math.min(100, budgetUsed)}%` }}
                      />
                    </span>
                    <span className="flex items-baseline justify-between gap-3 leading-[1.3] whitespace-nowrap">
                      <span className={cx('font-inter-m text-[13px] font-medium', available >= 0 ? 'text-esk-lime' : 'text-esk-lilac')}>
                        {available >= 0 ? `${privateMoney(brlShort(available), hidden)} ainda ${isFuture ? 'livres' : 'disponíveis'}` : `${privateMoney(brlShort(-available), hidden)} acima do teto`}
                      </span>
                      <span className="font-inter text-[11px] text-esk-muted">
                        <span className="font-inter-m font-medium text-white">{budgetUsed}%</span> de {privateMoney(brlShort(state.budget.total), hidden)}
                      </span>
                    </span>
                  </button>
                )}
              </div>

              {/* Distribuição por categoria: separada do teto, junto dos cards que ela resume */}
              {barSegments.length > 0 && (
                <div className="flex flex-col gap-[10px] pt-2">
                  <div className="flex items-center justify-between leading-[1.3]">
                    <p className="font-inter-m text-[11px] font-medium tracking-[1.1px] text-esk-muted">POR CATEGORIA</p>
                    <button type="button" onClick={() => navigate('goals')} className="font-inter text-[11px] text-esk-muted hover:text-white">
                      Tetos em Metas
                    </button>
                  </div>
                  <div className="flex h-[6px] gap-1 overflow-hidden rounded-[3px]" aria-hidden>
                    {barSegments.map((s) => (
                      <div
                        key={s.key}
                        className={cx('h-full origin-left animate-[grow-x_600ms_cubic-bezier(0.2,0.8,0.2,1)_both] rounded-[3px] transition-[flex-grow] duration-500', isFuture && 'opacity-50')}
                        style={{
                          flexGrow: s.amount,
                          backgroundColor: s.color,
                          // Mês que ainda não chegou / sem categoria: listras
                          backgroundImage:
                            isFuture || s.key === '__none' ? 'repeating-linear-gradient(135deg, rgba(0,0,0,0.35) 0 3px, transparent 3px 7px)' : undefined,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {tiles.length > 0 && (
                <CategoryTiles count={shownTiles.length + (overflow ? 1 : 0)}>
                  {shownTiles.map((c, i) => {
                    const meta = categoryMeta(state, c.category)
                    // Card cheio na cor da categoria; com teto, a % usada vira uma barra no rodapé (como em Metas)
                    const used = c.cap !== undefined ? Math.min(100, (c.amount / c.cap) * 100) : null
                    return (
                    <button
                      key={c.category}
                      type="button"
                      onClick={() => navigate('goals')}
                      className={cx(
                        '@container flex h-[142px] min-w-0 animate-rise flex-col items-start gap-2 rounded-[26px] pt-4 pr-[10px] pb-[14px] pl-[13px] text-left text-esk-ink transition duration-200 hover:-translate-y-0.5 hover:brightness-[0.97] active:scale-[0.97] lg:h-[156px] lg:pl-4',
                        isFuture && 'opacity-60',
                      )}
                      style={{ backgroundColor: meta.color, animationDelay: `${80 + Math.min(i, 5) * 60}ms` }}
                    >
                      <CategoryTileIcon category={c.category} />
                      <span className="flex min-w-0 flex-col gap-[3px] leading-[1.3]">
                        <span className="truncate font-inter-m text-[10px] font-medium lg:text-[11px]">{meta.label}</span>
                        <span
                          className="font-inter-sb text-[min(18px,var(--fit))] font-semibold tracking-[-0.03em] whitespace-nowrap lg:text-[min(20px,var(--fit))]"
                          // Cabe sempre no card: cada caractere ocupa ~0,5 da altura da letra (até ~92% da largura útil)
                          style={{ '--fit': `${180 / Math.max(brlShort(c.amount).length, 1)}cqw` } as CSSProperties}
                        >
                          {privateMoney(brlShort(c.amount), hidden)}
                        </span>
                      </span>
                      <span className="mt-auto flex w-full flex-col gap-[6px]">
                        <span className="font-inter text-[9px] leading-[1.3] text-esk-ink-2 lg:text-[10px]">
                          {c.cap !== undefined ? `${pct(c.amount, c.cap)}% do teto` : 'Sem teto'}
                        </span>
                        {used !== null && (
                          <span aria-hidden className="block h-[5px] w-full overflow-hidden rounded-[3px] bg-esk-ink/15">
                            <span
                              className="block h-full origin-left animate-[grow-x_800ms_cubic-bezier(0.2,0.8,0.2,1)_both] rounded-[3px] bg-esk-ink transition-[width] duration-700"
                              style={{ width: `${used}%`, animationDelay: `${200 + Math.min(i, 5) * 60}ms` }}
                            />
                          </span>
                        )}
                      </span>
                    </button>
                    )
                  })}
                  {/* Último card: soma das categorias que não cabem na Home (mesmo trecho cinza na barra) */}
                  {overflow && (
                    <button
                      type="button"
                      onClick={() => navigate('goals')}
                      aria-label={`Ver todas as categorias: mais ${restTiles.length}, ${privateMoney(brlShort(restAmount), hidden)} no mês`}
                      className="group flex h-[142px] min-w-0 animate-rise flex-col items-start gap-2 rounded-[26px] bg-esk-tile pt-4 pr-[10px] pb-[14px] pl-[13px] text-left text-white ring-1 ring-esk-track transition duration-200 hover:-translate-y-0.5 hover:bg-esk-hover active:scale-[0.97] lg:h-[156px] lg:pl-4"
                      style={{ animationDelay: `${80 + Math.min(shownTiles.length, 5) * 60}ms` }}
                    >
                      {/* Cores das categorias escondidas */}
                      <span className="flex h-[24px] items-center -space-x-[5px]" aria-hidden>
                        {restTiles.slice(0, 4).map((t) => (
                          <span key={t.category} className="size-[16px] rounded-full ring-2 ring-esk-tile" style={{ backgroundColor: categoryMeta(state, t.category).color }} />
                        ))}
                      </span>
                      <span className="flex min-w-0 flex-col gap-[3px] leading-[1.3]">
                        <span className="flex items-center gap-[6px] truncate font-inter-m text-[10px] font-medium text-esk-muted lg:text-[11px]">
                          <span className="size-[8px] shrink-0 rounded-[2px]" style={{ backgroundColor: REST_COLOR }} aria-hidden />
                          +{restTiles.length} {restTiles.length === 1 ? 'categoria' : 'categorias'}
                        </span>
                        <span className="font-inter-sb text-[18px] font-semibold tracking-[-0.54px] whitespace-nowrap lg:text-[20px]">
                          {privateMoney(brlShort(restAmount), hidden)}
                        </span>
                      </span>
                      <span className="mt-auto flex items-center gap-1 font-inter-m text-[10px] font-medium text-esk-lime lg:text-[11px]">
                        Ver todas
                        <ChevronRight size={12} strokeWidth={2.2} className="transition group-hover:translate-x-0.5" aria-hidden />
                      </span>
                    </button>
                  )}
                </CategoryTiles>
              )}
            </section>

            {/* Relatórios: prévia do mês + atalhos para a tela completa */}
            <section aria-label="Relatórios" className="flex min-w-0 flex-col gap-[14px] 3xl:col-start-2 3xl:row-start-1">
              <div className="flex items-center justify-between leading-[1.4] whitespace-nowrap text-esk-muted">
                <p className="font-inter-m text-[11px] font-medium tracking-[1.1px]">RELATÓRIOS</p>
                <p className="font-inter text-[10px]">{monthLabel(month)}</p>
              </div>
              <div className="flex flex-col gap-4 rounded-[26px] bg-esk-surface p-4">
                {reportSlices.length === 0 ? (
                  <div className="flex flex-col gap-1 py-2">
                    <p className="font-inter-m text-[14px] font-medium text-white">Seus gastos do mês aparecem aqui</p>
                    <p className="font-inter text-[12px] text-esk-muted">Por categoria, por lugar e mês a mês, para ver para onde o dinheiro está indo.</p>
                  </div>
                ) : (
                  <button type="button" onClick={() => openReports('categorias')} className="flex items-center gap-4 text-left" aria-label="Abrir relatório por categoria">
                    <Donut
                      slices={reportSlices}
                      size={108}
                      thickness={16}
                      label="Gastos do mês por categoria"
                      center={<span className="font-inter-m text-[12px] font-medium text-white">{privateMoney(brlShort(Math.round(summary.total)), hidden)}</span>}
                    />
                    <ul className="flex min-w-0 flex-1 flex-col gap-[6px]">
                      {reportTop.map((c) => (
                        <li key={c.key} className="flex items-center gap-2 font-inter text-[12px]">
                          <span className="size-[8px] shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                          <span className="min-w-0 flex-1 truncate text-white">{c.label}</span>
                          <span className="shrink-0 text-esk-muted">{pct(c.value, summary.total)}%</span>
                        </li>
                      ))}
                      {reportSlices.length > reportTop.length && (
                        <li className="font-inter text-[11px] text-esk-subtle">+{reportSlices.length - reportTop.length} {reportSlices.length - reportTop.length === 1 ? 'categoria' : 'categorias'}</li>
                      )}
                    </ul>
                  </button>
                )}
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ['categorias', 'Categorias'],
                    ['onde', 'Onde'],
                    ['mes', 'Mês a mês'],
                  ] as const).map(([tab, label]) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => openReports(tab)}
                      className="h-[36px] rounded-[14px] bg-esk-elevated font-inter-m text-[12px] font-medium text-white ring-1 ring-esk-track transition hover:bg-esk-hover active:scale-[0.97]"
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => openReports('categorias')} className="flex items-center justify-end gap-1 self-end font-inter-m text-[12px] font-medium text-esk-lime">
                  Ver relatório completo <ChevronRight size={14} aria-hidden />
                </button>
              </div>
            </section>

            <section aria-label="Transações" className="flex min-w-0 flex-col gap-[14px] 3xl:col-start-2 3xl:row-start-2">
              <div className="flex items-center justify-between leading-[1.4] whitespace-nowrap text-esk-muted">
                <p className="font-inter-m text-[11px] font-medium tracking-[1.1px]">TRANSAÇÕES</p>
                <p className="font-inter text-[10px]">{summary.income > 0 ? `${privateIncome(summary.income, hidden)} de receitas` : 'Registradas por você'}</p>
              </div>

              {!searching && (
                <InstallmentsBlock
                  state={state}
                  month={month}
                  today={todayKey}
                  onPickMonth={setMonth}
                  onOpenTx={(id) => openSheet({ type: 'tx', id })}
                />
              )}

              {state.transactions.length > 0 && (
                <div className="flex flex-col gap-2">
                  <SearchField
                    value={query}
                    onChange={(v) => {
                      setQuery(v)
                      setShowAll(false)
                    }}
                  />
                  {searching && results.length > 0 && <SearchSummary txs={results} hidden={hidden} scope="em todos os meses" />}
                </div>
              )}

              {/* Gastos sem categoria: ficam sinalizados até a pessoa classificar */}
              {pendingCount > 0 && !searching && (
                <button
                  type="button"
                  onClick={() => openSheet({ type: 'categorize' })}
                  className="flex animate-rise items-center gap-3 rounded-[20px] bg-esk-lilac/10 px-4 py-3 text-left ring-1 ring-esk-lilac/30 transition hover:bg-esk-lilac/15 active:scale-[0.99]"
                >
                  <span className="grid size-[34px] shrink-0 place-items-center rounded-full bg-esk-lilac text-esk-ink">
                    <CircleHelp size={18} strokeWidth={1.9} aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-inter-m text-[13px] font-medium text-white">
                      {pendingCount === 1 ? '1 gasto sem categoria' : `${pendingCount} gastos sem categoria`}
                    </span>
                    <span className="font-inter text-[11px] text-esk-muted">Classifique para os tetos ficarem certos</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 font-inter-m text-[12px] font-medium text-esk-lilac">
                    Classificar <ChevronRight size={14} aria-hidden />
                  </span>
                </button>
              )}

              {searching && results.length === 0 ? (
                <div className="flex flex-col items-start gap-1 rounded-[26px] border border-dashed border-esk-track p-6">
                  <p className="font-inter-m text-[15px] font-medium text-white">Nada com “{query.trim()}”</p>
                  <p className="font-inter text-[12px] text-esk-muted">Tente parte do nome, a categoria, um valor (45,90 ou &gt;100) ou uma data (12/11, novembro).</p>
                </div>
              ) : !searching && summary.transactions.length === 0 ? (
                <div className="flex flex-col items-start gap-3 rounded-[26px] border border-dashed border-esk-track p-6">
                  <p className="font-inter-m text-[15px] font-medium text-white">Nada em {monthName(Number(month.slice(5, 7)) - 1)}</p>
                  <p className="font-inter text-[12px] text-esk-muted">Fez uma compra ou recebeu algo? Digite o valor e o mês se mexe.</p>
                  <button
                    type="button"
                    onClick={() => openSheet({ type: 'add' })}
                    className="mt-1 rounded-[16px] bg-esk-lime px-4 py-2 font-inter-m text-[12px] font-medium text-esk-ink"
                  >
                    Adicionar
                  </button>
                </div>
              ) : (
                <ul className="flex flex-col">
                  {txs.map((t, i) => {
                    const k = kindOf(t)
                    const ahead = t.date > todayKey
                    return (
                    <li key={t.id} className={cx('animate-rise', ahead && 'opacity-60')} style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
                      {i > 0 && <div className="h-px bg-esk-border" />}
                      <button
                        type="button"
                        onClick={() => openSheet({ type: 'tx', id: t.id })}
                        className="-mx-2 flex min-h-[62px] w-[calc(100%+16px)] items-center gap-3 rounded-[18px] px-2 py-2 text-left transition hover:bg-white/[0.03]"
                      >
                        <span className="grid size-[44px] shrink-0 place-items-center rounded-[22px] bg-esk-row">
                          <TxRowIcon t={t} />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-[3px] leading-[1.4]">
                          <span className="flex min-w-0 items-center gap-[6px]">
                            <span className="truncate font-inter-m text-[15px] font-medium text-white">{t.name}</span>
                            {t.recurrenceId && <Repeat size={12} className="shrink-0 text-esk-muted" aria-label="recorrente" />}
                          </span>
                          <span className="truncate font-inter text-[9px] text-esk-muted md:text-[11px]">
                            {k === 'transfer' || k === 'adjustment'
                              ? movementSubtitle(state, t)
                              : k === 'income'
                              ? `${incomeLabel(t.category)} · ${accountName(state, t.accountId)}`
                              : k === 'invoice_payment'
                                ? `Pagamento de fatura · ${accountName(state, t.accountId)}`
                                : t.category === null ? methodLabel(state, t) : `${categoryMeta(state, t.category).label} · ${methodLabel(state, t)}`}
                            {k === 'expense' && t.category === null && (
                              <span className="ml-1 rounded-[6px] bg-esk-lilac px-[5px] py-px text-esk-ink">sem categoria</span>
                            )}
                            {t.installment && (
                              <span className="ml-1 rounded-[6px] bg-white/[0.08] px-[5px] py-px text-white">
                                parcela {t.installment.number} de {t.installment.total}
                              </span>
                            )}
                            {t.source === 'fatura' && <span className="ml-1 rounded-[6px] bg-esk-lilac px-[5px] py-px text-esk-ink">fatura</span>}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-[3px] leading-[1.4] whitespace-nowrap">
                          <span
                            className={cx(
                              'font-inter-m text-[12px] font-medium tracking-[-0.24px] md:text-[14px]',
                              k === 'transfer' || k === 'adjustment' ? 'text-esk-text-2' : k === 'income' ? 'text-esk-positive' : 'text-esk-negative',
                            )}
                          >
                            {k === 'transfer' || k === 'adjustment'
                              ? movementAmount(t, hidden)
                              : k === 'income'
                                ? privateIncome(t.amount, hidden)
                                : privateExpense(t.amount, hidden)}
                          </span>
                          <span className="font-inter text-[10px] text-esk-muted md:text-[11px]">{ahead ? `prevista ${dayLabel(t.date)}` : dayLabel(t.date)}</span>
                        </span>
                      </button>
                    </li>
                    )
                  })}
                </ul>
              )}
              {listSource.length > listLimit && (
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="flex items-center gap-1 self-start font-inter-m text-[12px] font-medium text-esk-lime"
                >
                  {showAll ? 'Mostrar menos' : `Ver mais (${listSource.length - listLimit})`}
                  <ChevronDown size={14} className={cx('transition', showAll && 'rotate-180')} />
                </button>
              )}
            </section>
          </div>
        </div>
      </Page>
      <footer className="mt-auto px-[32px] pb-6 text-center md:-translate-x-[52px] md:px-10 md:pb-8 lg:px-14 3xl:-translate-x-[60px] 3xl:px-16">
        <p className="font-inter text-[10px] leading-[1.4] text-esk-muted">
          Seu assistente para acompanhar contas, cartões e metas.
        </p>
        <Isotype className="mx-auto mt-4 block text-[28px] text-esk-muted md:text-[34px]" />
      </footer>
    </div>
  )
}
