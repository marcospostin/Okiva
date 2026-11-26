/**
 * Lançamentos: adicionar/editar gasto ou receita (à vista, parcelado, recorrente) e o detalhe do lançamento.
 */
import { useState } from 'react'
import { ArrowLeftRight, BellRing, ChevronRight, FastForward, Minus, Plus, Repeat, Scale } from 'lucide-react'
import { categoryIds, categoryMeta } from '../../data/categories'
import { CategoryRowIcon } from '../../components/icons'
import { Chip, cx, Field, inputClass, MoneyInput, PrimaryButton, Sheet } from '../../components/ui'
import { movementAmount } from '../../lib/movements'
import { brl, brlShort, isValidDate, longDate, MIN_DATE, monthKey, privateExpense, privateIncome, privateMoney } from '../../lib/format'
import { futureCardInstallments, INCOME_SOURCES, incomeLabel, installmentGroup, isIncomeSource, kindOf, splitInstallments } from '../../lib/ledger'
import { accountLabel, accountName, cardLabel, cardShort, capWarning, methodLabel, ruleFor, todayISO, useStore } from '../../state/store'
import { installmentsApi, recurrencesApi, transactionsApi } from '../../services/finance'
import { useMutation } from '../../state/useMutation'
import { useUI } from '../../state/ui'
import type { CategoryId, PaymentMethod, Transaction } from '../../types'
import { AccountChips, DetailList, KindSwitch, MAX_INSTALLMENTS, RecurringRow, keyToMethod, methodKey, monthOf, useLast } from './common'
import { OngoingInstallmentSheet } from './invoice'

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
  const canRecur = !existing
  // Recorrente e parcelado nunca juntos (a parcela some quando liga a recorrência e vice-versa)
  const parcelado = onCard && count > 1 && !(recurring && canRecur)
  const showAccount = (isIncome || !onCard) && state.accounts.length > 1
  const day = Number(date.slice(8, 10)) || 1
  const parts = parcelado && amount > 0 ? splitInstallments(amount, count) : []
  const futureDate = date > today

  const amountError = tries && amount <= 0 ? (isIncome ? 'Digite o valor recebido.' : 'Digite o valor da compra.') : tries && parcelado && Math.round(amount * 100) < count ? 'Valor pequeno demais para tantas parcelas.' : undefined
  const dateError = tries && !date ? 'Escolha a data.' : tries && !isValidDate(date) ? 'Confira a data.' : tries && futureDate && !recurring ? 'A data não pode ser no futuro. Para algo que vai acontecer, marque "Repetir todo mês".' : undefined

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
    if (amount <= 0 || !date || !isValidDate(date)) return
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
        () => {
          const input = { group: existing?.installment?.group, name: label, category, cardId, total: amount, count, firstDate: date }
          // Era um gasto comum: o banco apaga o lançamento e cria as parcelas numa operação só
          return existing && !existing.installment ? installmentsApi.replaceTx(existing.id, input, state) : installmentsApi.save(input, state)
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
        // O banco apaga as parcelas e cria o lançamento numa operação só
        () => installmentsApi.toSingle(g, tx, state),
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
                    {cardShort(c)}
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
                  <Chip active={count > 1} onClick={() => { setRecurring(false); setCount((n) => (n > 1 ? n : 2)) }}>
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
          <input id="date" type="date" className={inputClass} value={date} min={MIN_DATE} max={recurring ? undefined : today} onChange={(e) => setDate(e.target.value)} />
        </Field>

        {canRecur && (
          <RecurringRow
            kind={kind}
            checked={recurring}
            onChange={(on) => {
              setRecurring(on)
              if (on) setCount(1)
            }}
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
      [card ? 'Cartão' : 'Conta', card ? cardLabel(card) : accountLabel(state, t.accountId)],
      ['Motivo', 'Conferência com o banco'],
      ['Conta no mês?', 'Não: só corrige o valor'],
    )
  } else if (k === 'income') {
    rows.push(['Origem', incomeLabel(t.category)], ['Recebido em', accountName(state, t.accountId)])
  } else if (k === 'invoice_payment') {
    rows.push(['Cartão', card ? cardLabel(card) : t.removedCard ? `${t.removedCard} (removido)` : 'Cartão removido'], ['Pago com', accountName(state, t.accountId)])
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
          <span className="truncate">Ver {invoice.accountId ? 'extrato' : 'fatura'} {invoice.fileName}</span>
          <ChevronRight size={16} aria-hidden />
        </button>
      )}
      {t.installment && k === 'expense' && futureCardInstallments(group, today).length > 0 && (
        <button
          type="button"
          onClick={() => openSheet({ type: 'anticipate', group: t.installment!.group })}
          className="mt-3 flex w-full items-center justify-between gap-3 rounded-[20px] px-1 py-2 text-left font-sat text-[14px] font-medium text-esk-lime-soft hover:underline"
        >
          <span className="flex items-center gap-2">
            <FastForward size={15} aria-hidden /> Adiantar parcelas
          </span>
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
          {k !== 'adjustment' && !(k === 'invoice_payment' && !card) && <PrimaryButton onClick={edit}>Editar</PrimaryButton>}
        </div>
      )}
    </Sheet>
  )
}

/* ------------------------------------------------------------- Adiantar parcelas */

/** Editar um lançamento: compra parcelada que começou antes do Okiva tem formulário próprio. */
export function EditEntrySheet({ close, id }: { close: () => void; id: string }) {
  const { state } = useStore()
  const t = state.transactions.find((x) => x.id === id)
  const ongoing = !!t?.installment && (installmentGroup(state, t.installment.group)[0]?.installment?.number ?? 1) > 1
  return ongoing ? <OngoingInstallmentSheet close={close} id={id} /> : <EntrySheet close={close} id={id} />
}
