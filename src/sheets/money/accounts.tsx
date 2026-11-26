/**
 * Contas: criar/editar conta e subconta, mover dinheiro e conferir saldo ou fatura com o banco.
 */
import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { Chip, Field, inputClass, MoneyInput, PrimaryButton, Sheet } from '../../components/ui'
import { BankSuggestions } from '../../components/BankSuggestions'
import { BANK_LIST_ID } from '../../data/banks'
import { brl, isValidDate, longDate, MIN_DATE, privateMoney } from '../../lib/format'
import { ACCOUNT_KINDS } from '../../lib/ledger'
import { accountBalance, accountLabel, cardLabel, subaccounts, topAccounts, todayISO, useStore } from '../../state/store'
import { accountsApi, cardsApi, transactionsApi } from '../../services/finance'
import { useMutation } from '../../state/useMutation'
import { useUI } from '../../state/ui'
import type { Account, Transaction } from '../../types'
import { ConfirmDelete, accountOptions, useLast } from './common'

export function BankAccountSheet({ close, id, parentId }: { close: () => void; id?: string; parentId?: string }) {
  const { state, dispatch } = useStore()
  const { openSheet } = useUI()
  const { run, pending } = useMutation()
  const account = useLast(id ? state.accounts.find((a) => a.id === id) : undefined)
  const parent = state.accounts.find((a) => a.id === (account?.parentId ?? parentId))
  const isSub = !!parent
  const children = account ? subaccounts(state, account.id) : []
  const [name, setName] = useState(account?.name ?? '')
  const [nickname, setNickname] = useState(account?.nickname ?? '')
  const [kind, setKind] = useState<Account['kind']>(account?.kind ?? (isSub ? 'savings' : 'checking'))
  // Criar: quanto tem hoje. Editar: o saldo de quando começou (diferenças com o banco = Conferir saldo)
  const [balance, setBalance] = useState(account ? account.startingBalance : 0)
  const [tries, setTries] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const nameError = tries && !name.trim() ? (isSub ? 'Dê um nome à subconta.' : 'Informe o banco.') : undefined
  const otherTops = topAccounts(state).filter((a) => a.id !== account?.id)
  const nowBalance = account ? Math.round((accountBalance(state, account.id) + balance - account.startingBalance) * 100) / 100 : balance

  async function save() {
    setTries((n) => n + 1)
    if (!name.trim()) return
    const input = {
      name: name.trim(),
      ...(isSub ? {} : { nickname: nickname.trim() || undefined }),
      kind,
      startingBalance: balance,
      ...(isSub && !account ? { parentId: parent!.id } : {}),
    }
    const ok = account
      ? await run('save', () => accountsApi.update({ ...account, ...input }), (a) => dispatch({ type: 'saveAccount', account: a }), isSub ? 'Subconta atualizada' : 'Conta atualizada')
      : await run('save', () => accountsApi.create(input), (a) => dispatch({ type: 'saveAccount', account: a }), isSub ? 'Subconta criada' : 'Conta criada')
    if (ok) close()
  }

  const title = account ? (account.nickname ? `${account.name} · ${account.nickname}` : account.name) : isSub ? 'Nova subconta' : 'Nova conta'
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
        <Field label={isSub ? 'Nome' : 'Banco'} htmlFor="accname" error={nameError} attempt={tries}>
          <input
            id="accname"
            className={inputClass}
            placeholder={isSub ? 'Poupança, Caixinha viagem, Reserva…' : 'Nubank, Itaú, Inter…'}
            list={isSub ? undefined : BANK_LIST_ID}
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
          />
        </Field>
        {!isSub && (
          <>
            <BankSuggestions />
            <Field label="Apelido (opcional)" htmlFor="accnick">
              <input id="accnick" className={inputClass} placeholder="Dia a dia, Salário, Contas da casa…" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={30} />
            </Field>
          </>
        )}
        {!isSub && (
          <Field label="Tipo">
            <div className="flex flex-wrap gap-2">
              {/* Dinheiro em espécie não é oferecido (sacar é com o banco); contas antigas desse tipo continuam */}
              {ACCOUNT_KINDS.filter((k) => k.id !== 'wallet' || kind === 'wallet').map((k) => (
                <Chip key={k.id} active={kind === k.id} onClick={() => setKind(k.id)}>
                  {k.label}
                </Chip>
              ))}
            </div>
          </Field>
        )}
        <Field label={account ? 'Saldo quando começou' : 'Quanto tem nela hoje'} htmlFor="accbal">
          <MoneyInput id="accbal" value={balance} onChange={setBalance} allowNegative />
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
    date: !isValidDate(date) ? 'Confira a data.' : date > today ? 'A data não pode ser no futuro.' : undefined,
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
          <input id="tr-date" type="date" min={MIN_DATE} max={today} className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
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
  const label = account ? accountLabel(state, account.id) : card ? cardLabel(card) : ''
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
        // O lançamento já foi gravado: se só a data da conferência falhar, não desfaz nem repete o lançamento
        const applyCheck = await markChecked(real).catch(() => null)
        return { saved, applyCheck }
      },
      ({ saved, applyCheck }) => {
        // Primeiro a data (com a fatura de antes), depois o lançamento soma uma vez só
        applyCheck?.()
        dispatch({ type: 'addTx', tx: saved })
      },
      ({ applyCheck }) =>
        !applyCheck
          ? 'Lançado. A data da conferência não foi salva: confira de novo depois'
          : choice === 'rendimento'
            ? 'Rendimento lançado · conferido hoje'
            : choice === 'tarifa'
              ? 'Lançado · classifique a categoria depois'
              : 'Ajuste lançado · conferido hoje',
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
              <MoneyInput id="rec-real" value={typed} onChange={setTyped} large autoFocus allowNegative />
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
