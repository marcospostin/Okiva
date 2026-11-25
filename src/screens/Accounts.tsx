import { useState } from 'react'
import { ArrowDownLeft, ArrowLeftRight, ChevronRight, CreditCard, Landmark, PiggyBank, Plus, Repeat, Scale, Wallet } from 'lucide-react'
import { categoryMeta } from '../data/categories'
import { CategoryRowIcon } from '../components/icons'
import { cx, EmptyState, ListPanel, ListRow, Page, PrimaryButton, RoundButton, ScreenHeader, SearchField, SearchSummary, SectionHeader } from '../components/ui'
import { brl, longDate, privateExpense, privateIncome, privateMoney, shortDate } from '../lib/format'
import { accountKindLabel, incomeLabel, kindOf, nextDate } from '../lib/ledger'
import { movementAmount, movementSubtitle } from '../lib/movements'
import { searchTransactions } from '../lib/search'
import { accountBalance, accountLabel, accountTotal, accountTransactions, balanceOf, subaccounts, todayISO, topAccounts, useStore } from '../state/store'
import { useUI } from '../state/ui'
import type { Account, AppState, Transaction } from '../types'

const KIND_ICON = { checking: Landmark, savings: PiggyBank, wallet: Wallet } as const

function AccountIcon({ kind }: { kind: Account['kind'] }) {
  const Icon = KIND_ICON[kind] ?? Landmark
  return <Icon size={20} strokeWidth={1.6} className="text-esk-text-2" aria-hidden />
}

function TxIcon({ t }: { t: Transaction }) {
  const k = kindOf(t)
  if (k === 'income') return <ArrowDownLeft size={20} strokeWidth={1.7} className="text-esk-lime" aria-hidden />
  if (k === 'invoice_payment') return <CreditCard size={19} strokeWidth={1.6} className="text-esk-text-2" aria-hidden />
  if (k === 'transfer') return <ArrowLeftRight size={19} strokeWidth={1.6} className="text-esk-text-2" aria-hidden />
  if (k === 'adjustment') return <Scale size={19} strokeWidth={1.6} className="text-esk-text-2" aria-hidden />
  return <CategoryRowIcon category={t.category} name={t.name} size={20} />
}

/** Conta principal (a que aparece no cartão da lista) */
const mainOf = (state: AppState, a: Account) => (a.parentId ? (state.accounts.find((x) => x.id === a.parentId) ?? a) : a)

export default function Accounts() {
  const { state } = useStore()
  const { openSheet } = useUI()
  const hidden = state.hideBalance
  // Conta aberta (principal ou subconta): o extrato só aparece ao tocar
  const [openId, setOpenId] = useState<string | null>(null)
  const open = openId ? state.accounts.find((a) => a.id === openId) : undefined
  if (open) return <AccountDetail key={open.id} account={open} onBack={() => setOpenId(open.parentId ?? null)} onOpen={setOpenId} />

  const tops = topAccounts(state)
  const today = todayISO()

  return (
    <div className="min-h-[calc(100dvh-var(--tabbar-space,0px))] bg-esk-bg-2">
      <Page>
        <ScreenHeader
          title="Contas"
          action={
            <RoundButton label="Nova conta" onClick={() => openSheet({ type: 'bankAccount' })}>
              <Plus size={19} strokeWidth={1.6} />
            </RoundButton>
          }
        />

        <div className="grid gap-x-12 md:grid-cols-2 md:pt-4 lg:gap-x-16">
          <section aria-label="Suas contas" className="flex flex-col gap-[18px] pt-6">
            <div className="rounded-[34px] bg-esk-surface p-6 md:p-8">
              <p className="font-sat text-[15px] font-medium text-esk-muted">Saldo total</p>
              <p className="pt-[6px] font-sat text-[38px] leading-[44px] font-medium tracking-[-1.71px] text-white">{privateMoney(brl(balanceOf(state)), hidden)}</p>
              <p className="pt-2 font-sat text-[13px] text-esk-subtle">Soma de todas as contas e subcontas. Gastos no cartão saem daqui quando você paga a fatura.</p>
              {state.accounts.length > 1 && (
                <div className="pt-4">
                  <PrimaryButton tone="dark" onClick={() => openSheet({ type: 'transfer' })}>
                    <span className="flex items-center justify-center gap-2">
                      <ArrowLeftRight size={17} aria-hidden /> Mover dinheiro
                    </span>
                  </PrimaryButton>
                </div>
              )}
            </div>

            {tops.map((a, i) => {
              const subs = subaccounts(state, a.id)
              return (
                <div key={a.id} className="animate-rise overflow-hidden rounded-[28px] bg-esk-surface ring-1 ring-esk-track" style={{ animationDelay: `${Math.min(i, 6) * 50}ms` }}>
                  <button type="button" onClick={() => setOpenId(a.id)} className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-white/[0.02]">
                    <span className="grid size-[44px] shrink-0 place-items-center rounded-full bg-esk-row">
                      <AccountIcon kind={a.kind} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-sat text-[17px] font-medium text-white">{a.name}</span>
                      <span className="font-sat text-[12px] text-esk-subtle">
                        {accountKindLabel(a.kind)}
                        {subs.length > 0 && ` · ${subs.length} ${subs.length === 1 ? 'subconta' : 'subcontas'}`}
                      </span>
                    </span>
                    <span className="shrink-0 font-sat text-[17px] font-medium text-white">{privateMoney(brl(accountTotal(state, a.id)), hidden)}</span>
                    <ChevronRight size={16} className="shrink-0 text-esk-subtle" aria-hidden />
                  </button>
                  {subs.length > 0 && (
                    <ul className="flex flex-col border-t border-esk-border px-5 pb-2">
                      {[a, ...subs].map((x) => (
                        <li key={x.id}>
                          <button
                            type="button"
                            onClick={() => setOpenId(x.id)}
                            className="flex w-full items-center gap-3 py-[10px] text-left font-sat text-[14px] transition hover:opacity-80"
                          >
                            <span className={cx('size-[6px] shrink-0 rounded-full', x.parentId ? 'bg-esk-lilac' : 'bg-esk-lime')} aria-hidden />
                            <span className="min-w-0 flex-1 truncate text-esk-text-2">{x.parentId ? x.name : accountKindLabel(x.kind)}</span>
                            <span className="shrink-0 text-white">{privateMoney(brl(accountBalance(state, x.id)), hidden)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}

            <button
              type="button"
              onClick={() => openSheet({ type: 'bankAccount' })}
              className="flex items-center gap-3 rounded-[24px] border border-dashed border-esk-track px-5 py-4 text-left transition hover:border-esk-subtle active:scale-[0.99]"
            >
              <span className="grid size-[36px] shrink-0 place-items-center rounded-full bg-esk-elevated text-esk-lime">
                <Plus size={18} strokeWidth={1.8} />
              </span>
              <span className="flex flex-col">
                <span className="font-sat text-[15px] font-medium text-white">Nova conta</span>
                <span className="font-sat text-[12px] text-esk-subtle">Banco ou carteira. Poupança e caixinhas ficam dentro da conta.</span>
              </span>
            </button>
          </section>

          <section aria-label="Recorrentes" className="flex flex-col gap-3 pt-10 md:pt-6">
            <SectionHeader title="Recorrentes" />
            {state.recurrences.length === 0 ? (
              <EmptyState title="Nada recorrente ainda" text='Ao adicionar um gasto ou receita, marque "Repetir todo mês" (salário, aluguel, assinaturas).' />
            ) : (
              <ListPanel>
                {state.recurrences.map((r, i) => {
                  const next = nextDate(r, today)
                  const ended = !!r.endDate && r.endDate < today
                  return (
                    <ListRow
                      key={r.id}
                      index={i}
                      onClick={() => openSheet({ type: 'recurrence', id: r.id })}
                      icon={<Repeat size={19} strokeWidth={1.6} className={r.kind === 'income' ? 'text-esk-lime' : 'text-esk-text-2'} aria-hidden />}
                      title={r.name}
                      subtitle={`Todo dia ${r.day} · ${ended ? `encerrada em ${longDate(r.endDate!)}` : next ? `próxima ${shortDate(next)}` : 'sem próximas'}`}
                      value={
                        <span className={cx(r.kind === 'income' ? 'text-esk-positive' : 'text-esk-negative', ended && 'opacity-50')}>
                          {r.kind === 'income' ? privateIncome(r.amount, hidden) : privateExpense(r.amount, hidden)}
                        </span>
                      }
                    />
                  )
                })}
              </ListPanel>
            )}
          </section>
        </div>
      </Page>
    </div>
  )
}

/* ------------------------------------------------------------ tela da conta */

function AccountDetail({ account, onBack, onOpen }: { account: Account; onBack: () => void; onOpen: (id: string) => void }) {
  const { state } = useStore()
  const { openSheet } = useUI()
  const hidden = state.hideBalance
  const today = todayISO()
  const isSub = !!account.parentId
  const main = mainOf(state, account)
  const subs = isSub ? [] : subaccounts(state, account.id)
  const own = accountBalance(state, account.id)
  const total = isSub ? own : accountTotal(state, account.id)
  const allMovements = accountTransactions(state, account.id).filter((t) => t.date <= today)
  const [query, setQuery] = useState('')
  const searching = query.trim().length > 0
  const movements = searchTransactions(state, allMovements, query)
  const [showAll, setShowAll] = useState(false)
  const limit = searching ? 20 : 12
  const shown = showAll ? movements : movements.slice(0, limit)

  const subtitle = (t: Transaction) => {
    const k = kindOf(t)
    if (k === 'transfer' || k === 'adjustment') return `${movementSubtitle(state, t)} · ${shortDate(t.date)}`
    if (k === 'income') return `${incomeLabel(t.category)} · ${shortDate(t.date)}`
    if (k === 'invoice_payment') return `Pagamento de fatura · ${shortDate(t.date)}`
    return `${categoryMeta(state, t.category).label} · ${t.method.type === 'pix' ? 'Pix' : 'Dinheiro'} · ${shortDate(t.date)}`
  }
  const value = (t: Transaction) => {
    const k = kindOf(t)
    if (k === 'transfer' || k === 'adjustment') return <span className="text-esk-text-2">{movementAmount(t, hidden, account.id)}</span>
    return (
      <span className={k === 'income' ? 'text-esk-positive' : 'text-esk-negative'}>
        {k === 'income' ? privateIncome(t.amount, hidden) : privateExpense(t.amount, hidden)}
      </span>
    )
  }

  return (
    <div className="min-h-[calc(100dvh-var(--tabbar-space,0px))] bg-esk-bg-2">
      <Page>
        <ScreenHeader
          title={account.name}
          onBack={onBack}
          action={
            <button
              type="button"
              onClick={() => openSheet({ type: 'bankAccount', id: account.id })}
              className="h-[44px] shrink-0 rounded-full bg-esk-elevated px-4 font-sat text-[14px] font-medium text-white ring-1 ring-esk-track transition hover:bg-esk-hover"
            >
              Editar
            </button>
          }
        />

        <div className="grid gap-x-12 md:grid-cols-2 md:pt-4 lg:gap-x-16">
          <section aria-label="Saldo" className="flex flex-col gap-[18px] pt-6">
            <div className="rounded-[34px] bg-esk-surface p-6 md:p-8">
              <p className="font-sat text-[15px] font-medium text-esk-muted">{isSub ? `Subconta de ${main.name}` : subs.length ? 'Total com subcontas' : accountKindLabel(account.kind)}</p>
              <p className="pt-[6px] font-sat text-[38px] leading-[44px] font-medium tracking-[-1.71px] text-white">{privateMoney(brl(total), hidden)}</p>
              <p className="pt-2 font-sat text-[13px] text-esk-subtle">
                {account.reconciledOn ? `Conferido com o banco em ${longDate(account.reconciledOn)}` : 'Ainda não conferido com o banco'}
              </p>
              <div className="grid grid-cols-2 gap-3 pt-5">
                <PrimaryButton tone="dark" onClick={() => openSheet({ type: 'transfer', from: account.id })} disabled={state.accounts.length < 2}>
                  <span className="flex items-center justify-center gap-2">
                    <ArrowLeftRight size={16} aria-hidden /> Mover
                  </span>
                </PrimaryButton>
                <PrimaryButton tone="dark" onClick={() => openSheet({ type: 'reconcile', accountId: account.id })}>
                  <span className="flex items-center justify-center gap-2">
                    <Scale size={16} aria-hidden /> Conferir
                  </span>
                </PrimaryButton>
              </div>
            </div>

            {!isSub && (
              <div className="flex flex-col gap-3">
                <SectionHeader title="Subcontas" />
                {subs.length > 0 && (
                  <ListPanel>
                    {[account, ...subs].map((x, i) => (
                      <ListRow
                        key={x.id}
                        index={i}
                        onClick={x.id === account.id ? undefined : () => onOpen(x.id)}
                        icon={x.parentId ? <PiggyBank size={19} strokeWidth={1.6} className="text-esk-text-2" aria-hidden /> : <AccountIcon kind={x.kind} />}
                        title={x.parentId ? x.name : accountKindLabel(x.kind)}
                        subtitle={x.parentId ? (x.reconciledOn ? `Conferida em ${shortDate(x.reconciledOn)}` : 'Subconta') : 'Saldo da conta, sem as subcontas'}
                        value={privateMoney(brl(x.id === account.id ? own : accountBalance(state, x.id)), hidden)}
                      />
                    ))}
                  </ListPanel>
                )}
                <button
                  type="button"
                  onClick={() => openSheet({ type: 'bankAccount', parentId: account.id })}
                  className="flex items-center gap-3 rounded-[24px] border border-dashed border-esk-track px-5 py-4 text-left transition hover:border-esk-subtle active:scale-[0.99]"
                >
                  <span className="grid size-[36px] shrink-0 place-items-center rounded-full bg-esk-elevated text-esk-lime">
                    <Plus size={18} strokeWidth={1.8} />
                  </span>
                  <span className="flex flex-col">
                    <span className="font-sat text-[15px] font-medium text-white">Nova subconta</span>
                    <span className="font-sat text-[12px] text-esk-subtle">Poupança, caixinha, reserva… com o nome que o banco usa</span>
                  </span>
                </button>
              </div>
            )}
          </section>

          <section aria-label="Extrato" className="flex flex-col gap-[18px] pt-10 md:pt-6">
            <SectionHeader title={isSub ? 'Extrato' : 'Extrato da conta'} />
            {allMovements.length > 0 && (
              <div className="flex flex-col gap-2">
                <SearchField
                  value={query}
                  onChange={(v) => {
                    setQuery(v)
                    setShowAll(false)
                  }}
                  label={`Buscar no extrato de ${accountLabel(state, account.id)}`}
                />
                {searching && movements.length > 0 && <SearchSummary txs={movements} hidden={hidden} scope="nesta conta" />}
              </div>
            )}
            {allMovements.length === 0 ? (
              <EmptyState
                title={isSub ? 'Nada nesta subconta ainda' : 'Nada nesta conta ainda'}
                text={isSub ? 'Use "Mover" para guardar dinheiro aqui. Rendimentos entram por "Conferir".' : 'Receitas, gastos no Pix ou em dinheiro, transferências e pagamentos de fatura aparecem aqui.'}
              />
            ) : movements.length === 0 ? (
              <EmptyState title={`Nada com “${query.trim()}”`} text="Tente parte do nome, um valor (45,90 ou >100) ou uma data (12/11, novembro)." />
            ) : (
              <ListPanel>
                {shown.map((t, i) => (
                  <ListRow
                    key={t.id}
                    index={i}
                    onClick={() => openSheet({ type: 'tx', id: t.id })}
                    icon={<TxIcon t={t} />}
                    title={
                      <span className="flex items-center gap-2">
                        <span className="truncate">{t.name}</span>
                        {t.recurrenceId && <Repeat size={13} className="shrink-0 text-esk-muted" aria-label="recorrente" />}
                      </span>
                    }
                    subtitle={subtitle(t)}
                    value={value(t)}
                  />
                ))}
              </ListPanel>
            )}
            {movements.length > limit && (
              <button type="button" onClick={() => setShowAll((v) => !v)} className="self-start font-sat text-[14px] font-medium text-esk-lime">
                {showAll ? 'Mostrar menos' : `Ver mais (${movements.length - limit})`}
              </button>
            )}
          </section>
        </div>
      </Page>
    </div>
  )
}
