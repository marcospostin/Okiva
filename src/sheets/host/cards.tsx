/**
 * Cartões: criar/editar cartão (banco, apelido, fatura inicial) e detalhe de uma fatura importada.
 */
import { useState } from 'react'
import { categoryMeta } from '../../data/categories'
import { cx, Field, inputClass, MoneyInput, PrimaryButton, Sheet } from '../../components/ui'
import { brl, brlShort, longDate, privateExpense, privateMoney } from '../../lib/format'
import { cardLabel, cardName, cardNickname, cardShort, useStore } from '../../state/store'
import { BankSuggestions } from '../../components/BankSuggestions'
import { BANK_LIST_ID } from '../../data/banks'
import { cardsApi, invoicesApi } from '../../services/finance'
import { useMutation } from '../../state/useMutation'
import { useUI } from '../../state/ui'
import { ConfirmDelete, useLast } from '../MoneySheets'
import { DetailRows, plural } from './common'

export function CardSheet({ close, id }: { close: () => void; id?: string }) {
  const { state, dispatch } = useStore()
  const { openSheet } = useUI()
  const { run, pending } = useMutation()
  const card = useLast(id ? state.cards.find((c) => c.id === id) : undefined)
  // Banco em destaque; apelido opcional (cartões antigos: o apelido era o nome todo)
  const [bank, setBank] = useState(card ? cardName(card) : '')
  const [nickname, setNickname] = useState(card ? (cardNickname(card) ?? '') : '')
  const [last4, setLast4] = useState(card?.last4 ?? '')
  const [limit, setLimit] = useState(card?.limit ?? 0)
  // Dados antigos (antes da fatura inicial) não têm openingInvoice: vale a fatura de então
  const savedOpening = card ? (card.openingInvoice ?? card.invoice) : 0
  const [opening, setOpening] = useState(savedOpening)
  /** Novo cartão salvo: pergunta se há compra parcelada na fatura */
  const [created, setCreated] = useState<string | null>(null)
  // Fatura depois de salvar: a inicial muda, os lançamentos continuam somando por cima
  const projected = card ? Math.max(0, Math.round((card.invoice + opening - savedOpening) * 100) / 100) : opening
  const [dueDay, setDueDay] = useState(String(card?.dueDay ?? 10))
  const [tries, setTries] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const errors = {
    bank: !bank.trim() ? 'Informe o banco do cartão.' : undefined,
    last4: !/^\d{4}$/.test(last4) ? 'Use os 4 últimos dígitos.' : undefined,
    limit: limit <= 0 ? 'Informe o limite.' : undefined,
    dueDay: !(Number(dueDay) >= 1 && Number(dueDay) <= 31) ? 'Dia entre 1 e 31.' : undefined,
  }
  const valid = !Object.values(errors).some(Boolean)
  const show = (e?: string) => (tries ? e : undefined)

  async function save() {
    setTries((n) => n + 1)
    if (!valid) return
    const input = { bank: bank.trim(), nickname: nickname.trim() || bank.trim(), last4, limit, openingInvoice: opening, dueDay: Number(dueDay) }
    if (card) {
      const ok = await run('save', () => cardsApi.update({ ...card, ...input, invoice: projected }), (saved) => dispatch({ type: 'saveCard', card: saved }), 'Cartão atualizado')
      if (ok) close()
      return
    }
    let newId = ''
    const ok = await run(
      'save',
      () => cardsApi.create(input),
      (saved) => {
        newId = saved.id
        dispatch({ type: 'saveCard', card: saved })
      },
      'Cartão adicionado',
    )
    if (ok) setCreated(newId)
  }

  if (created) {
    return (
      <Sheet title="Cartão adicionado" onClose={close}>
        <div className="flex flex-col gap-5">
          <p className="font-sat text-[15px] leading-[1.5] text-esk-muted">
            Tem alguma <span className="text-white">compra parcelada</span> nessa fatura? Cadastre agora e o Okiva lança as próximas parcelas sozinho, mês a mês.
          </p>
          <p className="rounded-[18px] bg-esk-elevated px-4 py-3 font-sat text-[13px] leading-[1.45] text-esk-subtle">
            Na fatura ela aparece como, por exemplo, <span className="text-white">“GELADEIRA PARC 04/10”</span>. A parcela deste mês já está no valor que você informou: não soma de novo.
          </p>
          <PrimaryButton onClick={() => openSheet({ type: 'ongoing', cardId: created })}>Adicionar compra parcelada</PrimaryButton>
          <button type="button" onClick={close} className="self-center font-sat text-[14px] font-medium text-esk-muted hover:text-white">
            Agora não
          </button>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet title={card ? cardShort(card) : 'Novo cartão'} onClose={close}>
      <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); save() }}>
        <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3">
          <Field label="Banco" htmlFor="bank" error={show(errors.bank)} attempt={tries}>
            <input id="bank" list={BANK_LIST_ID} autoComplete="off" className={inputClass} placeholder="Nubank, Itaú…" value={bank} onChange={(e) => setBank(e.target.value)} maxLength={30} />
            <BankSuggestions />
          </Field>
          <Field label="Final" htmlFor="last4" error={show(errors.last4)} attempt={tries}>
            <input id="last4" inputMode="numeric" className={inputClass} placeholder="4552" value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))} />
          </Field>
        </div>
        <Field label="Apelido (opcional)" htmlFor="nick">
          <input id="nick" className={inputClass} placeholder="Dia a dia, Viagens, Empresa…" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={30} />
        </Field>
        <Field label="Limite" htmlFor="limit" error={show(errors.limit)} attempt={tries}>
          <MoneyInput id="limit" value={limit} onChange={setLimit} />
        </Field>
        <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3">
          <Field label={card ? 'Fatura quando começou' : 'Fatura deste mês'} htmlFor="inv">
            <MoneyInput id="inv" value={opening} onChange={setOpening} />
          </Field>
          <Field label="Vence dia" htmlFor="due" error={show(errors.dueDay)} attempt={tries}>
            <input id="due" inputMode="numeric" className={inputClass} value={dueDay} onChange={(e) => setDueDay(e.target.value.replace(/\D/g, '').slice(0, 2))} />
          </Field>
        </div>
        <p className="-mt-2 font-sat text-[12px] leading-[1.45] text-esk-subtle">
          {card ? (
            <>
              O que já estava na fatura quando você cadastrou o cartão. Os gastos lançados no app somam por cima.{' '}
              <span className="text-esk-muted">Fatura agora: {privateMoney(brl(projected), state.hideBalance)}</span>
            </>
          ) : (
            'O valor a pagar da fatura atual, não o limite usado. Compra parcelada entra só com a parcela deste mês.'
          )}
        </p>
        {/* Over-limit happens in real life: warn, never block */}
        {limit > 0 && projected > limit && (
          <p role="status" className="animate-rise font-sat text-[13px] text-esk-lilac">A fatura passa do limite em {brlShort(projected - limit)}. Confira os valores.</p>
        )}
        {!card && <p className="rounded-[18px] bg-esk-elevated px-4 py-3 font-sat text-[13px] text-esk-muted">A cor é escolhida automaticamente para manter a carteira fácil de visualizar.</p>}
        <PrimaryButton type="submit" loading={pending === 'save'}>
          {card ? 'Salvar cartão' : 'Adicionar cartão'}
        </PrimaryButton>
        {card && (
          <ConfirmDelete
            open={confirmDelete}
            onOpen={() => setConfirmDelete(true)}
            onCancel={() => setConfirmDelete(false)}
            label="Remover cartão"
            question="Remover este cartão? As compras e os pagamentos continuam no histórico, e o saldo não muda."
            loading={pending === 'delete'}
            onConfirm={async () => {
              if (await run('delete', () => cardsApi.remove(card.id), () => dispatch({ type: 'deleteCard', id: card.id }), 'Cartão removido', 'Não deu para remover. Tente de novo.')) close()
            }}
          />
        )}
      </form>
    </Sheet>
  )
}

/* ------------------------------------------------------ Nova / editar meta */

export function InvoiceImportSheet({ close, id }: { close: () => void; id: string }) {
  const { state, dispatch } = useStore()
  const { openSheet } = useUI()
  const { run, pending } = useMutation()
  const hidden = state.hideBalance
  const inv = useLast(state.invoices.find((i) => i.id === id))
  const [confirm, setConfirm] = useState(false)
  const [all, setAll] = useState(false)
  if (!inv) return null
  const txs = state.transactions.filter((t) => t.invoiceId === inv.id)
  const card = inv.cardId ? state.cards.find((c) => c.id === inv.cardId) : undefined
  const sum = txs.reduce((s, t) => s + t.amount, 0)
  const shown = all ? txs : txs.slice(0, 5)
  const restores = card && inv.previousInvoice !== null
  return (
    <Sheet title="Fatura importada" onClose={close}>
      <div className="flex flex-col gap-5">
        <DetailRows
          rows={[
            ['Arquivo', inv.fileName],
            ['Cartão', card ? cardLabel(card) : 'Sem cartão (Dinheiro)'],
            ['Importada em', longDate(inv.importedAt)],
            ['Total da fatura', privateMoney(brl(inv.total), hidden)],
            ['Lançamentos', `${txs.length} · ${privateMoney(brl(sum), hidden)}`],
          ]}
        />
        {txs.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="font-sat text-[13px] font-medium text-esk-muted">Toque para editar ou apagar um lançamento</p>
            <div className="flex flex-col rounded-[22px] bg-esk-elevated px-4">
              {shown.map((t, i) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => openSheet({ type: 'tx', id: t.id })}
                  className={cx('flex items-center justify-between gap-3 py-3 text-left transition hover:opacity-80', i > 0 && 'border-t border-esk-border')}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-sat text-[15px] font-medium text-white">{t.name}</span>
                    <span className="font-sat text-[12px] text-esk-subtle">{categoryMeta(state, t.category).label} · {longDate(t.date)}</span>
                  </span>
                  <span className="font-sat text-[15px] font-medium whitespace-nowrap text-esk-negative">{privateExpense(t.amount, hidden)}</span>
                </button>
              ))}
            </div>
            {txs.length > 5 && (
              <button type="button" onClick={() => setAll((v) => !v)} className="self-start font-sat text-[14px] font-medium text-esk-lime-soft">
                {all ? 'Mostrar menos' : `Ver todos (${txs.length})`}
              </button>
            )}
          </div>
        )}
        <ConfirmDelete
          open={confirm}
          onOpen={() => setConfirm(true)}
          onCancel={() => setConfirm(false)}
          label="Desfazer importação"
          question={`Apagar ${plural(txs.length, 'lançamento', 'lançamentos')} desta fatura?${restores ? ` A fatura do ${cardShort(card!)} volta para ${privateMoney(brl(inv.previousInvoice!), hidden)}.` : ''}`}
          loading={pending === 'delete'}
          onConfirm={async () => {
            if (await run('delete', () => invoicesApi.remove(inv.id), () => dispatch({ type: 'undoInvoice', id: inv.id }), 'Importação desfeita', 'Não deu para desfazer. Tente de novo.')) close()
          }}
        />
      </div>
    </Sheet>
  )
}
