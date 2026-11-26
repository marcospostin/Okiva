/**
 * Regras e categorias: recorrências, aviso de teto, classificar gastos sem categoria e detalhe de relatório.
 */
import { useState } from 'react'
import { ChevronRight, Repeat } from 'lucide-react'
import { categoryIds, categoryMeta, normalizeLabel } from '../../data/categories'
import { REPORTS_EVENT } from '../../lib/reports'
import { CategoryRowIcon } from '../../components/icons'
import { Chip, cx, Field, inputClass, MoneyInput, PrimaryButton, SearchField, SearchSummary, Sheet, Switch } from '../../components/ui'
import { searchTransactions } from '../../lib/search'
import { brlShort, longDate, privateExpense, privateIncome, privateMoney, byDateDesc } from '../../lib/format'
import { INCOME_SOURCES, incomeLabel, installmentGroup, kindOf, nextDate } from '../../lib/ledger'
import { capAlert, cardShort, methodLabel, todayISO, uncategorized, useStore } from '../../state/store'
import { budgetApi, categoriesApi, recurrencesApi, rulesApi } from '../../services/finance'
import { useMutation } from '../../state/useMutation'
import { useUI } from '../../state/ui'
import type { CategoryId, Recurrence, Transaction } from '../../types'
import { AccountChips, ConfirmDelete, keyToMethod, methodKey, useLast } from './common'

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
  const allTxs = state.transactions.filter((t) => set.has(t.id)).sort(byDateDesc)
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
