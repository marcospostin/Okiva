import { ArrowUpRight, Bell, BellOff, ChevronRight, Plus } from 'lucide-react'
import { useMemo } from 'react'
import { categoryMeta } from '../data/categories'
import { Asset, GoalIcon } from '../components/icons'
import { ActionRow, CountUp, cx, EmptyState, FeatureCard, Kicker, PrimaryButton, ListPanel, ListRow, Page, ProgressBar, RoundButton, Ring, ScreenHeader, SectionHeader } from '../components/ui'
import { brl, brlShort, deadlineLabel, pct, privateMoney } from '../lib/format'
import { getInsight } from '../services/ai'
import { capAlert, currentMonth, daysLeftInMonth, goalPace, monthSummary, useStore } from '../state/store'
import { useUI } from '../state/ui'
import type { CategoryId, Goal } from '../types'

function paceText(goal: Goal, hidden: boolean) {
  const { average, monthsLeft } = goalPace(goal)
  if (monthsLeft === 0) return 'Meta atingida. Parabéns!'
  if (monthsLeft === null) return 'Faça seu primeiro depósito para calcularmos sua média mensal e a previsão da meta.'
  const avg = privateMoney(brl(average), hidden)
  return `Média de ${avg}/mês. Nesse ritmo, você atinge sua meta em ${monthsLeft} ${monthsLeft === 1 ? 'mês' : 'meses'}.`
}

export default function Goals() {
  const { state } = useStore()
  const { openSheet, navigate } = useUI()
  const summary = useMemo(() => monthSummary(state, currentMonth()), [state])
  const left = state.budget.total - summary.total
  const featured = state.goals.find((g) => g.id === state.featuredGoalId) ?? state.goals[0]
  const others = state.goals.filter((g) => g.id !== featured?.id)
  const spentBy = (c: CategoryId) => summary.byCategory.find((x) => x.category === c)?.amount ?? 0
  const caps = Object.entries(state.budget.caps) as [CategoryId, number][]
  // Insight needs real data to talk about; an empty account gets none
  const insight = state.stage === 2 && state.transactions.length > 0 ? getInsight(state) : null
  const hasBudget = state.budget.total > 0
  const hidden = state.hideBalance

  return (
    <div className="min-h-[calc(100dvh-var(--tabbar-space,0px))] bg-esk-bg-2">
      <Page>
        <ScreenHeader
          title="Metas"
          action={
            <RoundButton label="Nova meta" onClick={() => openSheet({ type: 'goal' })}>
              <Asset name="5e25d.svg" size={19} />
            </RoundButton>
          }
        />

        <div className="grid gap-x-12 md:grid-cols-2 md:pt-4 lg:gap-x-16">
          {/* This month: budget */}
          <section aria-label="Este mês" className="flex flex-col gap-[18px] pt-6">
            <SectionHeader title="Este mês" action={<span className="font-sat text-[13px] text-esk-subtle">Faltam {daysLeftInMonth()} dias</span>} />
            <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => openSheet({ type: 'budget' })}
              className="flex flex-col gap-4 rounded-[34px] bg-esk-surface p-6 text-left transition hover:bg-[#19191c] md:p-8"
            >
              {hasBudget ? (
              <>
              <div>
                <p className="font-sat text-[15px] font-medium text-esk-muted">{left >= 0 ? 'Ainda pode gastar' : 'Acima do teto'}</p>
                <p className="flex flex-wrap items-baseline gap-x-2 pt-[6px]">
                  <span className={cx('font-sat text-[38px] leading-[38px] font-medium tracking-[-1.71px]', left >= 0 ? 'text-esk-lime' : 'text-white')}>
                    {privateMoney(brlShort(Math.abs(left)), hidden)}
                  </span>
                  <span className="font-sat text-[15px] text-esk-muted">de {privateMoney(brlShort(state.budget.total), hidden)}</span>
                </p>
              </div>
              <ProgressBar value={pct(summary.total, state.budget.total)} />
              </>
              ) : (
                <div>
                  <p className="font-sat text-[21px] leading-[1.2] font-medium tracking-[-0.42px] text-white">Defina seu limite de gasto do mês</p>
                  <p className="pt-2 font-sat text-[14px] text-esk-muted">
                    Você gastou {privateMoney(brlShort(summary.total), hidden)} até agora. Toque para escolher um teto.
                  </p>
                </div>
              )}
            </button>

            <div className="grid grid-cols-2 gap-3">
              {caps.map(([cat, cap]) => {
                const spent = spentBy(cat)
                const p = pct(spent, cap)
                const meta = categoryMeta(state, cat)
                const alert = capAlert(state, cat)
                const near = alert.enabled && p >= alert.percent
                return (
                  <div key={cat} className="relative">
                  <button
                    type="button"
                    onClick={() => openSheet({ type: 'budget', category: cat })}
                    className="flex w-full flex-col gap-3 rounded-[26px] bg-esk-elevated p-4 text-left transition hover:bg-esk-hover active:scale-[0.98] md:p-5"
                  >
                    <div className="flex items-center gap-2 pr-9">
                      <span className="size-[10px] shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
                      <span className="truncate font-sat text-[14px] font-medium text-white">{meta.label}</span>
                    </div>
                    <p className="font-sat text-[28px] leading-none font-medium tracking-[-1px] text-white">{p}%</p>
                    <div className="h-[4px] w-full overflow-hidden rounded-[2px] bg-esk-track">
                      <div
                        className="h-full rounded-[2px] transition-[width] duration-700"
                        style={{ width: `${Math.min(100, p)}%`, backgroundColor: p >= 100 ? '#ffffff' : meta.color }}
                      />
                    </div>
                    <span className="font-sat text-[12px] text-esk-subtle">
                      {privateMoney(brlShort(spent), hidden)} de {privateMoney(brlShort(cap), hidden)}
                    </span>
                  </button>
                  {/* Aviso por categoria: liga/desliga e porcentagem */}
                  <button
                    type="button"
                    onClick={() => openSheet({ type: 'capAlert', category: cat })}
                    aria-label={alert.enabled ? `Aviso de ${meta.label} em ${alert.percent}%` : `Aviso de ${meta.label} desligado`}
                    title={alert.enabled ? `Aviso em ${alert.percent}%` : 'Aviso desligado'}
                    className={cx(
                      'absolute top-3 right-3 grid size-[32px] place-items-center rounded-full transition hover:bg-white/[0.08] md:top-4 md:right-4',
                      near ? 'bg-esk-lilac/15 text-esk-lilac' : alert.enabled ? 'text-esk-text-2' : 'text-esk-subtle',
                    )}
                  >
                    {alert.enabled ? <Bell size={15} strokeWidth={1.8} /> : <BellOff size={15} strokeWidth={1.8} />}
                  </button>
                  </div>
                )
              })}
              <button
                type="button"
                onClick={() => openSheet({ type: 'cap' })}
                className="flex min-h-[132px] flex-col items-start justify-between gap-3 rounded-[26px] border border-dashed border-esk-track p-4 text-left transition hover:border-esk-subtle md:p-5"
              >
                <span className="grid size-[32px] place-items-center rounded-full bg-esk-elevated text-esk-lime">
                  <Plus size={17} strokeWidth={1.8} />
                </span>
                <span className="font-sat text-[14px] font-medium text-white">Teto por categoria</span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => openSheet({ type: 'categories' })}
              className="flex items-center justify-between gap-3 rounded-[22px] bg-esk-elevated px-5 py-4 text-left transition hover:bg-esk-hover"
            >
              <span className="flex flex-col">
                <span className="font-sat text-[15px] font-medium text-white">Categorias</span>
                <span className="font-sat text-[12px] text-esk-subtle">Criar, renomear, trocar a cor ou excluir · {state.customCategories.length}</span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-esk-subtle" aria-hidden />
            </button>
            </div>
          </section>

          {/* Saving for */}
          <section aria-label="Guardando" className="flex flex-col pt-10 md:pt-6">
            {featured ? (
              <div className="flex flex-col gap-[18px]">
                <SectionHeader title="Meta principal" />
                <div>
                <button type="button" onClick={() => openSheet({ type: 'save', goalId: featured.id })} className="w-full text-left transition active:scale-[0.99]">
                  <FeatureCard>
                    <div className="flex items-center justify-between font-sat text-[15px] font-medium">
                      <span>{featured.name}</span>
                      <span>{deadlineLabel(featured.deadline) ?? `Meta ${privateMoney(brlShort(featured.target), hidden)}`}</span>
                    </div>
                    <div className="flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-sat text-[15px] font-medium">Já guardado</p>
                        <p className="pt-[6px] font-sat text-[38px] leading-[38px] font-medium tracking-[-1.71px] whitespace-nowrap">
                          <CountUp value={featured.saved} format={(n) => privateMoney(brlShort(Math.round(n)), hidden)} />
                        </p>
                      </div>
                      <Ring value={pct(featured.saved, featured.target)} />
                    </div>
                    <p className="border-t border-esk-ink/15 pt-3 font-sat text-[13px] leading-[1.4] font-medium">{paceText(featured, hidden)}</p>
                  </FeatureCard>
                </button>
                <div className="pt-3">
                  <ActionRow
                    icon={<Asset name="b24c9.svg" size={24} />}
                    label="Guardar dinheiro"
                    onClick={() => openSheet({ type: 'save', goalId: featured.id })}
                  />
                </div>
                </div>
              </div>
            ) : (
              <EmptyState
                title="Nenhuma meta ainda"
                text="Viagem, reserva, curso… Crie uma meta e guarde um pouco por mês."
                action={
                  <PrimaryButton className="mt-2 max-w-[240px]" onClick={() => openSheet({ type: 'goal' })}>
                    Criar primeira meta
                  </PrimaryButton>
                }
              />
            )}

            {others.length > 0 && (
              <div className="flex flex-col gap-3 pt-8">
                {/* Subordinate to "Meta principal": body-lg role, not heading-section */}
                <h3 className="font-sat text-[17px] font-medium text-esk-muted">Demais metas</h3>
                <ListPanel>
                  {others.map((g, i) => (
                    <ListRow
                      key={g.id}
                      index={i}
                      onClick={() => openSheet({ type: 'save', goalId: g.id })}
                      icon={<GoalIcon icon={g.icon} />}
                      title={g.name}
                      subtitle={`${privateMoney(brlShort(g.saved), hidden)} de ${privateMoney(brlShort(g.target), hidden)}`}
                      value={`${pct(g.saved, g.target)}%`}
                      note={paceText(g, hidden)}
                    />
                  ))}
                </ListPanel>
              </div>
            )}

            {featured && (
              <button
                type="button"
                onClick={() => openSheet({ type: 'goal' })}
                className="mt-4 flex items-center gap-3 rounded-[24px] border border-dashed border-esk-track px-5 py-4 text-left transition hover:border-esk-subtle active:scale-[0.99]"
              >
                <span className="grid size-[36px] shrink-0 place-items-center rounded-full bg-esk-elevated text-esk-lime">
                  <Plus size={18} strokeWidth={1.8} />
                </span>
                <span className="flex flex-col">
                  <span className="font-sat text-[15px] font-medium text-white">Nova meta</span>
                  <span className="font-sat text-[12px] text-esk-subtle">Viagem, reserva, curso…</span>
                </span>
              </button>
            )}
          </section>

          {/* Stage 1: the assistant is one tap away, behind the Okiva Plus explanation */}
          {state.stage === 1 && (
            <button
              type="button"
              onClick={() => openSheet({ type: 'plus', then: 'assistant' })}
              className="group mt-10 flex animate-rise items-center justify-between gap-4 rounded-[30px] border border-dashed border-esk-lilac/50 p-[22px] text-left transition hover:border-esk-lilac active:scale-[0.99] md:col-span-2 md:p-8"
            >
              <span className="flex flex-col gap-1">
                <Kicker className="text-esk-lilac">Assistente Okiva · Plus</Kicker>
                <span className="font-sat text-[17px] font-medium text-white">Descubra onde economizar para chegar antes nas suas metas.</span>
              </span>
              <ArrowUpRight size={20} className="shrink-0 text-esk-lilac transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
          )}

          {/* Stage 2: AI insight opens the assistant */}
          {insight && (
            <button
              type="button"
              onClick={() => navigate('assistant')}
              className="group mt-10 flex animate-rise flex-col gap-3 rounded-[30px] bg-esk-lilac p-[22px] text-left text-esk-ink transition hover:brightness-[0.98] active:scale-[0.99] md:col-span-2 md:flex-row md:items-end md:justify-between md:p-8"
            >
              <div className="flex flex-col gap-2">
                <Kicker>Assistente Okiva</Kicker>
                <p className="font-sat text-[15px] font-medium">{insight.lead}</p>
                <p className="font-sat text-[38px] leading-[38px] font-medium tracking-[-1.71px]">{privateMoney(insight.value, hidden)}</p>
                <p className="font-sat text-[13px] leading-[1.4] font-medium">{insight.consequence}</p>
              </div>
              <span className="flex items-center gap-1 self-start rounded-full bg-esk-ink px-4 py-[10px] font-sat text-[14px] font-medium text-esk-lime md:self-end">
                Perguntar ao assistente
                <ArrowUpRight size={16} className="transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </button>
          )}
        </div>
      </Page>
    </div>
  )
}
