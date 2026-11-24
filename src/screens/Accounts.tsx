import { useState } from 'react'
import { ArrowDownLeft, CreditCard, Landmark, PiggyBank, Plus, Repeat, Wallet } from 'lucide-react'
import { categoryMeta } from '../data/categories'
import { CategoryRowIcon } from '../components/icons'
import { cx, EmptyState, ListPanel, ListRow, Page, RoundButton, ScreenHeader, SectionHeader } from '../components/ui'
import { brl, longDate, privateExpense, privateIncome, privateMoney, shortDate } from '../lib/format'
import { accountKindLabel, incomeLabel, kindOf, nextDate } from '../lib/ledger'
import { accountBalance, accountTransactions, balanceOf, todayISO, useStore } from '../state/store'
import { useUI } from '../state/ui'
import type { Account, Transaction } from '../types'

const KIND_ICON = { checking: Landmark, savings: PiggyBank, wallet: Wallet } as const

function AccountIcon({ kind }: { kind: Account['kind'] }) {
  const Icon = KIND_ICON[kind] ?? Landmark
  return <Icon size={20} strokeWidth={1.6} className="text-esk-text-2" aria-hidden />
}

function TxIcon({ t }: { t: Transaction }) {
  const k = kindOf(t)
  if (k === 'income') return <ArrowDownLeft size={20} strokeWidth={1.7} className="text-esk-lime" aria-hidden />
  if (k === 'invoice_payment') return <CreditCard size={19} strokeWidth={1.6} className="text-esk-text-2" aria-hidden />
  return <CategoryRowIcon category={t.category} name={t.name} size={20} />
}

export default function Accounts() {
  const { state } = useStore()
  const { openSheet } = useUI()
  const hidden = state.hideBalance
  const today = todayISO()
  const [selected, setSelected] = useState(state.accounts[0]?.id ?? '')
  const account = state.accounts.find((a) => a.id === selected) ?? state.accounts[0]
  const movements = account ? accountTransactions(state, account.id).filter((t) => t.date <= today) : []
  const [showAll, setShowAll] = useState(false)
  const shown = showAll ? movements : movements.slice(0, 8)

  const subtitle = (t: Transaction) => {
    const k = kindOf(t)
    if (k === 'income') return `${incomeLabel(t.category)} · ${shortDate(t.date)}`
    if (k === 'invoice_payment') return `Pagamento de fatura · ${shortDate(t.date)}`
    return `${categoryMeta(state, t.category).label} · ${t.method.type === 'pix' ? 'Pix' : 'Dinheiro'} · ${shortDate(t.date)}`
  }

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
              <p className="pt-2 font-sat text-[13px] text-esk-subtle">Soma de todas as contas. Gastos no cartão saem daqui quando você paga a fatura.</p>
            </div>

            <ListPanel>
              {state.accounts.map((a, i) => (
                <ListRow
                  key={a.id}
                  index={i}
                  onClick={() => setSelected(a.id)}
                  icon={<AccountIcon kind={a.kind} />}
                  title={
                    <span className="flex items-center gap-2">
                      {a.name}
                      {account?.id === a.id && <span className="size-[7px] rounded-full bg-esk-lime" aria-label="selecionada" />}
                    </span>
                  }
                  subtitle={accountKindLabel(a.kind)}
                  value={privateMoney(brl(accountBalance(state, a.id)), hidden)}
                />
              ))}
            </ListPanel>
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
                <span className="font-sat text-[12px] text-esk-subtle">Banco, poupança ou carteira</span>
              </span>
            </button>
          </section>

          <section aria-label="Extrato da conta" className="flex flex-col gap-[18px] pt-10 md:pt-6">
            {account && (
              <>
                <SectionHeader
                  title={`Extrato · ${account.name}`}
                  action={
                    <button type="button" onClick={() => openSheet({ type: 'bankAccount', id: account.id })} className="font-sat text-[14px] font-medium text-esk-lime-soft hover:underline">
                      Editar
                    </button>
                  }
                />
                {movements.length === 0 ? (
                  <EmptyState title="Nada nesta conta ainda" text="Receitas, gastos no Pix ou em dinheiro e pagamentos de fatura aparecem aqui." />
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
                        value={
                          <span className={kindOf(t) === 'income' ? 'text-esk-positive' : 'text-esk-negative'}>
                            {kindOf(t) === 'income' ? privateIncome(t.amount, hidden) : privateExpense(t.amount, hidden)}
                          </span>
                        }
                      />
                    ))}
                  </ListPanel>
                )}
                {movements.length > 8 && (
                  <button type="button" onClick={() => setShowAll((v) => !v)} className="self-start font-sat text-[14px] font-medium text-esk-lime">
                    {showAll ? 'Mostrar menos' : `Ver mais (${movements.length - 8})`}
                  </button>
                )}
              </>
            )}

            <div className="flex flex-col gap-3 pt-6">
              <h3 className="font-sat text-[17px] font-medium text-esk-muted">Recorrentes</h3>
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
            </div>
          </section>
        </div>
      </Page>
    </div>
  )
}
