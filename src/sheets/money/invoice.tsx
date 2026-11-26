/**
 * Cartão: pagar fatura (com aviso de pagamento a mais), adiantar parcelas e compra parcelada de antes do Okiva.
 */
import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { categoryIds, categoryMeta } from '../../data/categories'
import { Chip, Field, inputClass, MoneyInput, PrimaryButton, Sheet } from '../../components/ui'
import { brl, isValidDate, MIN_DATE, monthName, parseISO, privateMoney } from '../../lib/format'
import { addMonths, anticipateInstallments, currentAlreadyInInvoice, futureCardInstallments, installmentGroup, invoiceCredit, invoiceDue, round2 } from '../../lib/ledger'
import { accountBalance, accountName, cardLabel, cardShort, ruleFor, todayISO, useStore } from '../../state/store'
import { installmentsApi, transactionsApi } from '../../services/finance'
import { useMutation } from '../../state/useMutation'
import { useUI } from '../../state/ui'
import type { CategoryId, Transaction } from '../../types'
import { AccountChips, ConfirmDelete, MAX_INSTALLMENTS, monthYearOf, useLast } from './common'

export function AnticipateSheet({ close, group }: { close: () => void; group: string }) {
  const { state, dispatch } = useStore()
  const { run, pending } = useMutation()
  const hidden = state.hideBalance
  const today = todayISO()
  const all = installmentGroup(state, group)
  const future = useLast(futureCardInstallments(all, today))
  const [count, setCount] = useState(1)
  const [discount, setDiscount] = useState(0)
  const [tries, setTries] = useState(0)
  if (!future || future.length === 0) return null
  const n = future.length
  const k = Math.min(count, n)
  const picked = future.slice(0, k)
  const gross = Math.round(picked.reduce((sum, t) => sum + t.amount, 0) * 100) / 100
  const net = Math.round((gross - discount) * 100) / 100
  const first = all[0]
  const card = first?.method.type === 'card' ? state.cards.find((c) => c.id === (first.method as { cardId: string }).cardId) : undefined
  const total = all[0]?.installment?.total ?? 0
  const numbers = picked.map((t) => t.installment?.number ?? 0).sort((a, b) => a - b)
  const range = numbers.length === 1 ? `Parcela ${numbers[0]}` : `Parcelas ${numbers[0]} a ${numbers[numbers.length - 1]}`
  // Depois de adiantar, a compra termina na última parcela que sobrou no futuro
  const stillFuture = future.slice(k)
  const endsOn = stillFuture.length ? stillFuture.reduce((a, b) => (a.date > b.date ? a : b)).date : null
  const endsLabel = endsOn ? `${monthName(parseISO(endsOn).getMonth())} de ${parseISO(endsOn).getFullYear()}` : null
  const discountError = tries > 0 && discount >= gross ? 'O desconto precisa ser menor que o valor das parcelas.' : undefined

  async function save() {
    setTries((x) => x + 1)
    if (discount >= gross) return
    const preview = anticipateInstallments(all, k, discount, today)
    if (preview.length !== k) return
    const ok = await run(
      'save',
      () => installmentsApi.anticipate(group, k, discount, today, state),
      (txs) => txs.forEach((tx) => dispatch({ type: 'updateTx', tx })),
      `${privateMoney(brl(net), hidden)} entraram na fatura${card ? ` ${cardShort(card)}` : ''}`,
    )
    if (ok) close()
  }

  return (
    <Sheet title="Adiantar parcelas" onClose={close}>
      <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); save() }}>
        <div>
          <p className="font-sat text-[17px] font-medium text-white">{first?.name}</p>
          <p className="pt-1 font-sat text-[13px] text-esk-muted">
            {card ? `${cardLabel(card)} · ` : ''}
            {n === 1 ? 'Falta 1 parcela' : `Faltam ${n} parcelas`} de {total}
          </p>
        </div>
        <Field label="Quantas parcelas adiantar">
          <div className="flex items-center gap-3">
            <div className="flex h-[44px] items-center gap-1 rounded-[22px] bg-esk-elevated px-1 ring-1 ring-esk-track">
              <button type="button" aria-label="Menos uma parcela" onClick={() => setCount((x) => Math.max(1, Math.min(x, n) - 1))} className="grid size-[36px] place-items-center rounded-full text-white hover:bg-white/5 disabled:opacity-30" disabled={k <= 1}>
                <Minus size={15} />
              </button>
              <span className="min-w-[28px] text-center font-sat text-[17px] font-medium text-white" aria-live="polite">{k}</span>
              <button type="button" aria-label="Mais uma parcela" onClick={() => setCount((x) => Math.min(n, x + 1))} className="grid size-[36px] place-items-center rounded-full text-white hover:bg-white/5 disabled:opacity-30" disabled={k >= n}>
                <Plus size={15} />
              </button>
            </div>
            <button type="button" onClick={() => setCount(n)} className="font-sat text-[13px] font-medium text-esk-lime-soft hover:underline">
              Todas ({n})
            </button>
          </div>
          <p className="font-sat text-[12px] text-esk-subtle">Como nos bancos: as últimas parcelas são adiantadas primeiro.</p>
        </Field>
        <Field label="Desconto do banco (opcional)" htmlFor="discount" error={discountError} attempt={tries}>
          <MoneyInput id="discount" value={discount} onChange={setDiscount} />
        </Field>
        <div className="flex flex-col gap-2 rounded-[18px] bg-esk-elevated px-4 py-3 font-sat text-[14px]">
          <p className="flex justify-between gap-3 text-esk-muted">
            <span>{range}</span>
            <span className="text-white">{privateMoney(brl(gross), hidden)}</span>
          </p>
          {discount > 0 && (
            <p className="flex justify-between gap-3 text-esk-muted">
              <span>Desconto</span>
              <span className="text-esk-positive">− {privateMoney(brl(discount), hidden)}</span>
            </p>
          )}
          <p className="flex justify-between gap-3 border-t border-esk-track pt-2 font-medium text-white">
            <span>Entra na fatura atual</span>
            <span>{privateMoney(brl(Math.max(0, net)), hidden)}</span>
          </p>
          <p className="text-[13px] leading-[1.4] text-esk-muted">
            {endsLabel ? `A compra passa a terminar em ${endsLabel}.` : 'A compra fica quitada.'} O valor conta nos gastos deste mês.
          </p>
        </div>
        <PrimaryButton type="submit" loading={pending === 'save'}>
          {k === 1 ? 'Adiantar 1 parcela' : `Adiantar ${k} parcelas`}
        </PrimaryButton>
      </form>
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
  const [amount, setAmount] = useState(existing?.amount ?? (current ? invoiceDue(current) : 0))
  const [accountId, setAccountId] = useState(existing?.accountId ?? state.accounts[0]?.id ?? '')
  const [date, setDate] = useState(existing?.date ?? today)
  const [tries, setTries] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState(false)
  if (!current && !existing) return null
  const balance = accountId ? accountBalance(state, accountId) : 0
  // Quanto a fatura pede (editando, o próprio pagamento ainda está descontado dela)
  const owed = current ? Math.max(0, round2(current.invoice + (existing && existing.method.type === 'card' && existing.method.cardId === card && existing.posted !== false ? existing.amount : 0))) : 0
  const extra = current ? round2(amount - owed) : 0

  async function save() {
    setTries((n) => n + 1)
    if (amount <= 0 || !isValidDate(date) || date > today || !card) return
    const tx: Omit<Transaction, 'id'> = {
      kind: 'invoice_payment',
      name: `Fatura ${current ? cardShort(current) : ''}`.trim(),
      category: 'outros',
      method: { type: 'card', cardId: card },
      accountId: accountId || undefined,
      date,
      amount,
      source: 'manual',
    }
    const ok = existing
      ? await run('save', () => transactionsApi.update({ ...tx, id: existing.id }), (saved) => dispatch({ type: 'updateTx', tx: saved }), 'Pagamento atualizado')
      : await run(
          'save',
          () => transactionsApi.create(tx),
          (saved) => dispatch({ type: 'addTx', tx: saved }),
          extra > 0
            ? `Fatura paga. ${privateMoney(brl(extra), hidden)} ficam de crédito para a próxima fatura`
            : `Fatura paga: ${privateMoney(brl(amount), hidden)} saiu de ${accountName(state, accountId)}`,
        )
    if (ok) close()
  }

  return (
    <Sheet title={existing ? 'Pagamento de fatura' : `Pagar fatura${current ? ` ${cardShort(current)}` : ''}`} onClose={close}>
      <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); save() }}>
        {state.cards.length > 1 && (
          <Field label="Cartão">
            <div className="flex flex-wrap gap-2">
              {state.cards.map((c) => (
                <Chip key={c.id} active={card === c.id} onClick={() => { setCard(c.id); if (!existing) setAmount(invoiceDue(c)) }}>
                  {cardShort(c)}
                </Chip>
              ))}
            </div>
          </Field>
        )}
        <Field label="Valor pago" htmlFor="pay" error={tries && amount <= 0 ? 'Digite o valor pago.' : undefined} attempt={tries}>
          <MoneyInput id="pay" value={amount} onChange={setAmount} large autoFocus />
        </Field>
        {current && !existing && extra <= 0 && (
          <p className="-mt-2 font-sat text-[13px] text-esk-muted">
            Fatura atual: {privateMoney(brl(owed), hidden)}
            {invoiceCredit(current) > 0 && ` · crédito de ${privateMoney(brl(invoiceCredit(current)), hidden)}`}
            {amount > 0 && amount < owed && ` · ficam ${privateMoney(brl(owed - amount), hidden)} em aberto`}
          </p>
        )}
        {current && extra > 0 && (
          <div role="status" className="-mt-2 rounded-[18px] bg-esk-lilac/15 px-4 py-3 font-sat text-[13px] leading-[1.45] text-esk-text-2">
            <p className="font-medium text-esk-lilac">Você está pagando mais que a fatura</p>
            <p className="pt-1">
              São {privateMoney(brl(amount), hidden)} numa fatura de {privateMoney(brl(owed), hidden)}. Os {privateMoney(brl(extra), hidden)} a mais viram
              crédito: liberam limite e, se não forem usados, viram desconto na próxima fatura.
            </p>
          </div>
        )}
        <Field label="Pago com">
          <AccountChips value={accountId} onChange={setAccountId} accounts={state.accounts} />
          {accountId && <p className="font-sat text-[12px] text-esk-subtle">Saldo da conta hoje: {privateMoney(brl(balance), hidden)}</p>}
        </Field>
        <Field label="Data" htmlFor="paydate" error={tries && !isValidDate(date) ? 'Confira a data.' : tries && date > today ? 'A data não pode ser no futuro.' : undefined} attempt={tries}>
          <input id="paydate" type="date" className={inputClass} value={date} min={MIN_DATE} max={today} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <p className="rounded-[18px] bg-esk-elevated px-4 py-3 font-sat text-[13px] leading-[1.4] text-esk-muted">
          Os gastos no cartão já contaram no mês de cada compra. Pagar a fatura tira o dinheiro do saldo e não conta de novo no teto.
        </p>
        <PrimaryButton type="submit" loading={pending === 'save'}>
          {extra > 0 ? 'Pagar mesmo assim' : existing ? 'Salvar alterações' : 'Confirmar pagamento'}
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
            Parcela {existing.installment.number} de {existing.installment.total} · {card ? cardLabel(card) : 'Cartão'} · começou antes do Okiva
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
                      {cardShort(c)}
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
