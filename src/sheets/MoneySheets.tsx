/**
 * Sheets de dinheiro: adicionar gasto/receita (parcelado e recorrente), detalhe do lançamento,
 * pagar fatura, contas, recorrências e aviso de teto.
 */
import { useRef, useState } from 'react'
import { ArrowLeftRight, BellRing, ChevronRight, Minus, Plus, Repeat, Scale } from 'lucide-react'
import { categoryIds, categoryMeta, normalizeLabel } from '../data/categories'
import { REPORTS_EVENT } from '../lib/reports'
import { CategoryRowIcon } from '../components/icons'
import { Chip, cx, Field, inputClass, MoneyInput, PrimaryButton, SearchField, SearchSummary, Sheet, Switch } from '../components/ui'
import { searchTransactions } from '../lib/search'
import { movementAmount } from '../lib/movements'
import { brl, brlShort, longDate, monthKey, monthName, privateExpense, privateIncome, privateMoney } from '../lib/format'
import {
  ACCOUNT_KINDS,
  addMonths,
  currentAlreadyInInvoice,
  INCOME_SOURCES,
  incomeLabel,
  installmentGroup,
  isIncomeSource,
  kindOf,
  nextDate,
  splitInstallments,
} from '../lib/ledger'
import { accountBalance, accountLabel, accountName, capAlert, subaccounts, topAccounts, capWarning, methodLabel, ruleFor, todayISO, uncategorized, useStore } from '../state/store'
import { accountsApi, budgetApi, cardsApi, categoriesApi, installmentsApi, recurrencesApi, rulesApi, transactionsApi } from '../services/finance'
import { useMutation } from '../state/useMutation'
import { useUI } from '../state/ui'
import type { Account, AppState, CategoryId, PaymentMethod, Recurrence, Transaction } from '../types'

/** Keeps the last value of an entity so a sheet can play its exit animation after the entity is deleted. */
export function useLast<T>(value: T | undefined) {
  const ref = useRef(value)
  if (value !== undefined) ref.current = value
  return ref.current
}

export function ConfirmDelete({
  open,
  onOpen,
  onCancel,
  onConfirm,
  label,
  question,
  loading,
}: {
  open: boolean
  onOpen: () => void
  onCancel: () => void
  onConfirm: () => void
  label: string
  question: string
  loading?: boolean
}) {
  if (!open) {
    return (
      <PrimaryButton tone="danger" onClick={onOpen}>
        {label}
      </PrimaryButton>
    )
  }
  return (
    <div className="flex animate-rise flex-col gap-3 rounded-[22px] bg-esk-elevated p-4">
      <p className="font-sat text-[14px] text-white">{question}</p>
      <div className="grid grid-cols-2 gap-3">
        <PrimaryButton tone="dark" onClick={onCancel} disabled={loading}>
          Cancelar
        </PrimaryButton>
        <PrimaryButton onClick={onConfirm} loading={loading} loadingText="Removendo…">
          Confirmar
        </PrimaryButton>
      </div>
    </div>
  )
}

const methodKey = (m: PaymentMethod) => (m.type === 'card' ? `card:${m.cardId}` : m.type)
const keyToMethod = (k: string): PaymentMethod => (k.startsWith('card:') ? { type: 'card', cardId: k.slice(5) } : { type: k as 'pix' | 'cash' })
const monthOf = (iso: string) => monthName(Number(iso.slice(5, 7)) - 1)
const MAX_INSTALLMENTS = 48

/** Segmented control Gasto | Receita */
function KindSwitch({ value, onChange }: { value: 'expense' | 'income'; onChange: (v: 'expense' | 'income') => void }) {
  return (
    <div role="radiogroup" aria-label="Tipo de lançamento" className="grid grid-cols-2 gap-1 rounded-[20px] bg-esk-elevated p-1 ring-1 ring-esk-track">
      {(['expense', 'income'] as const).map((k) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={value === k}
          onClick={() => onChange(k)}
          className={cx(
            'h-[40px] rounded-[16px] font-sat text-[14px] font-medium transition duration-200',
            value === k ? 'bg-esk-lime text-esk-ink' : 'text-esk-muted hover:text-white',
          )}
        >
          {k === 'expense' ? 'Gasto' : 'Receita'}
        </button>
      ))}
    </div>
  )
}

function AccountChips({ value, onChange, accounts }: { value: string; onChange: (id: string) => void; accounts: Account[] }) {
  const { state } = useStore()
  // Conta e logo depois as subcontas dela ("Nubank", "Nubank · Caixinha")
  const ordered = accounts.filter((a) => !a.parentId).flatMap((a) => [a, ...accounts.filter((x) => x.parentId === a.id)])
  const rest = accounts.filter((a) => !ordered.includes(a))
  return (
    <div className="flex flex-wrap gap-2">
      {[...ordered, ...rest].map((a) => (
        <Chip key={a.id} active={value === a.id} onClick={() => onChange(a.id)}>
          {accountLabel(state, a.id)}
        </Chip>
      ))}
    </div>
  )
}

/** Linha "Repetir todo mês" */
function RecurringRow({ checked, onChange, day, disabledReason, kind }: { checked: boolean; onChange: (v: boolean) => void; day: number; disabledReason?: string; kind: 'expense' | 'income' }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[20px] bg-esk-elevated px-4 py-3 ring-1 ring-esk-track">
      <div className="flex min-w-0 items-start gap-3">
        <Repeat size={18} strokeWidth={1.7} className={cx('mt-[2px] shrink-0', checked ? 'text-esk-lime' : 'text-esk-muted')} aria-hidden />
        <div className="min-w-0">
          <p className="font-sat text-[15px] font-medium text-white">Repetir todo mês</p>
          <p className="font-sat text-[12px] leading-[1.35] text-esk-muted">
            {disabledReason ??
              (checked
                ? `Todo dia ${day}. ${kind === 'income' ? 'Entra' : 'Sai'} sozinho no dia, sem criar meses antes da hora.`
                : `Para salário, aluguel, assinaturas…`)}
          </p>
        </div>
      </div>
      {!disabledReason && <Switch checked={checked} onChange={onChange} label="Repetir todo mês" />}
    </div>
  )
}

/* ------------------------------------------------- Adicionar / editar */

export function EntrySheet({ close, id, initialKind }: { close: () => void; id?: string; initialKind?: 'expense' | 'income' }) {
  const { state, dispatch } = useStore()
  const { openSheet, notify } = useUI()
  const { run, pending } = useMutation()
  const hidden = state.hideBalance
  const today = todayISO()
  const existing = useLast(id ? state.transactions.find((t) => t.id === id) : undefined)
  const group = existing?.installment ? installmentGroup(state, existing.installment.group) : []
  const groupTotal = group.reduce((s, t) => s + t.amount, 0)

  const [kind, setKind] = useState<'expense' | 'income'>(existing ? (kindOf(existing) === 'income' ? 'income' : 'expense') : (initialKind ?? 'expense'))
  const [amount, setAmount] = useState(existing ? (existing.installment ? Math.round(groupTotal * 100) / 100 : existing.amount) : 0)
  const [name, setName] = useState(existing?.name ?? '')
  // Gasto novo começa sem categoria marcada: a pessoa escolhe uma ou toca em "Decidir depois"
  const editingExpense = !!existing && kindOf(existing) === 'expense'
  const [category, setCategory] = useState<CategoryId | null>(editingExpense ? existing!.category : null)
  const [later, setLater] = useState(editingExpense && existing!.category === null)
  const [pickedCategory, setPickedCategory] = useState(editingExpense)
  const pickCategory = (c: CategoryId | null) => {
    setCategory(c)
    setLater(c === null)
    setPickedCategory(true)
  }
  const [source, setSource] = useState<CategoryId>(existing && isIncomeSource(existing.category) ? existing.category : 'receita_salario')
  const [method, setMethod] = useState(existing ? methodKey(existing.method) : state.cards[0] ? `card:${state.cards[0].id}` : 'pix')
  const [accountId, setAccountId] = useState(existing?.accountId ?? state.accounts[0]?.id ?? '')
  const [date, setDate] = useState(existing?.installment ? (group[0]?.date ?? existing.date) : (existing?.date ?? today))
  const [count, setCount] = useState(existing?.installment?.total ?? 1)
  const [countText, setCountText] = useState<string | null>(null)
  const [recurring, setRecurring] = useState(false)
  const [tries, setTries] = useState(0)

  const isIncome = kind === 'income'
  const onCard = !isIncome && method.startsWith('card:')
  const parcelado = onCard && count > 1
  const canRecur = !existing
  const showAccount = (isIncome || !onCard) && state.accounts.length > 1
  const day = Number(date.slice(8, 10)) || 1
  const parts = parcelado && amount > 0 ? splitInstallments(amount, count) : []
  const futureDate = date > today

  const amountError = tries && amount <= 0 ? (isIncome ? 'Digite o valor recebido.' : 'Digite o valor da compra.') : tries && parcelado && Math.round(amount * 100) < count ? 'Valor pequeno demais para tantas parcelas.' : undefined
  const dateError = tries && !date ? 'Escolha a data.' : tries && futureDate && !recurring ? 'A data não pode ser no futuro. Para algo que vai acontecer, marque "Repetir todo mês".' : undefined

  // Aviso na hora: o que entra no mês da compra (à vista inteiro, parcelado só a 1ª parcela)
  const warnAmount = parcelado ? (parts[0] ?? 0) : amount
  const exceptIds = existing ? (existing.installment ? group.map((t) => t.id) : [existing.id]) : []
  const warning = !isIncome && !recurring && date && category !== null ? capWarning(state, category, monthKey(date), warnAmount, exceptIds) : null
  const catLabel = category !== null ? categoryMeta(state, category).label : 'Gasto'
  const categoryError =
    tries && !isIncome
      ? recurring && category === null
        ? 'Gasto recorrente precisa de categoria.'
        : category === null && !later
          ? 'Escolha uma categoria ou toque em "Decidir depois".'
          : undefined
      : undefined

  async function save() {
    setTries((n) => n + 1)
    if (amount <= 0 || !date) return
    if (parcelado && Math.round(amount * 100) < count) return
    if (futureDate && !recurring) return
    if (!isIncome && (recurring ? category === null : category === null && !later)) return
    const label = name.trim() || (isIncome ? incomeLabel(source) : catLabel)
    const txMethod: PaymentMethod = isIncome ? { type: 'pix' } : keyToMethod(method)
    const account = isIncome || !onCard ? accountId || undefined : undefined
    const warnText = warning ? `${catLabel} chegou a ${warning.percent}% do teto de ${monthOf(date)}` : undefined

    // Recorrente: cria a regra; o banco gera o lançamento quando a data chega
    if (recurring && canRecur) {
      const ok = await run(
        'save',
        () =>
          recurrencesApi.create(
            { kind, name: label, category: isIncome ? source : (category as CategoryId), method: txMethod, accountId: account, amount, day, startDate: date },
            state,
          ),
        (snapshot) => dispatch({ type: 'sync', snapshot }),
        `${isIncome ? 'Receita' : 'Gasto'} recorrente criado: todo dia ${day}`,
      )
      if (ok) close()
      return
    }

    // Parcelado: uma linha por parcela, só a parcela conta no mês dela
    if (parcelado) {
      const cardId = (txMethod as { cardId: string }).cardId
      const ok = await run(
        'save',
        async () => {
          // Era um gasto comum: sai o lançamento antigo e entram as parcelas
          if (existing && !existing.installment) await transactionsApi.remove(existing.id)
          return installmentsApi.save({ group: existing?.installment?.group, name: label, category, cardId, total: amount, count, firstDate: date }, state)
        },
        (snapshot) => dispatch({ type: 'sync', snapshot }),
        warnText ?? `${count}x de ${privateMoney(brl(parts[parts.length - 1] ?? 0), hidden)} registrado`,
      )
      if (ok) close()
      return
    }

    const tx: Omit<Transaction, 'id'> = {
      kind,
      name: label,
      category: isIncome ? source : category,
      method: txMethod,
      accountId: account,
      date,
      amount,
      source: existing?.source ?? 'manual',
      invoiceId: existing?.invoiceId,
    }
    const done = isIncome ? `${privateMoney(brl(amount), hidden)} somado ao saldo` : `${privateMoney(brl(amount), hidden)} registrado`
    let ok: boolean
    if (existing?.installment) {
      // Era parcelado e virou à vista: saem as parcelas, entra um lançamento
      const g = existing.installment.group
      ok = await run(
        'save',
        async () => {
          await installmentsApi.remove(g)
          return transactionsApi.create(tx)
        },
        (saved) => {
          dispatch({ type: 'deleteGroup', group: g })
          dispatch({ type: 'addTx', tx: saved })
        },
        warnText ?? 'Compra atualizada',
      )
    } else if (existing) {
      ok = await run('save', () => transactionsApi.update({ ...tx, id: existing.id, recurrenceId: existing.recurrenceId }), (saved) => dispatch({ type: 'updateTx', tx: saved }), warnText ?? (isIncome ? 'Receita atualizada' : 'Gasto atualizado'))
    } else {
      ok = await run('save', () => transactionsApi.create(tx), (saved) => dispatch({ type: 'addTx', tx: saved }), warnText ?? done)
    }
    if (ok) {
      close()
      if (warnText) window.setTimeout(() => notify(warnText, 'info'), 0)
    }
  }

  const title = existing ? (isIncome ? 'Editar receita' : existing.installment ? 'Editar compra parcelada' : 'Editar gasto') : isIncome ? 'Adicionar receita' : 'Adicionar gasto'

  return (
    <Sheet title={title} onClose={existing ? () => openSheet({ type: 'tx', id: existing.id }) : close}>
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        {!existing && <KindSwitch value={kind} onChange={(k) => { setKind(k); setTries(0) }} />}
        <Field label={isIncome ? 'Valor recebido' : parcelado ? 'Valor total da compra' : 'Valor da compra'} htmlFor="amount" error={amountError} attempt={tries}>
          <MoneyInput id="amount" value={amount} onChange={setAmount} large autoFocus />
        </Field>
        <Field label="Descrição (opcional)" htmlFor="name">
          <input
            id="name"
            className={inputClass}
            placeholder={isIncome ? 'Salário, freela, venda…' : 'Mercado, Uber, Netflix…'}
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              // Nome que a pessoa já classificou antes: a categoria aprendida vem marcada
              if (!isIncome && !pickedCategory) {
                const learned = ruleFor(state, e.target.value)
                setCategory(learned ?? null)
                setLater(false)
              }
            }}
            maxLength={40}
          />
        </Field>

        {isIncome ? (
          <>
            <Field label="Origem">
              <div className="flex flex-wrap gap-2">
                {INCOME_SOURCES.map((s) => (
                  <Chip key={s.id} active={source === s.id} onClick={() => setSource(s.id)}>
                    {s.label}
                  </Chip>
                ))}
              </div>
            </Field>
            {state.accounts.length > 0 && (
              <Field label="Recebe em">
                <AccountChips value={accountId} onChange={setAccountId} accounts={state.accounts} />
              </Field>
            )}
          </>
        ) : (
          <>
            <Field label="Categoria" error={categoryError} attempt={tries}>
              <div className="flex flex-wrap gap-2">
                {categoryIds(state).map((c) => (
                  <Chip key={c} active={category === c} onClick={() => pickCategory(c)}>
                    {categoryMeta(state, c).label}
                  </Chip>
                ))}
                {!recurring && (
                  <Chip active={later} dashed={!later} onClick={() => pickCategory(null)}>
                    Decidir depois
                  </Chip>
                )}
              </div>
              {later && !recurring && (
                <p className="font-sat text-[12px] text-esk-subtle">Fica marcado como sem categoria até você escolher. Conta no total do mês, mas em nenhum teto.</p>
              )}
              {!pickedCategory && category !== null && (
                <p className="font-sat text-[12px] text-esk-subtle">Categoria que você usou antes para esse nome.</p>
              )}
            </Field>
            <Field label="Pagamento">
              <div className="flex flex-wrap gap-2">
                {state.cards.map((c) => (
                  <Chip key={c.id} active={method === `card:${c.id}`} onClick={() => setMethod(`card:${c.id}`)}>
                    {c.nickname}
                  </Chip>
                ))}
                <Chip active={method === 'pix'} onClick={() => setMethod('pix')}>
                  Pix
                </Chip>
                <Chip active={method === 'cash'} onClick={() => setMethod('cash')}>
                  Dinheiro
                </Chip>
              </div>
            </Field>
            {showAccount && (
              <Field label="Sai da conta">
                <AccountChips value={accountId} onChange={setAccountId} accounts={state.accounts} />
              </Field>
            )}
            {onCard && !recurring && (
              <Field label="Parcelas">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip active={count === 1} onClick={() => setCount(1)}>
                    À vista
                  </Chip>
                  <Chip active={count > 1} onClick={() => setCount((n) => (n > 1 ? n : 2))}>
                    Parcelado
                  </Chip>
                  {count > 1 && (
                    <div className="flex h-[40px] animate-rise items-center gap-1 rounded-[20px] bg-esk-elevated px-1 ring-1 ring-esk-track">
                      <button type="button" aria-label="Menos uma parcela" onClick={() => setCount((n) => Math.max(2, n - 1))} className="grid size-[32px] place-items-center rounded-full text-white hover:bg-white/5">
                        <Minus size={15} />
                      </button>
                      <input
                        aria-label="Número de parcelas"
                        inputMode="numeric"
                        value={countText ?? String(count)}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          // Digita livre ("1" → "10"); só vale quando for 2 ou mais
                          const text = e.target.value.replace(/\D/g, '').slice(0, 2)
                          setCountText(text)
                          const n = Number(text)
                          if (n >= 2) setCount(Math.min(MAX_INSTALLMENTS, n))
                        }}
                        onBlur={() => setCountText(null)}
                        className="w-[34px] bg-transparent text-center font-sat text-[15px] font-medium text-white outline-none"
                      />
                      <button type="button" aria-label="Mais uma parcela" onClick={() => setCount((n) => Math.min(MAX_INSTALLMENTS, n + 1))} className="grid size-[32px] place-items-center rounded-full text-white hover:bg-white/5">
                        <Plus size={15} />
                      </button>
                    </div>
                  )}
                </div>
                {parcelado && parts.length > 0 && (
                  <p className="font-sat text-[13px] text-esk-muted">
                    {parts[0] === parts[parts.length - 1]
                      ? `${count}x de ${privateMoney(brl(parts[0]), hidden)}`
                      : `1ª de ${privateMoney(brl(parts[0]), hidden)} + ${count - 1}x de ${privateMoney(brl(parts[1]), hidden)}`}
                    {' · '}só a parcela conta no teto de cada mês
                  </p>
                )}
              </Field>
            )}
          </>
        )}

        <Field label={recurring ? 'Primeira vez em' : isIncome ? 'Data' : parcelado ? 'Data da compra' : 'Data'} htmlFor="date" error={dateError} attempt={tries}>
          <input id="date" type="date" className={inputClass} value={date} max={recurring ? undefined : today} onChange={(e) => setDate(e.target.value)} />
        </Field>

        {canRecur && (
          <RecurringRow
            kind={kind}
            checked={recurring}
            onChange={setRecurring}
            day={day}
            disabledReason={parcelado ? 'Compra parcelada não pode ser recorrente.' : undefined}
          />
        )}

        {warning && (
          <p role="status" className="flex animate-rise items-start gap-2 rounded-[18px] bg-esk-lilac/10 px-4 py-3 font-sat text-[13px] leading-[1.4] text-esk-lilac">
            <BellRing size={16} className="mt-px shrink-0" aria-hidden />
            Com este gasto, {catLabel} fica em {warning.percent}% do teto de {monthOf(date)} ({privateMoney(brlShort(warning.after), hidden)} de {privateMoney(brlShort(warning.cap), hidden)}).
          </p>
        )}

        <PrimaryButton type="submit" className="mt-1" loading={pending === 'save'}>
          {existing ? 'Salvar alterações' : recurring ? 'Salvar recorrência' : 'Salvar'}
        </PrimaryButton>
      </form>
    </Sheet>
  )
}

/* --------------------------------------------------- Detalhe do lançamento */

function DetailList({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="mt-6 flex flex-col rounded-[24px] bg-esk-elevated px-5">
      {rows.map(([k, v], i) => (
        <div key={k} className={`flex justify-between gap-4 py-4 font-sat text-[15px] ${i ? 'border-t border-esk-border' : ''}`}>
          <dt className="text-esk-muted">{k}</dt>
          <dd className="text-right font-medium text-white">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

export function TransactionSheet({ close, id }: { close: () => void; id: string }) {
  const { state, dispatch } = useStore()
  const { openSheet } = useUI()
  const { run, pending } = useMutation()
  const hidden = state.hideBalance
  const today = todayISO()
  const [confirming, setConfirming] = useState(false)
  const t = useLast(state.transactions.find((x) => x.id === id))
  if (!t) return null
  const k = kindOf(t)
  const invoice = t.invoiceId ? state.invoices.find((i) => i.id === t.invoiceId) : undefined
  const rec = t.recurrenceId ? state.recurrences.find((r) => r.id === t.recurrenceId) : undefined
  const group = t.installment ? installmentGroup(state, t.installment.group) : []
  const card = t.method.type === 'card' ? state.cards.find((c) => c.id === (t.method as { cardId: string }).cardId) : undefined

  const rows: [string, string][] = []
  const movement = k === 'transfer' || k === 'adjustment'
  if (k === 'transfer') {
    rows.push(['De', accountLabel(state, t.accountId)], ['Para', accountLabel(state, t.transferAccountId)])
  } else if (k === 'adjustment') {
    rows.push(
      [card ? 'Cartão' : 'Conta', card ? `${card.nickname} • ${card.last4}` : accountLabel(state, t.accountId)],
      ['Motivo', 'Conferência com o banco'],
      ['Conta no mês?', 'Não: só corrige o valor'],
    )
  } else if (k === 'income') {
    rows.push(['Origem', incomeLabel(t.category)], ['Recebido em', accountName(state, t.accountId)])
  } else if (k === 'invoice_payment') {
    rows.push(['Cartão', card ? `${card.nickname} • ${card.last4}` : 'Cartão removido'], ['Pago com', accountName(state, t.accountId)])
  } else {
    rows.push(['Categoria', categoryMeta(state, t.category).label], ['Pagamento', methodLabel(state, t)])
    if (t.method.type !== 'card' && state.accounts.length > 1) rows.push(['Conta', accountName(state, t.accountId)])
  }
  if (t.installment) {
    const total = group.reduce((s, x) => s + x.amount, 0)
    const left = group.filter((x) => x.date > today)
    rows.push(
      ['Parcela', `${t.installment.number} de ${t.installment.total}`],
      ['Valor da compra', privateMoney(brl(total), hidden)],
      ['Ainda vão cair', left.length ? `${left.length} · ${privateMoney(brl(left.reduce((s, x) => s + x.amount, 0)), hidden)}` : 'Nenhuma'],
      ['Data da compra', longDate(group[0]?.date ?? t.date)],
    )
    if (t.date !== group[0]?.date) rows.push(['Esta parcela', longDate(t.date)])
  } else {
    rows.push(['Data', longDate(t.date)])
  }
  if (rec) rows.push(['Repete', `Todo dia ${rec.day}`])
  if (k === 'transfer') rows.push(['Conta no mês?', 'Não: o dinheiro só mudou de lugar'])
  if (k === 'expense' && !t.installment) rows.push(['Origem', t.source === 'fatura' ? 'Lido da fatura (IA)' : rec ? 'Recorrência' : 'Digitado por você'])

  const title =
    k === 'transfer'
      ? 'Transferência'
      : k === 'adjustment'
        ? 'Ajuste'
        : k === 'income'
          ? 'Detalhe da receita'
          : k === 'invoice_payment'
            ? 'Pagamento de fatura'
            : t.installment
              ? 'Compra parcelada'
              : 'Detalhe da compra'
  const question = movement
    ? k === 'transfer'
      ? 'Apagar esta transferência? O dinheiro volta para a conta de origem.'
      : card
        ? 'Apagar este ajuste? A fatura volta ao valor de antes.'
        : 'Apagar este ajuste? O saldo volta ao valor de antes.'
    : t.installment
    ? `Apagar a compra inteira? As ${t.installment.total} parcelas saem de todos os meses.`
    : k === 'income'
      ? 'Apagar esta receita? O valor sai do saldo.'
      : k === 'invoice_payment'
        ? 'Apagar este pagamento? A fatura e o saldo voltam ao que eram.'
        : 'Apagar este gasto? O saldo e o mês voltam ao que eram.'
  const edit = () =>
    k === 'invoice_payment'
      ? openSheet({ type: 'payInvoice', id: t.id })
      : k === 'transfer'
        ? openSheet({ type: 'transfer', id: t.id })
        : openSheet({ type: 'edit', id: t.id })

  return (
    <Sheet title={title} onClose={close}>
      <div className="flex items-center gap-4">
        <span className="grid size-[56px] place-items-center rounded-full bg-esk-row">
          {k === 'transfer' ? (
            <ArrowLeftRight size={24} className="text-esk-text-2" aria-hidden />
          ) : k === 'adjustment' ? (
            <Scale size={24} className="text-esk-text-2" aria-hidden />
          ) : k === 'income' ? (
            <Plus size={24} className="text-esk-lime" aria-hidden />
          ) : (
            <CategoryRowIcon category={t.category} name={t.name} size={24} />
          )}
        </span>
        <div className="min-w-0">
          <p className="truncate font-sat text-[17px] font-medium text-white">{t.name}</p>
          <p
            className={cx(
              'font-sat text-[34px] leading-[40px] font-medium tracking-[-1.4px]',
              movement ? 'text-white' : k === 'income' ? 'text-esk-positive' : 'text-esk-negative',
            )}
          >
            {movement ? movementAmount(t, hidden) : k === 'income' ? privateIncome(t.amount, hidden) : privateExpense(t.amount, hidden)}
          </p>
          {t.date > today && <p className="font-sat text-[13px] text-esk-muted">Previsto para {longDate(t.date)}</p>}
        </div>
      </div>
      <DetailList rows={rows} />
      {k === 'expense' && t.category === null && (
        <button
          type="button"
          onClick={() => openSheet({ type: 'categorize', id: t.id })}
          className="mt-3 flex w-full items-center justify-between gap-3 rounded-[20px] bg-esk-lilac/10 px-4 py-3 text-left font-sat text-[14px] font-medium text-esk-lilac ring-1 ring-esk-lilac/30 transition hover:bg-esk-lilac/15"
        >
          <span>Sem categoria · escolher agora</span>
          <ChevronRight size={16} aria-hidden />
        </button>
      )}
      {invoice && (
        <button
          type="button"
          onClick={() => openSheet({ type: 'invoiceImport', id: invoice.id })}
          className="mt-3 flex w-full items-center justify-between gap-3 rounded-[20px] px-1 py-2 text-left font-sat text-[14px] font-medium text-esk-lime-soft hover:underline"
        >
          <span className="truncate">Ver fatura {invoice.fileName}</span>
          <ChevronRight size={16} aria-hidden />
        </button>
      )}
      {rec && (
        <button
          type="button"
          onClick={() => openSheet({ type: 'recurrence', id: rec.id })}
          className="mt-3 flex w-full items-center justify-between gap-3 rounded-[20px] px-1 py-2 text-left font-sat text-[14px] font-medium text-esk-lime-soft hover:underline"
        >
          <span className="flex items-center gap-2">
            <Repeat size={15} aria-hidden /> Editar recorrência (próximos meses)
          </span>
          <ChevronRight size={16} aria-hidden />
        </button>
      )}
      {confirming ? (
        <div className="mt-6 flex animate-rise flex-col gap-3">
          <p className="font-sat text-[15px] text-white">{question}</p>
          <div className="grid grid-cols-2 gap-3">
            <PrimaryButton tone="dark" onClick={() => setConfirming(false)} disabled={!!pending}>
              Cancelar
            </PrimaryButton>
            <PrimaryButton
              loading={pending === 'delete'}
              loadingText="Apagando…"
              onClick={async () => {
                const g = t.installment?.group
                const ok = g
                  ? await run('delete', () => installmentsApi.remove(g), () => dispatch({ type: 'deleteGroup', group: g }), 'Compra apagada', 'Não deu para apagar. Tente de novo.')
                  : await run('delete', () => transactionsApi.remove(t.id), () => dispatch({ type: 'deleteTx', id: t.id }), 'Lançamento apagado', 'Não deu para apagar. Tente de novo.')
                if (ok) close()
              }}
            >
              Apagar
            </PrimaryButton>
          </div>
        </div>
      ) : (
        <div className={cx('mt-6 grid gap-3', k === 'adjustment' ? 'grid-cols-1' : 'grid-cols-2')}>
          <PrimaryButton tone="danger" onClick={() => setConfirming(true)}>
            {t.installment ? 'Apagar compra' : 'Apagar'}
          </PrimaryButton>
          {k !== 'adjustment' && <PrimaryButton onClick={edit}>Editar</PrimaryButton>}
        </div>
      )}
    </Sheet>
  )
}

/* ------------------------------------------------------------- Pagar fatura */

export function PayInvoiceSheet({ close, cardId, id }: { close: () => void; cardId?: string; id?: string }) {
  const { state, dispatch } = useStore()
  const { run, pending } = useMutation()
  const hidden = state.hideBalance
  const today = todayISO()
  const existing = useLast(id ? state.transactions.find((t) => t.id === id) : undefined)
  const initialCard = existing?.method.type === 'card' ? existing.method.cardId : (cardId ?? state.cards[0]?.id ?? '')
  const [card, setCard] = useState(initialCard)
  const current = state.cards.find((c) => c.id === card)
  const [amount, setAmount] = useState(existing?.amount ?? current?.invoice ?? 0)
  const [accountId, setAccountId] = useState(existing?.accountId ?? state.accounts[0]?.id ?? '')
  const [date, setDate] = useState(existing?.date ?? today)
  const [tries, setTries] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState(false)
  if (!current && !existing) return null
  const balance = accountId ? accountBalance(state, accountId) : 0

  async function save() {
    setTries((n) => n + 1)
    if (amount <= 0 || !date || date > today || !card) return
    const tx: Omit<Transaction, 'id'> = {
      kind: 'invoice_payment',
      name: `Fatura ${current?.nickname ?? ''}`.trim(),
      category: 'outros',
      method: { type: 'card', cardId: card },
      accountId: accountId || undefined,
      date,
      amount,
      source: 'manual',
    }
    const ok = existing
      ? await run('save', () => transactionsApi.update({ ...tx, id: existing.id }), (saved) => dispatch({ type: 'updateTx', tx: saved }), 'Pagamento atualizado')
      : await run('save', () => transactionsApi.create(tx), (saved) => dispatch({ type: 'addTx', tx: saved }), `Fatura paga: ${privateMoney(brl(amount), hidden)} saiu de ${accountName(state, accountId)}`)
    if (ok) close()
  }

  return (
    <Sheet title={existing ? 'Pagamento de fatura' : `Pagar fatura${current ? ` ${current.nickname}` : ''}`} onClose={close}>
      <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); save() }}>
        {state.cards.length > 1 && (
          <Field label="Cartão">
            <div className="flex flex-wrap gap-2">
              {state.cards.map((c) => (
                <Chip key={c.id} active={card === c.id} onClick={() => { setCard(c.id); if (!existing) setAmount(c.invoice) }}>
                  {c.nickname}
                </Chip>
              ))}
            </div>
          </Field>
        )}
        <Field label="Valor pago" htmlFor="pay" error={tries && amount <= 0 ? 'Digite o valor pago.' : undefined} attempt={tries}>
          <MoneyInput id="pay" value={amount} onChange={setAmount} large autoFocus />
        </Field>
        {current && !existing && (
          <p className="-mt-2 font-sat text-[13px] text-esk-muted">
            Fatura atual: {privateMoney(brl(current.invoice), hidden)}
            {amount > 0 && amount < current.invoice && ` · ficam ${privateMoney(brl(current.invoice - amount), hidden)} em aberto`}
          </p>
        )}
        <Field label="Pago com">
          <AccountChips value={accountId} onChange={setAccountId} accounts={state.accounts} />
          {accountId && <p className="font-sat text-[12px] text-esk-subtle">Saldo da conta hoje: {privateMoney(brl(balance), hidden)}</p>}
        </Field>
        <Field label="Data" htmlFor="paydate" error={tries && date > today ? 'A data não pode ser no futuro.' : undefined} attempt={tries}>
          <input id="paydate" type="date" className={inputClass} value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <p className="rounded-[18px] bg-esk-elevated px-4 py-3 font-sat text-[13px] leading-[1.4] text-esk-muted">
          Os gastos no cartão já contaram no mês de cada compra. Pagar a fatura tira o dinheiro do saldo e não conta de novo no teto.
        </p>
        <PrimaryButton type="submit" loading={pending === 'save'}>
          {existing ? 'Salvar alterações' : 'Confirmar pagamento'}
        </PrimaryButton>
        {existing && (
          <ConfirmDelete
            open={confirmDelete}
            onOpen={() => setConfirmDelete(true)}
            onCancel={() => setConfirmDelete(false)}
            label="Apagar pagamento"
            question="Apagar este pagamento? A fatura e o saldo voltam ao que eram."
            loading={pending === 'delete'}
            onConfirm={async () => {
              if (await run('delete', () => transactionsApi.remove(existing.id), () => dispatch({ type: 'deleteTx', id: existing.id }), 'Pagamento apagado')) close()
            }}
          />
        )}
      </form>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ Contas */

export function BankAccountSheet({ close, id, parentId }: { close: () => void; id?: string; parentId?: string }) {
  const { state, dispatch } = useStore()
  const { openSheet } = useUI()
  const { run, pending } = useMutation()
  const account = useLast(id ? state.accounts.find((a) => a.id === id) : undefined)
  const parent = state.accounts.find((a) => a.id === (account?.parentId ?? parentId))
  const isSub = !!parent
  const children = account ? subaccounts(state, account.id) : []
  const [name, setName] = useState(account?.name ?? '')
  const [kind, setKind] = useState<Account['kind']>(account?.kind ?? (isSub ? 'savings' : 'checking'))
  // Criar: quanto tem hoje. Editar: o saldo de quando começou (diferenças com o banco = Conferir saldo)
  const [balance, setBalance] = useState(account ? account.startingBalance : 0)
  const [tries, setTries] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const nameError = tries && !name.trim() ? (isSub ? 'Dê um nome à subconta.' : 'Dê um nome à conta.') : undefined
  const otherTops = topAccounts(state).filter((a) => a.id !== account?.id)
  const nowBalance = account ? Math.round((accountBalance(state, account.id) + balance - account.startingBalance) * 100) / 100 : balance

  async function save() {
    setTries((n) => n + 1)
    if (!name.trim()) return
    const input = { name: name.trim(), kind, startingBalance: balance, ...(isSub && !account ? { parentId: parent!.id } : {}) }
    const ok = account
      ? await run('save', () => accountsApi.update({ ...account, ...input }), (a) => dispatch({ type: 'saveAccount', account: a }), isSub ? 'Subconta atualizada' : 'Conta atualizada')
      : await run('save', () => accountsApi.create(input), (a) => dispatch({ type: 'saveAccount', account: a }), isSub ? 'Subconta criada' : 'Conta criada')
    if (ok) close()
  }

  const title = account ? account.name : isSub ? 'Nova subconta' : 'Nova conta'
  return (
    <Sheet title={title} onClose={close}>
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        {isSub && (
          <p className="-mt-2 font-sat text-[13px] leading-[1.45] text-esk-muted">
            Dentro de <span className="text-white">{parent!.name}</span>: poupança, caixinha, reserva… Use o nome que o seu banco usa.
          </p>
        )}
        <Field label="Nome" htmlFor="accname" error={nameError} attempt={tries}>
          <input
            id="accname"
            className={inputClass}
            placeholder={isSub ? 'Poupança, Caixinha viagem, Reserva…' : 'Nubank, Itaú, Carteira…'}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
          />
        </Field>
        {!isSub && (
          <Field label="Tipo">
            <div className="flex flex-wrap gap-2">
              {ACCOUNT_KINDS.map((k) => (
                <Chip key={k.id} active={kind === k.id} onClick={() => setKind(k.id)}>
                  {k.label}
                </Chip>
              ))}
            </div>
          </Field>
        )}
        <Field label={account ? 'Saldo quando começou' : 'Quanto tem nela hoje'} htmlFor="accbal">
          <MoneyInput id="accbal" value={balance} onChange={setBalance} />
        </Field>
        <p className="-mt-2 font-sat text-[13px] leading-[1.45] text-esk-subtle">
          {account ? (
            <>
              O que havia quando você cadastrou. Os lançamentos somam por cima: saldo agora {privateMoney(brl(nowBalance), state.hideBalance)}. Diferente do banco?{' '}
              <button type="button" className="text-esk-lime-soft hover:underline" onClick={() => openSheet({ type: 'reconcile', accountId: account.id })}>
                Conferir saldo
              </button>
            </>
          ) : isSub ? (
            `Soma no total de ${parent!.name}.`
          ) : (
            'O saldo da Home soma todas as suas contas.'
          )}
        </p>
        <PrimaryButton type="submit" loading={pending === 'save'}>
          {account ? 'Salvar' : isSub ? 'Criar subconta' : 'Criar conta'}
        </PrimaryButton>
        {account &&
          (children.length > 0 ? (
            <p className="text-center font-sat text-[13px] text-esk-subtle">Para excluir esta conta, exclua antes as subcontas dela.</p>
          ) : isSub || otherTops.length ? (
            <ConfirmDelete
              open={confirmDelete}
              onOpen={() => setConfirmDelete(true)}
              onCancel={() => setConfirmDelete(false)}
              label={isSub ? 'Excluir subconta' : 'Excluir conta'}
              question={
                isSub
                  ? `Excluir ${account.name}? O saldo e os lançamentos voltam para ${parent!.name}.`
                  : `Excluir ${account.name}? Os lançamentos e o saldo dela passam para ${otherTops[0].name}.`
              }
              loading={pending === 'delete'}
              onConfirm={async () => {
                if (await run('delete', () => accountsApi.remove(account.id), () => dispatch({ type: 'deleteAccount', id: account.id }), isSub ? 'Subconta excluída' : 'Conta excluída', 'Não deu para excluir. Tente de novo.')) close()
              }}
            />
          ) : (
            <p className="text-center font-sat text-[13px] text-esk-subtle">Você precisa de ao menos uma conta.</p>
          ))}
      </form>
    </Sheet>
  )
}

/* ------------------------------------------------------------ Mover dinheiro */

/** Contas e subcontas em ordem: Nubank, Nubank · Caixinha, Inter… */
function accountOptions(state: AppState) {
  return topAccounts(state).flatMap((a) => [a, ...subaccounts(state, a.id)])
}

export function TransferSheet({ close, id, from: initialFrom, to: initialTo }: { close: () => void; id?: string; from?: string; to?: string }) {
  const { state, dispatch } = useStore()
  const { run, pending } = useMutation()
  const hidden = state.hideBalance
  const today = todayISO()
  const existing = useLast(id ? state.transactions.find((t) => t.id === id) : undefined)
  const options = accountOptions(state)
  const [from, setFrom] = useState(existing?.accountId ?? initialFrom ?? options[0]?.id ?? '')
  const [to, setTo] = useState(existing?.transferAccountId ?? initialTo ?? options.find((a) => a.id !== (initialFrom ?? options[0]?.id))?.id ?? '')
  const [amount, setAmount] = useState(existing?.amount ?? 0)
  const [date, setDate] = useState(existing?.date ?? today)
  const [note, setNote] = useState(existing && existing.name !== 'Transferência' ? existing.name : '')
  const [tries, setTries] = useState(0)
  const errors = {
    amount: amount <= 0 ? 'Informe o valor.' : undefined,
    to: !to || to === from ? 'Escolha uma conta de destino diferente da origem.' : undefined,
    date: date > today ? 'A data não pode ser no futuro.' : undefined,
  }
  const show = (e?: string) => (tries ? e : undefined)
  // Saldo de origem depois (desconta o que esta transferência já tirava, ao editar)
  const fromNow = from ? accountBalance(state, from) + (existing && existing.accountId === from ? existing.amount : 0) : 0

  async function save() {
    setTries((n) => n + 1)
    if (Object.values(errors).some(Boolean)) return
    const tx: Omit<Transaction, 'id'> = {
      kind: 'transfer',
      name: note.trim() || 'Transferência',
      category: null,
      method: { type: 'pix' },
      accountId: from,
      transferAccountId: to,
      date,
      amount,
      source: 'manual',
    }
    const msg = `${privateMoney(brl(amount), hidden)} para ${accountLabel(state, to)}`
    const ok = existing
      ? await run('save', () => transactionsApi.update({ ...existing, ...tx }), (t) => dispatch({ type: 'updateTx', tx: t }), 'Transferência atualizada')
      : await run('save', () => transactionsApi.create(tx), (t) => dispatch({ type: 'addTx', tx: t }), msg)
    if (ok) close()
  }

  const chips = (value: string, onChange: (v: string) => void, exclude?: string) => (
    <div className="flex flex-wrap gap-2">
      {options
        .filter((a) => a.id !== exclude)
        .map((a) => (
          <Chip key={a.id} active={value === a.id} onClick={() => onChange(a.id)}>
            {accountLabel(state, a.id)}
          </Chip>
        ))}
    </div>
  )

  return (
    <Sheet title={existing ? 'Editar transferência' : 'Mover dinheiro'} onClose={close}>
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <p className="-mt-2 font-sat text-[13px] leading-[1.45] text-esk-muted">
          Guardar na caixinha, resgatar da poupança, passar de um banco para outro. Não é gasto nem receita: o total não muda.
        </p>
        <Field label="Valor" htmlFor="tr-amount" error={show(errors.amount)} attempt={tries}>
          <MoneyInput id="tr-amount" value={amount} onChange={setAmount} large autoFocus={!existing} />
        </Field>
        <Field label="De">
          {chips(from, (v) => {
            setFrom(v)
            if (v === to) setTo(options.find((a) => a.id !== v)?.id ?? '')
          })}
          {from && <p className="font-sat text-[12px] text-esk-subtle">Saldo: {privateMoney(brl(fromNow), hidden)}</p>}
        </Field>
        <Field label="Para" error={show(errors.to)} attempt={tries}>
          {chips(to, setTo, from)}
        </Field>
        <Field label="Data" htmlFor="tr-date" error={show(errors.date)} attempt={tries}>
          <input id="tr-date" type="date" max={today} className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Descrição (opcional)" htmlFor="tr-note">
          <input id="tr-note" className={inputClass} placeholder="Guardar para a viagem…" value={note} onChange={(e) => setNote(e.target.value)} maxLength={40} />
        </Field>
        {amount > fromNow && from && (
          <p role="status" className="animate-rise font-sat text-[13px] text-esk-lilac">
            A origem fica negativa em {privateMoney(brl(amount - fromNow), hidden)}. Confira o valor.
          </p>
        )}
        <PrimaryButton type="submit" loading={pending === 'save'}>
          {existing ? 'Salvar' : 'Mover'}
        </PrimaryButton>
      </form>
    </Sheet>
  )
}

/* ------------------------------------------------------------ Conferir saldo / fatura */

type ReconcileChoice = 'rendimento' | 'tarifa' | 'esqueci' | 'naosei'

/**
 * Conferir com o banco. A pessoa digita o valor real; o Okiva mostra a diferença desde a última
 * conferência e ajuda a explicar: rendimento, juros/tarifa, algo esquecido ou "não sei" (ajuste
 * neutro, fora de teto e relatórios). Sempre registra a data da conferência.
 */
export function ReconcileSheet({ close, accountId, cardId }: { close: () => void; accountId?: string; cardId?: string }) {
  const { state, dispatch } = useStore()
  const { openSheet } = useUI()
  const { run, pending } = useMutation()
  const hidden = state.hideBalance
  const today = todayISO()
  const account = accountId ? state.accounts.find((a) => a.id === accountId) : undefined
  const card = cardId ? state.cards.find((c) => c.id === cardId) : undefined
  const current = account ? accountBalance(state, account.id) : (card?.invoice ?? 0)
  const lastOn = account?.reconciledOn ?? card?.reconciledOn
  const [real, setReal] = useState<number | null>(null)
  const [typed, setTyped] = useState(0)
  const diff = real === null ? 0 : Math.round((real - current) * 100) / 100
  const label = account ? accountLabel(state, account.id) : card ? `${card.nickname} •• ${card.last4}` : ''
  const money = (n: number) => privateMoney(brl(n), hidden)

  if (!account && !card) return null

  /** Grava a data da conferência. Devolve o que aplicar no estado (aplicado DEPOIS do lançamento). */
  async function markChecked(value: number): Promise<() => void> {
    if (account) {
      const a = await accountsApi.update({ ...account, reconciledOn: today, reconciledBalance: value })
      return () => dispatch({ type: 'saveAccount', account: a })
    }
    // Só a data: a fatura local recebe o lançamento pelo addTx logo depois (o banco já o incluiu)
    const c = await cardsApi.update({ ...card!, reconciledOn: today, reconciledBalance: value })
    return () => dispatch({ type: 'saveCard', card: { ...c, invoice: card!.invoice } })
  }

  async function choose(choice: ReconcileChoice) {
    if (real === null) return
    if (choice === 'esqueci') {
      // Abre o formulário normal; a conferência fica para depois de lançar
      openSheet({ type: 'add', kind: (account ? diff > 0 : diff < 0) ? 'income' : 'expense' })
      return
    }
    const abs = Math.abs(diff)
    let tx: Omit<Transaction, 'id'>
    if (choice === 'rendimento') {
      tx = { kind: 'income', name: 'Rendimento', category: 'receita_rendimentos', method: { type: 'pix' }, accountId: account!.id, date: today, amount: abs, source: 'manual' }
    } else if (choice === 'tarifa') {
      tx = card
        ? { kind: 'expense', name: 'Juros ou tarifa', category: null, method: { type: 'card', cardId: card.id }, date: today, amount: abs, source: 'manual' }
        : { kind: 'expense', name: 'Tarifa ou juros', category: null, method: { type: 'pix' }, accountId: account!.id, date: today, amount: abs, source: 'manual' }
    } else {
      tx = card
        ? { kind: 'adjustment', name: 'Ajuste da fatura', category: null, method: { type: 'card', cardId: card.id }, date: today, amount: diff, source: 'manual' }
        : { kind: 'adjustment', name: 'Ajuste de saldo', category: null, method: { type: 'pix' }, accountId: account!.id, date: today, amount: diff, source: 'manual' }
    }
    const ok = await run(
      'save',
      async () => {
        const saved = await transactionsApi.create(tx)
        const applyCheck = await markChecked(real)
        return { saved, applyCheck }
      },
      ({ saved, applyCheck }) => {
        // Primeiro a data (com a fatura de antes), depois o lançamento soma uma vez só
        applyCheck()
        dispatch({ type: 'addTx', tx: saved })
      },
      choice === 'rendimento' ? 'Rendimento lançado · conferido hoje' : choice === 'tarifa' ? 'Lançado · classifique a categoria depois' : 'Ajuste lançado · conferido hoje',
    )
    if (ok) close()
  }

  async function allGood() {
    if (await run('save', () => markChecked(current), (apply) => apply(), 'Tudo certo · conferido hoje')) close()
  }

  const options: { id: ReconcileChoice; title: string; text: string }[] = []
  if (real !== null && diff !== 0) {
    const up = diff > 0
    if (account) {
      const rend = { id: 'rendimento' as const, title: 'Rendimento', text: `Entra como receita "Rendimentos" de ${money(Math.abs(diff))}.` }
      const tar = { id: 'tarifa' as const, title: 'Tarifa ou juros', text: `Entra como gasto de ${money(Math.abs(diff))} (sem categoria, para você classificar).` }
      if (up) options.push(rend)
      else options.push(tar)
    } else {
      if (up) options.push({ id: 'tarifa', title: 'Juros ou tarifa', text: `Entra como gasto de ${money(Math.abs(diff))} no cartão (sem categoria, para você classificar).` })
    }
    options.push({ id: 'esqueci', title: 'Algo que esqueci de lançar', text: 'Abre o formulário para lançar direito. Depois, confira de novo.' })
    options.push({
      id: 'naosei',
      title: 'Não sei',
      text: `Cria um "Ajuste" de ${up ? '+' : '−'} ${money(Math.abs(diff))} no extrato. Não conta como gasto nem receita; dá para apagar depois.`,
    })
  }

  return (
    <Sheet title={card ? 'Conferir fatura' : 'Conferir saldo'} onClose={close}>
      <div className="flex flex-col gap-5">
        <p className="-mt-2 font-sat text-[13px] leading-[1.45] text-esk-muted">
          {label} · no Okiva: <span className="text-white">{money(current)}</span>
          {lastOn ? ` · última conferência em ${longDate(lastOn)}` : ' · nunca conferido'}
        </p>
        {real === null ? (
          <form
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault()
              setReal(typed)
            }}
          >
            <Field label={card ? 'Quanto está a fatura no app do banco?' : 'Quanto está no app do banco?'} htmlFor="rec-real">
              <MoneyInput id="rec-real" value={typed} onChange={setTyped} large autoFocus />
            </Field>
            <PrimaryButton type="submit">Conferir</PrimaryButton>
          </form>
        ) : diff === 0 ? (
          <div className="flex animate-rise flex-col gap-4">
            <p className="rounded-[18px] bg-esk-lime/10 px-4 py-3 font-sat text-[15px] text-esk-lime ring-1 ring-esk-lime/30">Bateu certinho. Tudo certo!</p>
            <PrimaryButton onClick={allGood} loading={pending === 'save'}>
              Marcar como conferido
            </PrimaryButton>
          </div>
        ) : (
          <div className="flex animate-rise flex-col gap-4">
            <p className="font-sat text-[15px] leading-[1.45] text-white">
              {card ? 'A fatura no banco está' : 'O banco tem'} <span className={diff > 0 ? 'text-esk-positive' : 'text-esk-negative'}>{money(Math.abs(diff))} {diff > 0 ? 'a mais' : 'a menos'}</span>
              {lastOn ? ` desde ${longDate(lastOn)}` : ''}. O que pode ser?
            </p>
            <ul className="flex flex-col gap-2">
              {options.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    disabled={!!pending}
                    onClick={() => choose(o.id)}
                    className="flex w-full items-center gap-3 rounded-[20px] bg-esk-elevated px-4 py-3 text-left ring-1 ring-esk-track transition hover:bg-esk-hover disabled:opacity-50"
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
                      <span className="font-sat text-[15px] font-medium text-white">{o.title}</span>
                      <span className="font-sat text-[12px] leading-[1.4] text-esk-subtle">{o.text}</span>
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-esk-subtle" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => setReal(null)} className="self-start font-sat text-[14px] font-medium text-esk-muted hover:text-white">
              Digitar outro valor
            </button>
          </div>
        )}
      </div>
    </Sheet>
  )
}

/* ------------------------------------------------------------ Recorrência */

export function RecurrenceSheet({ close, id }: { close: () => void; id: string }) {
  const { state, dispatch } = useStore()
  const { run, pending } = useMutation()
  const hidden = state.hideBalance
  const today = todayISO()
  const rec = useLast(state.recurrences.find((r) => r.id === id))
  const [amount, setAmount] = useState(rec?.amount ?? 0)
  const [name, setName] = useState(rec?.name ?? '')
  const [category, setCategory] = useState<CategoryId>(rec?.category ?? 'outros')
  const [method, setMethod] = useState(rec ? methodKey(rec.method) : 'pix')
  const [accountId, setAccountId] = useState(rec?.accountId ?? state.accounts[0]?.id ?? '')
  const [day, setDay] = useState(String(rec?.day ?? 1))
  const [confirmDelete, setConfirmDelete] = useState(false)
  if (!rec) return null
  const isIncome = rec.kind === 'income'
  const ended = !!rec.endDate && rec.endDate < today
  const next = nextDate(rec, today)
  const generated = state.transactions.filter((t) => t.recurrenceId === rec.id).length
  const dayNum = Number(day)
  const validDay = dayNum >= 1 && dayNum <= 31
  const onCard = !isIncome && method.startsWith('card:')

  async function save(patch: Partial<Recurrence> = {}, message = 'Recorrência atualizada') {
    if (!rec || amount <= 0 || !validDay) return false
    const updated: Recurrence = {
      ...rec,
      name: name.trim() || rec.name,
      amount,
      category,
      method: isIncome ? { type: 'pix' } : keyToMethod(method),
      accountId: isIncome || !onCard ? accountId || undefined : undefined,
      day: dayNum,
      ...patch,
    }
    return run('save', () => recurrencesApi.update(updated, state), (snapshot) => dispatch({ type: 'sync', snapshot }), message)
  }

  const remove = async () => {
    if (await run('delete', () => recurrencesApi.remove(rec.id), () => dispatch({ type: 'deleteRecurrence', id: rec.id }), 'Recorrência apagada', 'Não deu para apagar. Tente de novo.')) close()
  }

  return (
    <Sheet title={isIncome ? 'Receita recorrente' : 'Gasto recorrente'} onClose={close}>
      <form className="flex flex-col gap-5" onSubmit={async (e) => { e.preventDefault(); if (await save()) close() }}>
        <p className="flex items-center gap-2 rounded-[18px] bg-esk-elevated px-4 py-3 font-sat text-[13px] text-esk-muted">
          <Repeat size={15} className={ended ? '' : 'text-esk-lime'} aria-hidden />
          {ended ? `Encerrada em ${longDate(rec.endDate!)}` : next ? `Próxima: ${longDate(next)}` : 'Sem próximas datas'}
          {generated > 0 && ` · ${generated} ${generated === 1 ? 'lançamento feito' : 'lançamentos feitos'}`}
        </p>
        <Field label="Valor" htmlFor="ramount">
          <MoneyInput id="ramount" value={amount} onChange={setAmount} large />
        </Field>
        <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-3">
          <Field label="Descrição" htmlFor="rname">
            <input id="rname" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          </Field>
          <Field label="Todo dia" htmlFor="rday" error={validDay ? undefined : '1 a 31'}>
            <input id="rday" inputMode="numeric" className={inputClass} value={day} onChange={(e) => setDay(e.target.value.replace(/\D/g, '').slice(0, 2))} />
          </Field>
        </div>
        {dayNum > 28 && validDay && <p className="-mt-3 font-sat text-[12px] text-esk-subtle">Em meses mais curtos, cai no último dia.</p>}
        {isIncome ? (
          <>
            <Field label="Origem">
              <div className="flex flex-wrap gap-2">
                {INCOME_SOURCES.map((s) => (
                  <Chip key={s.id} active={category === s.id} onClick={() => setCategory(s.id)}>
                    {s.label}
                  </Chip>
                ))}
              </div>
            </Field>
            <Field label="Recebe em">
              <AccountChips value={accountId} onChange={setAccountId} accounts={state.accounts} />
            </Field>
          </>
        ) : (
          <>
            <Field label="Categoria">
              <div className="flex flex-wrap gap-2">
                {categoryIds(state).map((c) => (
                  <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
                    {categoryMeta(state, c).label}
                  </Chip>
                ))}
              </div>
            </Field>
            <Field label="Pagamento">
              <div className="flex flex-wrap gap-2">
                {state.cards.map((c) => (
                  <Chip key={c.id} active={method === `card:${c.id}`} onClick={() => setMethod(`card:${c.id}`)}>
                    {c.nickname}
                  </Chip>
                ))}
                <Chip active={method === 'pix'} onClick={() => setMethod('pix')}>
                  Pix
                </Chip>
                <Chip active={method === 'cash'} onClick={() => setMethod('cash')}>
                  Dinheiro
                </Chip>
              </div>
            </Field>
            {!onCard && state.accounts.length > 1 && (
              <Field label="Sai da conta">
                <AccountChips value={accountId} onChange={setAccountId} accounts={state.accounts} />
              </Field>
            )}
          </>
        )}
        <p className="font-sat text-[12px] text-esk-subtle">
          As mudanças valem para os próximos meses. Os lançamentos já feitos ({privateMoney(brlShort(rec.amount), hidden)}) continuam; edite cada um no extrato se precisar.
        </p>
        <PrimaryButton type="submit" loading={pending === 'save'} disabled={amount <= 0 || !validDay}>
          Salvar recorrência
        </PrimaryButton>
        {!ended && (
          <PrimaryButton
            tone="dark"
            loading={pending === 'end'}
            loadingText="Encerrando…"
            onClick={async () => {
              // Ainda não começou: não há o que guardar, então apaga
              if (rec.startDate > today) return remove()
              const ok = await run('end', () => recurrencesApi.update({ ...rec, endDate: today }, state), (snapshot) => dispatch({ type: 'sync', snapshot }), 'Recorrência encerrada')
              if (ok) close()
            }}
          >
            Encerrar a partir de hoje
          </PrimaryButton>
        )}
        <ConfirmDelete
          open={confirmDelete}
          onOpen={() => setConfirmDelete(true)}
          onCancel={() => setConfirmDelete(false)}
          label="Apagar recorrência"
          question="Apagar a recorrência? Os lançamentos já feitos continuam no extrato."
          loading={pending === 'delete'}
          onConfirm={remove}
        />
      </form>
    </Sheet>
  )
}

/* ------------------------------------------------------------ Aviso do teto */

const ALERT_STEPS = [50, 70, 80, 90, 100]

export function CapAlertSheet({ close, category }: { close: () => void; category: CategoryId }) {
  const { state, dispatch } = useStore()
  const { run, pending } = useMutation()
  const hidden = state.hideBalance
  const current = capAlert(state, category)
  const [enabled, setEnabled] = useState(current.enabled)
  const [percent, setPercent] = useState(current.percent)
  const cap = state.budget.caps[category] ?? 0
  const label = categoryMeta(state, category).label

  return (
    <Sheet title={`Aviso de ${label}`} onClose={close}>
      <form
        className="flex flex-col gap-5"
        onSubmit={async (e) => {
          e.preventDefault()
          const ok = await run(
            'save',
            () => budgetApi.setCapAlert(category, { enabled, percent }),
            (r) => dispatch({ type: 'setCapAlert', category: r.category, alert: r.alert }),
            enabled ? `Aviso de ${label} em ${percent}%` : `Aviso de ${label} desligado`,
          )
          if (ok) close()
        }}
      >
        <div className="flex items-center justify-between gap-4 rounded-[20px] bg-esk-elevated px-4 py-3 ring-1 ring-esk-track">
          <div>
            <p className="font-sat text-[15px] font-medium text-white">Avisar perto do teto</p>
            <p className="font-sat text-[12px] text-esk-muted">Desligue em gastos fixos, como aluguel, que sempre chegam a 100%.</p>
          </div>
          <Switch checked={enabled} onChange={setEnabled} label="Avisar perto do teto" />
        </div>
        {enabled && (
          <Field label="Avisar ao chegar em">
            <div className="flex flex-wrap gap-2">
              {ALERT_STEPS.map((p) => (
                <Chip key={p} active={percent === p} onClick={() => setPercent(p)}>
                  {p}%
                </Chip>
              ))}
            </div>
            {cap > 0 && (
              <p className="font-sat text-[13px] text-esk-muted">
                Você vê o aviso ao lançar um gasto que leve {label} a {privateMoney(brlShort((cap * percent) / 100), hidden)} de {privateMoney(brlShort(cap), hidden)} no mês, inclusive parcelas.
              </p>
            )}
          </Field>
        )}
        <PrimaryButton type="submit" loading={pending === 'save'}>
          Salvar aviso
        </PrimaryButton>
      </form>
    </Sheet>
  )
}


/* --------------------------------------------- Classificar sem categoria */

/**
 * Fila de gastos sem categoria: um por vez, um toque escolhe a categoria e passa para o próximo.
 * "Sempre usar para este nome" salva a regra e já classifica os outros pendentes com o mesmo nome.
 */
export function CategorizeSheet({ close, id }: { close: () => void; id?: string }) {
  const { state, dispatch } = useStore()
  const { notify } = useUI()
  const { run, pending } = useMutation()
  const hidden = state.hideBalance
  const queue = uncategorized(state)
  const [skipped, setSkipped] = useState<string[]>([])
  const [remember, setRemember] = useState(true)
  const [done, setDone] = useState(0)
  // Aberto por um lançamento específico: ele vem primeiro
  const first = id ? queue.find((t) => t.id === id || (t.installment && t.installment.group === state.transactions.find((x) => x.id === id)?.installment?.group)) : undefined
  const current = first && !skipped.includes(first.id) ? first : queue.find((t) => !skipped.includes(t.id))
  const total = queue.length

  if (!current) {
    return (
      <Sheet title="Tudo classificado" onClose={close}>
        <div className="flex flex-col gap-5">
          <p className="font-sat text-[15px] text-esk-muted">
            {done > 0 ? `${done} ${done === 1 ? 'gasto classificado' : 'gastos classificados'}. ` : ''}
            {total > 0 ? `Ainda ${total === 1 ? 'falta 1 gasto que você pulou' : `faltam ${total} gastos que você pulou`}.` : 'Nenhum gasto sem categoria.'}
          </p>
          {total > 0 && (
            <PrimaryButton tone="dark" onClick={() => setSkipped([])}>
              Rever os pulados
            </PrimaryButton>
          )}
          <PrimaryButton onClick={close}>Fechar</PrimaryButton>
        </div>
      </Sheet>
    )
  }

  const key = normalizeLabel(current.name)
  const sameName = queue.filter((t) => t.id !== current.id && normalizeLabel(t.name) === key)
  const groupIds = (t: Transaction) => (t.installment ? installmentGroup(state, t.installment.group).map((x) => x.id) : [t.id])
  const existingRule = state.categoryRules.find((r) => r.pattern === key)

  async function choose(category: CategoryId) {
    const ids = [...groupIds(current!), ...(remember ? sameName.flatMap(groupIds) : [])]
    const label = categoryMeta(state, category).label
    const ok = await run(
      'save',
      async () => {
        await categoriesApi.recategorize(ids, category)
        return remember ? await rulesApi.save(current!.name, category, existingRule?.id) : null
      },
      (rule) => {
        dispatch({ type: 'recategorize', ids, category })
        if (rule) dispatch({ type: 'saveRule', rule })
      },
    )
    if (ok) {
      const count = 1 + (remember ? sameName.length : 0)
      setDone((n) => n + count)
      notify(remember && sameName.length ? `${count} gastos "${current!.name}" em ${label}` : `${current!.name} em ${label}`)
    }
  }

  const position = total - queue.filter((t) => !skipped.includes(t.id)).length + 1

  return (
    <Sheet title="Sem categoria" onClose={close}>
      <div className="flex flex-col gap-5">
        <p className="-mt-3 font-sat text-[13px] text-esk-muted">
          {total === 1 ? '1 gasto para classificar' : `${Math.min(position, total)} de ${total} para classificar`}
        </p>
        <div className="flex items-center gap-4 rounded-[24px] bg-esk-elevated p-4">
          <span className="grid size-[48px] shrink-0 place-items-center rounded-full bg-esk-row">
            <CategoryRowIcon category={null} size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-sat text-[16px] font-medium text-white">{current.name}</p>
            <p className="font-sat text-[12px] text-esk-subtle">
              {longDate(current.date)} · {methodLabel(state, current)}
              {current.installment ? ` · ${current.installment.total}x` : ''}
              {current.source === 'fatura' ? ' · fatura' : ''}
            </p>
          </div>
          <p className="shrink-0 font-sat text-[18px] font-medium text-esk-negative">{privateExpense(current.installment ? installmentGroup(state, current.installment.group).reduce((s, t) => s + t.amount, 0) : current.amount, hidden)}</p>
        </div>
        <Field label="Qual é a categoria?">
          <div className="flex flex-wrap gap-2">
            {categoryIds(state).map((c) => (
              <Chip key={c} active={false} onClick={() => !pending && choose(c)}>
                {categoryMeta(state, c).label}
              </Chip>
            ))}
          </div>
        </Field>
        <div className="flex items-center justify-between gap-4 rounded-[20px] bg-esk-elevated px-4 py-3 ring-1 ring-esk-track">
          <div className="min-w-0">
            <p className="font-sat text-[15px] font-medium text-white">Sempre usar para esse nome</p>
            <p className="font-sat text-[12px] leading-[1.35] text-esk-muted">
              As próximas faturas já entram classificadas
              {sameName.length ? ` · também classifica ${sameName.length === 1 ? 'outro gasto igual' : `outros ${sameName.length} gastos iguais`}` : ''}.
            </p>
          </div>
          <Switch checked={remember} onChange={setRemember} label="Sempre usar para esse nome" />
        </div>
        <PrimaryButton tone="dark" disabled={!!pending} onClick={() => setSkipped((s) => [...s, current.id])}>
          Pular por enquanto
        </PrimaryButton>
      </div>
    </Sheet>
  )
}

/* ------------------------------------------------- Detalhe do relatório */

/** Lista dos lançamentos que formam um valor do relatório (toque numa fatia, barra ou mês). */
export function ReportDetailSheet({
  close,
  title,
  subtitle,
  ids,
  category,
}: {
  close: () => void
  title: string
  subtitle?: string
  ids: string[]
  category?: CategoryId | null
}) {
  const { state } = useStore()
  const { openSheet } = useUI()
  const hidden = state.hideBalance
  const today = todayISO()
  const set = new Set(ids)
  const allTxs = state.transactions.filter((t) => set.has(t.id)).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  const [query, setQuery] = useState('')
  const searching = query.trim().length > 0
  const txs = searchTransactions(state, allTxs, query)
  const [all, setAll] = useState(false)
  const shown = all ? txs : txs.slice(0, 30)

  return (
    <Sheet title={title} onClose={close}>
      <div className="flex flex-col gap-4">
        {subtitle && <p className="-mt-3 font-sat text-[13px] text-esk-muted">{subtitle}</p>}
        {category !== undefined && (
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new CustomEvent(REPORTS_EVENT, { detail: { tab: 'onde', category } }))
              close()
            }}
            className="flex items-center justify-between gap-3 rounded-[18px] bg-esk-elevated px-4 py-3 text-left font-sat text-[14px] font-medium text-esk-lime-soft ring-1 ring-esk-track hover:bg-esk-hover"
          >
            Ver onde gastei nesta categoria
            <ChevronRight size={16} aria-hidden />
          </button>
        )}
        {allTxs.length > 5 && (
          <div className="flex flex-col gap-2">
            <SearchField value={query} onChange={setQuery} label={`Buscar em ${title}`} />
            {searching && <SearchSummary txs={txs} hidden={hidden} />}
          </div>
        )}
        {searching && txs.length === 0 && (
          <p className="font-sat text-[13px] text-esk-muted">Tente parte do nome, um valor (45,90 ou &gt;100) ou uma data (12/11).</p>
        )}
        <ul className={cx('flex flex-col rounded-[22px] bg-esk-elevated px-3', txs.length === 0 && 'hidden')}>
          {shown.map((t, i) => {
            const k = kindOf(t)
            return (
              <li key={t.id}>
                {i > 0 && <div className="h-px bg-esk-border" />}
                <button type="button" onClick={() => openSheet({ type: 'tx', id: t.id })} className={cx('flex w-full items-center gap-3 py-3 text-left transition hover:opacity-80', t.date > today && 'opacity-60')}>
                  <span className="w-[44px] shrink-0 font-sat text-[12px] text-esk-subtle">{t.date.slice(8, 10)}/{t.date.slice(5, 7)}</span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-sat text-[14px] font-medium text-white">{t.name}</span>
                    <span className="truncate font-sat text-[11px] text-esk-subtle">
                      {k === 'income' ? incomeLabel(t.category) : categoryMeta(state, t.category).label} · {methodLabel(state, t)}
                      {t.installment ? ` · parcela ${t.installment.number}/${t.installment.total}` : ''}
                    </span>
                  </span>
                  <span className={cx('shrink-0 font-sat text-[14px] font-medium', k === 'income' ? 'text-esk-positive' : 'text-esk-negative')}>
                    {k === 'income' ? privateIncome(t.amount, hidden) : privateExpense(t.amount, hidden)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        {txs.length > 30 && !all && (
          <button type="button" onClick={() => setAll(true)} className="self-start font-sat text-[14px] font-medium text-esk-lime">
            Ver todos ({txs.length})
          </button>
        )}
      </div>
    </Sheet>
  )
}

/* ------------------------------------------- compra parcelada em andamento */

const monthYearOf = (iso: string) => `${monthName(Number(iso.slice(5, 7)) - 1)} de ${iso.slice(0, 4)}`

/** Editar um lançamento: compra parcelada que começou antes do Okiva tem formulário próprio. */
export function EditEntrySheet({ close, id }: { close: () => void; id: string }) {
  const { state } = useStore()
  const t = state.transactions.find((x) => x.id === id)
  const ongoing = !!t?.installment && (installmentGroup(state, t.installment.group)[0]?.installment?.number ?? 1) > 1
  return ongoing ? <OngoingInstallmentSheet close={close} id={id} /> : <EntrySheet close={close} id={id} />
}

/**
 * "Compra parcelada em andamento": a pessoa copia o que está na fatura ("GELADEIRA PARC 04/10").
 * Parcelas anteriores à atual não são criadas (já foram pagas). A atual não soma de novo se já está
 * no valor da fatura informado ao cadastrar o cartão. As seguintes entram uma por mês.
 * Editar (id): nome, categoria e valor da parcela; a posição (4 de 10) e o cartão ficam.
 */
export function OngoingInstallmentSheet({ close, id, cardId: initialCard }: { close: () => void; id?: string; cardId?: string }) {
  const { state, dispatch } = useStore()
  const { openSheet } = useUI()
  const { run, pending } = useMutation()
  const hidden = state.hideBalance
  const today = todayISO()
  const existing = useLast(id ? state.transactions.find((t) => t.id === id) : undefined)
  const group = existing?.installment ? installmentGroup(state, existing.installment.group) : []
  const [name, setName] = useState(existing?.name ?? '')
  const [category, setCategory] = useState<CategoryId | null>(existing ? existing.category : null)
  const [pickedCategory, setPickedCategory] = useState(!!existing)
  const [amount, setAmount] = useState(existing?.amount ?? 0)
  const [cardId, setCardId] = useState(
    existing?.method.type === 'card' ? existing.method.cardId : (initialCard ?? state.cardOrder[state.cardOrder.length - 1] ?? state.cards[0]?.id ?? ''),
  )
  const [currentText, setCurrentText] = useState(existing?.installment ? String(existing.installment.number) : '')
  const [totalText, setTotalText] = useState(existing?.installment ? String(existing.installment.total) : '')
  const [tries, setTries] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const current = Number(currentText)
  const total = Number(totalText)
  const card = state.cards.find((c) => c.id === cardId)

  const errors = {
    name: !name.trim() ? 'Dê um nome (como aparece na fatura).' : undefined,
    amount: amount <= 0 ? 'Informe o valor de cada parcela.' : undefined,
    card: !card ? 'Escolha o cartão.' : undefined,
    position: existing
      ? undefined
      : !(total >= 2 && total <= MAX_INSTALLMENTS)
        ? `O total de parcelas vai de 2 a ${MAX_INSTALLMENTS}.`
        : !(current >= 1 && current <= total)
          ? `A parcela atual vai de 1 a ${total}.`
          : undefined,
  }
  const valid = !Object.values(errors).some(Boolean)
  const show = (e?: string) => (tries ? e : undefined)

  // O que acontece com cada parcela (só ao criar)
  const inInvoice = currentAlreadyInInvoice(card, today)
  const ready = !existing && !errors.position && current > 0 && total > 0
  const lastDate = ready ? addMonths(today, total - current) : ''
  const plan: string[] = []
  if (ready) {
    if (current > 1) plan.push(current === 2 ? 'Parcela 1: já paga, fica de fora.' : `Parcelas 1 a ${current - 1}: já pagas, ficam de fora.`)
    plan.push(
      inInvoice
        ? `Parcela ${current}: já está na fatura que você informou ao cadastrar o cartão. Não soma de novo.`
        : `Parcela ${current}: entra na fatura deste mês.`,
    )
    if (current < total)
      plan.push(
        current + 1 === total
          ? `Parcela ${total}: entra em ${monthYearOf(lastDate)}.`
          : `Parcelas ${current + 1} a ${total}: uma por mês, até ${monthYearOf(lastDate)}.`,
      )
  }

  async function save() {
    setTries((n) => n + 1)
    if (!valid || !card) return
    const label = name.trim()
    if (existing?.installment) {
      const g = existing.installment.group
      const ok = await run(
        'save',
        () => installmentsApi.updateGroup(g, { name: label, category, amount }, state),
        (snapshot) => dispatch({ type: 'sync', snapshot }),
        'Compra parcelada atualizada',
      )
      if (ok) close()
      return
    }
    const ok = await run(
      'save',
      () => installmentsApi.saveOngoing({ name: label, category, cardId: card.id, amount, current, total }, state),
      (snapshot) => dispatch({ type: 'sync', snapshot }),
      current < total ? `${label}: próximas ${total - current} parcelas lançadas` : `${label} registrada`,
    )
    if (ok) close()
  }

  const numberInput =
    'h-[52px] w-[64px] rounded-[18px] bg-esk-elevated text-center font-sat text-[16px] text-white outline-none ring-1 ring-esk-track placeholder:text-esk-subtle focus:ring-esk-lime'

  return (
    <Sheet title={existing ? 'Compra parcelada' : 'Compra parcelada em andamento'} onClose={existing ? () => openSheet({ type: 'tx', id: existing.id }) : close}>
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        {!existing && (
          <p className="-mt-2 font-sat text-[13px] leading-[1.45] text-esk-muted">
            Para compras feitas antes de usar o Okiva. Copie da fatura: <span className="text-white">“GELADEIRA PARC 04/10”</span> é a parcela 4 de 10.
          </p>
        )}
        <Field label="Nome" htmlFor="ong-name" error={show(errors.name)} attempt={tries}>
          <input
            id="ong-name"
            className={inputClass}
            placeholder="Geladeira, notebook…"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (!pickedCategory) setCategory(ruleFor(state, e.target.value) ?? null)
            }}
            maxLength={40}
            autoFocus={!existing}
          />
        </Field>
        <Field label="Valor de cada parcela" htmlFor="ong-amount" error={show(errors.amount)} attempt={tries}>
          <MoneyInput id="ong-amount" value={amount} onChange={setAmount} />
        </Field>
        {existing?.installment ? (
          <p className="rounded-[18px] bg-esk-elevated px-4 py-3 font-sat text-[13px] text-esk-muted">
            Parcela {existing.installment.number} de {existing.installment.total} · {card ? `${card.nickname} •• ${card.last4}` : 'Cartão'} · começou antes do Okiva
          </p>
        ) : (
          <>
            <Field label="Parcela deste mês" error={show(errors.position)} attempt={tries}>
              <div className="flex items-center gap-3 font-sat text-[15px] text-esk-muted">
                <input
                  aria-label="Parcela atual"
                  inputMode="numeric"
                  placeholder="4"
                  className={numberInput}
                  value={currentText}
                  onChange={(e) => setCurrentText(e.target.value.replace(/\D/g, '').slice(0, 2))}
                />
                de
                <input
                  aria-label="Total de parcelas"
                  inputMode="numeric"
                  placeholder="10"
                  className={numberInput}
                  value={totalText}
                  onChange={(e) => setTotalText(e.target.value.replace(/\D/g, '').slice(0, 2))}
                />
              </div>
            </Field>
            {state.cards.length > 1 && (
              <Field label="Cartão" error={show(errors.card)} attempt={tries}>
                <div className="flex flex-wrap gap-2">
                  {state.cards.map((c) => (
                    <Chip key={c.id} active={cardId === c.id} onClick={() => setCardId(c.id)}>
                      {c.nickname}
                    </Chip>
                  ))}
                </div>
              </Field>
            )}
          </>
        )}
        <Field label="Categoria">
          <div className="flex flex-wrap gap-2">
            {categoryIds(state).map((c) => (
              <Chip
                key={c}
                active={category === c}
                onClick={() => {
                  setCategory(c)
                  setPickedCategory(true)
                }}
              >
                {categoryMeta(state, c).label}
              </Chip>
            ))}
            <Chip
              active={category === null}
              dashed={category !== null}
              onClick={() => {
                setCategory(null)
                setPickedCategory(true)
              }}
            >
              Decidir depois
            </Chip>
          </div>
        </Field>
        {plan.length > 0 && (
          <ul className="flex animate-rise flex-col gap-1 rounded-[18px] bg-esk-elevated px-4 py-3 font-sat text-[13px] leading-[1.45] text-esk-muted">
            {plan.map((line) => (
              <li key={line}>{line}</li>
            ))}
            {amount > 0 && <li className="pt-1 text-white">Total da compra: {privateMoney(brl(Math.round(amount * total * 100) / 100), hidden)}</li>}
          </ul>
        )}
        <PrimaryButton type="submit" loading={pending === 'save'}>
          {existing ? 'Salvar' : 'Adicionar compra parcelada'}
        </PrimaryButton>
        {existing?.installment && (
          <ConfirmDelete
            open={confirmDelete}
            onOpen={() => setConfirmDelete(true)}
            onCancel={() => setConfirmDelete(false)}
            label="Apagar compra"
            question={`Apagar a compra? As ${group.length} parcelas lançadas no Okiva saem de todos os meses.`}
            loading={pending === 'delete'}
            onConfirm={async () => {
              const g = existing.installment!.group
              if (await run('delete', () => installmentsApi.remove(g), () => dispatch({ type: 'deleteGroup', group: g }), 'Compra apagada', 'Não deu para apagar. Tente de novo.')) close()
            }}
          />
        )}
      </form>
    </Sheet>
  )
}
