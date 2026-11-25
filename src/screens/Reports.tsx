import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { BarRow, Donut, MonthBars, type Slice } from '../components/charts'
import { Chip, cx, EmptyState, Page, ScreenHeader } from '../components/ui'
import { categoryMeta, UNCATEGORIZED } from '../data/categories'
import { brl, brlShort, pct, privateMoney } from '../lib/format'
import {
  byCategory,
  byPayee,
  expensesIn,
  monthly,
  monthLong,
  monthShort,
  monthsOf,
  periodLabel,
  REPORTS_EVENT,
  shiftMonth,
  takeReportsOpen,
  topWithRest,
  type Group,
  type ReportsEvent,
  type ReportTab,
  type SourceFilter,
  type Span,
} from '../lib/reports'
import { currentMonth, useStore } from '../state/store'
import { useUI } from '../state/ui'
import type { CategoryId } from '../types'

const TABS: { id: ReportTab; label: string }[] = [
  { id: 'categorias', label: 'Categorias' },
  { id: 'onde', label: 'Onde' },
  { id: 'mes', label: 'Mês a mês' },
]
const SPANS: { id: Span; label: string }[] = [
  { id: 1, label: 'Mês' },
  { id: 3, label: '3 meses' },
  { id: 6, label: '6 meses' },
  { id: 12, label: '12 meses' },
]
const REST_COLOR = '#4e4e55'
const MAX_SLICES = 8
const MAX_PAYEES = 12

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export default function Reports() {
  const { state } = useStore()
  const { openSheet } = useUI()
  const hidden = state.hideBalance
  const [initial] = useState(takeReportsOpen)
  const [tab, setTab] = useState<ReportTab>(initial?.tab ?? 'categorias')
  const [anchor, setAnchor] = useState(initial?.month ?? currentMonth())
  const [span, setSpan] = useState<Span>(1)
  const [source, setSource] = useState<SourceFilter>('all')
  /** Onde: só os gastos de uma categoria (undefined = todas, null = sem categoria) */
  const [catFilter, setCatFilter] = useState<CategoryId | null | undefined>(undefined)

  // O detalhe de uma categoria pode pedir "ver onde gastei" sem sair da tela
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<ReportsEvent>).detail
      setTab(d.tab)
      if (d.category !== undefined) setCatFilter(d.category)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    window.addEventListener(REPORTS_EVENT, on)
    return () => window.removeEventListener(REPORTS_EVENT, on)
  }, [])

  // Mês a mês precisa de vários meses: no mínimo 6
  const effectiveSpan: Span = tab === 'mes' && span < 6 ? 6 : span
  const months = useMemo(() => monthsOf(anchor, effectiveSpan), [anchor, effectiveSpan])
  const expenses = useMemo(() => expensesIn(state, months, source), [state, months, source])
  const total = expenses.reduce((s, t) => s + t.amount, 0)
  const future = anchor > currentMonth()

  const sources: { id: SourceFilter; label: string }[] = [
    { id: 'all', label: 'Tudo' },
    ...state.cards.map((c) => ({ id: `card:${c.id}` as SourceFilter, label: c.nickname })),
    ...(state.accounts.length > 1 ? state.accounts.map((a) => ({ id: `acc:${a.id}` as SourceFilter, label: a.name })) : []),
  ]

  const openGroup = (g: Group, sub: string, category?: CategoryId | null) =>
    openSheet({ type: 'reportDetail', title: g.label, subtitle: sub, ids: g.ids, category })

  return (
    <div className="min-h-[calc(100dvh-var(--tabbar-space,0px))] bg-esk-bg-2">
      <Page>
        <ScreenHeader title="Relatórios" />

        <div className="mx-auto flex max-w-[760px] flex-col gap-5 pt-6">
          {/* Abas */}
          <div role="tablist" aria-label="Tipo de relatório" className="grid grid-cols-3 gap-1 rounded-[20px] bg-esk-elevated p-1 ring-1 ring-esk-track">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cx('h-[40px] rounded-[16px] font-sat text-[14px] font-medium transition', tab === t.id ? 'bg-esk-lime text-esk-ink' : 'text-esk-muted hover:text-white')}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Período */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <button type="button" aria-label="Período anterior" onClick={() => setAnchor((m) => shiftMonth(m, -effectiveSpan))} className="grid size-[38px] place-items-center rounded-full bg-esk-elevated text-white transition hover:bg-esk-hover">
                <ChevronLeft size={18} />
              </button>
              <p className={cx('font-sat text-[17px] font-medium', future ? 'text-esk-muted' : 'text-white')}>
                {periodLabel(months)}
                {future && <span className="ml-2 rounded-[6px] bg-white/[0.06] px-[6px] py-px text-[11px] text-esk-muted">previsto</span>}
              </p>
              <button type="button" aria-label="Próximo período" onClick={() => setAnchor((m) => shiftMonth(m, effectiveSpan))} className="grid size-[38px] place-items-center rounded-full bg-esk-elevated text-white transition hover:bg-esk-hover">
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {SPANS.filter((s) => tab !== 'mes' || s.id >= 6).map((s) => (
                <Chip key={s.id} active={effectiveSpan === s.id} onClick={() => setSpan(s.id)}>
                  {s.label}
                </Chip>
              ))}
              {anchor !== currentMonth() && (
                <Chip active={false} dashed onClick={() => setAnchor(currentMonth())}>
                  Voltar para hoje
                </Chip>
              )}
            </div>
            {sources.length > 1 && (
              <div className="-mx-[26px] flex gap-2 overflow-x-auto px-[26px] pb-1 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden" role="group" aria-label="Filtrar por cartão ou conta">
                {sources.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={source === s.id}
                    onClick={() => setSource(s.id)}
                    className={cx(
                      'h-[32px] shrink-0 rounded-[16px] px-3 font-sat text-[13px] whitespace-nowrap transition',
                      source === s.id ? 'bg-white text-esk-ink' : 'bg-esk-elevated text-esk-muted ring-1 ring-esk-track hover:text-white',
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {tab === 'categorias' && <CategoryReport groups={byCategory(expenses)} total={total} hidden={hidden} onOpen={openGroup} />}
          {tab === 'onde' && (
            <PayeeReport
              groups={byPayee(catFilter === undefined ? expenses : expenses.filter((t) => t.category === catFilter))}
              hidden={hidden}
              catFilter={catFilter}
              onClearFilter={() => setCatFilter(undefined)}
              onOpen={openGroup}
            />
          )}
          {tab === 'mes' && <MonthReport months={months} source={source} hidden={hidden} />}
        </div>
      </Page>
    </div>
  )
}

/* ---------------------------------------------------------- Categorias */

function CategoryReport({
  groups,
  total,
  hidden,
  onOpen,
}: {
  groups: Group[]
  total: number
  hidden: boolean
  onOpen: (g: Group, sub: string, category?: CategoryId | null) => void
}) {
  const { state } = useStore()
  if (!groups.length) return <EmptyState title="Nenhum gasto neste período" text="Os gastos que você registrar aparecem aqui, separados por categoria." />
  const meta = (g: Group) => (g.key === '__rest' ? { label: g.label, color: REST_COLOR } : g.category === null ? UNCATEGORIZED : categoryMeta(state, g.category))
  const named = groups.map((g) => ({ ...g, label: meta(g).label }))
  const { shown, rest } = topWithRest(named, MAX_SLICES)
  const slices: Slice[] = [...shown, ...(rest ? [rest] : [])].map((g) => ({
    key: g.key,
    value: g.amount,
    color: meta(g).color,
    hatched: g.category === null && g.key !== '__rest',
    label: `${g.label}: ${brl(g.amount)}`,
  }))
  const find = (key: string) => [...named, ...(rest ? [rest] : [])].find((g) => g.key === key)

  return (
    <div className="flex flex-col gap-5 md:flex-row md:items-start md:gap-8">
      <div className="flex justify-center md:sticky md:top-8">
        <Donut
          slices={slices}
          label="Gastos por categoria"
          onSelect={(key) => {
            const g = find(key)
            if (g) onOpen(g, sub(g, total, hidden), g.key === '__rest' ? undefined : g.category)
          }}
          center={
            <div className="flex flex-col items-center">
              <span className="font-sat text-[12px] text-esk-muted">Total gasto</span>
              <span className="font-sat text-[24px] font-medium tracking-[-0.8px] text-white">{privateMoney(brlShort(total), hidden)}</span>
              <span className="font-sat text-[11px] text-esk-subtle">{plural(groups.length, 'categoria', 'categorias')}</span>
            </div>
          }
        />
      </div>
      <ul className="flex flex-1 flex-col">
        {named.map((g, i) => (
          <li key={g.key} className="animate-rise" style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }}>
            {i > 0 && <div className="h-px bg-esk-border" />}
            <button type="button" onClick={() => onOpen(g, sub(g, total, hidden), g.category)} className="-mx-2 flex w-[calc(100%+16px)] items-center gap-3 rounded-[16px] px-2 py-3 text-left transition hover:bg-white/[0.03]">
              <span
                className="size-[12px] shrink-0 rounded-full"
                style={{
                  backgroundColor: meta(g).color,
                  backgroundImage: g.category === null ? 'repeating-linear-gradient(135deg, rgba(0,0,0,0.35) 0 2px, transparent 2px 4px)' : undefined,
                }}
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-sat text-[15px] font-medium text-white">{g.label}</span>
                <span className="font-sat text-[12px] text-esk-subtle">{plural(g.count, 'lançamento', 'lançamentos')}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end">
                <span className="font-sat text-[15px] font-medium text-white">{privateMoney(brl(g.amount), hidden)}</span>
                <span className="font-sat text-[12px] text-esk-subtle">{pct(g.amount, total)}%</span>
              </span>
              <ChevronRight size={15} className="shrink-0 text-esk-subtle" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

const sub = (g: Group, total: number, hidden: boolean) =>
  `${privateMoney(brl(g.amount), hidden)} · ${pct(g.amount, total)}% do período · ${plural(g.count, 'lançamento', 'lançamentos')}`

/* ---------------------------------------------------------------- Onde */

function PayeeReport({
  groups,
  hidden,
  catFilter,
  onClearFilter,
  onOpen,
}: {
  groups: Group[]
  hidden: boolean
  catFilter: CategoryId | null | undefined
  onClearFilter: () => void
  onOpen: (g: Group, sub: string) => void
}) {
  const { state } = useStore()
  const total = groups.reduce((s, g) => s + g.amount, 0)
  const { shown, rest } = topWithRest(groups, MAX_PAYEES)
  const rows = [...shown, ...(rest ? [rest] : [])]
  const max = rows[0]?.amount ?? 0
  const filterLabel = catFilter === undefined ? null : catFilter === null ? 'Sem categoria' : categoryMeta(state, catFilter).label

  return (
    <div className="flex flex-col gap-3">
      {filterLabel && (
        <button type="button" onClick={onClearFilter} className="flex items-center gap-2 self-start rounded-full bg-esk-elevated px-3 py-[6px] font-sat text-[13px] text-white ring-1 ring-esk-track hover:bg-esk-hover">
          Só {filterLabel} <X size={14} aria-label="Ver todas as categorias" />
        </button>
      )}
      {!rows.length ? (
        <EmptyState title="Nenhum gasto neste período" text="Aqui você vê onde gastou mais: lojas, apps e serviços." />
      ) : (
        <>
          <p className="font-sat text-[13px] text-esk-muted">
            {plural(groups.length, 'lugar', 'lugares')} · {privateMoney(brl(total), hidden)}
          </p>
          <div className="flex flex-col">
            {rows.map((g, i) => {
              const color = g.key === '__rest' ? REST_COLOR : g.category === null ? UNCATEGORIZED.color : categoryMeta(state, g.category).color
              const s = `${plural(g.count, 'compra', 'compras')} · ${pct(g.amount, total)}%${g.key !== '__rest' && g.category ? ` · ${categoryMeta(state, g.category).label}` : ''}`
              return (
                <BarRow
                  key={g.key}
                  index={i}
                  label={g.label}
                  value={g.amount}
                  max={max}
                  color={color}
                  hatched={g.key !== '__rest' && g.category === null}
                  right={privateMoney(brl(g.amount), hidden)}
                  sub={s}
                  onClick={() => onOpen(g, `${privateMoney(brl(g.amount), hidden)} · ${s}`)}
                />
              )
            })}
          </div>
          <p className="font-sat text-[12px] text-esk-subtle">Nomes escritos de jeitos diferentes ("Sonda" e "SONDA ") contam como o mesmo lugar.</p>
        </>
      )}
    </div>
  )
}

/* ----------------------------------------------------------- Mês a mês */

function MonthReport({ months, source, hidden }: { months: string[]; source: SourceFilter; hidden: boolean }) {
  const { state } = useStore()
  const { openSheet } = useUI()
  const rows = useMemo(() => monthly(state, months, source), [state, months, source])
  const income = rows.reduce((s, r) => s + r.income, 0)
  const expense = rows.reduce((s, r) => s + r.expense, 0)
  const net = income - expense
  const [selected, setSelected] = useState<string | undefined>(undefined)
  const empty = income === 0 && expense === 0

  if (empty) return <EmptyState title="Nada neste período" text="Registre receitas e gastos para ver se está sobrando ou faltando dinheiro a cada mês." />

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Entrou', value: income, cls: 'text-esk-positive' },
          { label: 'Saiu', value: expense, cls: 'text-esk-negative' },
          { label: net >= 0 ? 'Sobrou' : 'Faltou', value: Math.abs(net), cls: net >= 0 ? 'text-esk-lime' : 'text-esk-negative' },
        ].map((c) => (
          <div key={c.label} className="flex flex-col gap-1 rounded-[20px] bg-esk-surface px-3 py-3">
            <span className="font-sat text-[12px] text-esk-muted">{c.label}</span>
            <span className={cx('truncate font-sat text-[16px] font-medium tracking-[-0.4px]', c.cls)}>{privateMoney(brlShort(Math.round(c.value)), hidden)}</span>
          </div>
        ))}
      </div>

      <div className="rounded-[24px] bg-esk-surface px-3 pt-3 pb-2">
        <MonthBars rows={rows} labelOf={monthShort} selected={selected} onPick={(k) => setSelected((s) => (s === k ? undefined : k))} />
        <div className="flex items-center justify-center gap-4 pt-1 pb-1 font-sat text-[12px] text-esk-muted">
          <span className="flex items-center gap-[6px]"><span className="size-[10px] rounded-[3px] bg-esk-positive" /> Entrou</span>
          <span className="flex items-center gap-[6px]"><span className="size-[10px] rounded-[3px] bg-esk-negative" /> Saiu</span>
        </div>
      </div>

      <ul className="flex flex-col">
        {[...rows].reverse().map((r, i) => (
          <li key={r.key}>
            {i > 0 && <div className="h-px bg-esk-border" />}
            <button
              type="button"
              onClick={() =>
                openSheet({
                  type: 'reportDetail',
                  title: `${monthLong(r.key)} ${r.key.slice(0, 4)}`,
                  subtitle: `Entrou ${privateMoney(brl(r.income), hidden)} · Saiu ${privateMoney(brl(r.expense), hidden)}`,
                  ids: [...r.incomeIds, ...r.expenseIds],
                })
              }
              className={cx('-mx-2 grid w-[calc(100%+16px)] grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-[16px] px-2 py-3 text-left transition hover:bg-white/[0.03]', selected === r.key && 'bg-white/[0.04]')}
            >
              <span className="font-sat text-[15px] font-medium text-white">
                {monthLong(r.key)}
                {r.key > currentMonth() && <span className="ml-2 text-[11px] text-esk-muted">previsto</span>}
              </span>
              <span className="flex flex-col items-end font-sat text-[12px]">
                <span className="text-esk-positive">+ {privateMoney(brlShort(r.income), hidden)}</span>
                <span className="text-esk-negative">− {privateMoney(brlShort(r.expense), hidden)}</span>
              </span>
              <span className={cx('min-w-[88px] text-right font-sat text-[15px] font-medium', r.net >= 0 ? 'text-esk-lime' : 'text-esk-negative')}>
                {r.net >= 0 ? '+' : '−'} {privateMoney(brlShort(Math.abs(r.net)), hidden)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="font-sat text-[12px] text-esk-subtle">Gastos no cartão contam no mês da compra (cada parcela no mês dela). Pagamentos de fatura não entram aqui.</p>
    </div>
  )
}
