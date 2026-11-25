import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { CATEGORY_PALETTE, categoryMeta, findCategoryByLabel, hasCategory, nextCustomColor } from '../data/categories'
import { chipTextWidth, CHIP, fitChips, suggestCategories } from '../lib/categorySuggestions'
import { ChevronRight, FileText, MessageCircle, Plus, Sparkles } from 'lucide-react'
import { Chip, cx, Field, inputClass, MoneyInput, PrimaryButton, Sheet, Switch } from '../components/ui'
import { brl, brlShort, longDate, pct, privateExpense, privateMoney } from '../lib/format'
import { balanceOf, currentMonth, todayISO, useStore } from '../state/store'
import { accountApi, budgetApi, cardsApi, categoriesApi, goalsApi, invoicesApi, rulesApi } from '../services/finance'
import { useMutation } from '../state/useMutation'
import { useUI, type SheetState, type View } from '../state/ui'
import {
  BugReportSheet,
  ChangeEmailSheet,
  ChangePasswordSheet,
  HelpSheet,
  NotificationsSheet,
  PlanSheet,
  ProfileSheet,
  RateSheet,
  SecuritySheet,
  VerifyActionSheet,
} from './SettingsSheets'
import { BankAccountSheet, CapAlertSheet, CategorizeSheet, ReportDetailSheet, ConfirmDelete, EntrySheet, PayInvoiceSheet, RecurrenceSheet, TransactionSheet, useLast } from './MoneySheets'
import type { CategoryId, Goal } from '../types'

export default function SheetHost() {
  const { sheet, closeSheet } = useUI()
  if (!sheet) return null
  return <SheetSwitch sheet={sheet} close={closeSheet} />
}

function SheetSwitch({ sheet, close }: { sheet: SheetState; close: () => void }) {
  switch (sheet.type) {
    case 'add':
      return <EntrySheet close={close} initialKind={sheet.kind} />
    case 'edit':
      return <EntrySheet close={close} id={sheet.id} />
    case 'payInvoice':
      return <PayInvoiceSheet close={close} cardId={sheet.cardId} id={sheet.id} />
    case 'bankAccount':
      return <BankAccountSheet close={close} id={sheet.id} />
    case 'recurrence':
      return <RecurrenceSheet close={close} id={sheet.id} />
    case 'reportDetail':
      return <ReportDetailSheet close={close} title={sheet.title} subtitle={sheet.subtitle} ids={sheet.ids} category={sheet.category} />
    case 'categorize':
      return <CategorizeSheet close={close} id={sheet.id} />
    case 'capAlert':
      return <CapAlertSheet close={close} category={sheet.category} />
    case 'tx':
      return <TransactionSheet close={close} id={sheet.id} />
    case 'card':
      return <CardSheet close={close} id={sheet.id} />
    case 'goal':
      return <GoalSheet close={close} id={sheet.id} />
    case 'save':
      return <SaveSheet close={close} goalId={sheet.goalId} />
    case 'budget':
      return <BudgetSheet close={close} category={sheet.category} />
    case 'cap':
      return <CapSheet close={close} />
    case 'balance':
      return <BalanceSheet close={close} />
    case 'plan':
      return <PlanSheet close={close} />
    case 'security':
      return <SecuritySheet close={close} />
    case 'changeEmail':
      return <ChangeEmailSheet />
    case 'changePassword':
      return <ChangePasswordSheet close={close} />
    case 'newPassword':
      return <ChangePasswordSheet recovery close={close} />
    case 'notifications':
      return <NotificationsSheet close={close} />
    case 'help':
      return <HelpSheet close={close} />
    case 'bug':
      return <BugReportSheet close={close} />
    case 'rate':
      return <RateSheet close={close} />
    case 'verifyAction':
      return <VerifyActionSheet close={close} action={sheet.action} confirmed={sheet.confirmed} />
    case 'plus':
      return <PlusSheet close={close} then={sheet.then} />
    case 'profile':
      return <ProfileSheet close={close} />
    case 'deposit':
      return <DepositSheet close={close} id={sheet.id} />
    case 'categories':
      return <CategoriesSheet close={close} />
    case 'category':
      return <CategorySheet close={close} id={sheet.id} />
    case 'invoiceImport':
      return <InvoiceImportSheet close={close} id={sheet.id} />
  }
}

/* ------------------------------------------------- Novo / editar cartão */

function CardSheet({ close, id }: { close: () => void; id?: string }) {
  const { state, dispatch } = useStore()
  const { run, pending } = useMutation()
  const card = useLast(id ? state.cards.find((c) => c.id === id) : undefined)
  const [nickname, setNickname] = useState(card?.nickname ?? '')
  const [last4, setLast4] = useState(card?.last4 ?? '')
  const [limit, setLimit] = useState(card?.limit ?? 0)
  const [invoice, setInvoice] = useState(card?.invoice ?? 0)
  const [dueDay, setDueDay] = useState(String(card?.dueDay ?? 10))
  const [tries, setTries] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const errors = {
    nickname: !nickname.trim() ? 'Dê um apelido ao cartão.' : undefined,
    last4: !/^\d{4}$/.test(last4) ? 'Use os 4 últimos dígitos.' : undefined,
    limit: limit <= 0 ? 'Informe o limite.' : undefined,
    dueDay: !(Number(dueDay) >= 1 && Number(dueDay) <= 31) ? 'Dia entre 1 e 31.' : undefined,
  }
  const valid = !Object.values(errors).some(Boolean)
  const show = (e?: string) => (tries ? e : undefined)

  async function save() {
    setTries((n) => n + 1)
    if (!valid) return
    const input = { nickname: nickname.trim(), last4, limit, invoice, dueDay: Number(dueDay) }
    const ok = card
      ? await run('save', () => cardsApi.update({ ...card, ...input }), (saved) => dispatch({ type: 'saveCard', card: saved }), 'Cartão atualizado')
      : await run('save', () => cardsApi.create(input), (saved) => dispatch({ type: 'saveCard', card: saved }), 'Cartão adicionado')
    if (ok) close()
  }

  return (
    <Sheet title={card ? card.nickname : 'Novo cartão'} onClose={close}>
      <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); save() }}>
        <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3">
          <Field label="Apelido" htmlFor="nick" error={show(errors.nickname)} attempt={tries}>
            <input id="nick" className={inputClass} placeholder="Principal" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={20} />
          </Field>
          <Field label="Final" htmlFor="last4" error={show(errors.last4)} attempt={tries}>
            <input id="last4" inputMode="numeric" className={inputClass} placeholder="4552" value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))} />
          </Field>
        </div>
        <Field label="Limite" htmlFor="limit" error={show(errors.limit)} attempt={tries}>
          <MoneyInput id="limit" value={limit} onChange={setLimit} />
        </Field>
        <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3">
          <Field label="Fatura atual" htmlFor="inv">
            <MoneyInput id="inv" value={invoice} onChange={setInvoice} />
          </Field>
          <Field label="Vence dia" htmlFor="due" error={show(errors.dueDay)} attempt={tries}>
            <input id="due" inputMode="numeric" className={inputClass} value={dueDay} onChange={(e) => setDueDay(e.target.value.replace(/\D/g, '').slice(0, 2))} />
          </Field>
        </div>
        {/* Over-limit happens in real life: warn, never block */}
        {limit > 0 && invoice > limit && (
          <p role="status" className="animate-rise font-sat text-[13px] text-esk-lilac">A fatura passa do limite em {brlShort(invoice - limit)}. Confira os valores.</p>
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
            question="Remover este cartão? Os gastos dele passam para Dinheiro."
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

const GOAL_ICONS: Goal['icon'][] = ['plane', 'shield', 'book', 'car', 'target']

function GoalSheet({ close, id }: { close: () => void; id?: string }) {
  const { state, dispatch } = useStore()
  const { openSheet } = useUI()
  const { run, pending } = useMutation()
  const goal = useLast(id ? state.goals.find((g) => g.id === id) : undefined)
  const isMain = !!goal && state.featuredGoalId === goal.id
  const [makeMain, setMakeMain] = useState(isMain || (!goal && state.goals.length === 0))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [name, setName] = useState(goal?.name ?? '')
  const [target, setTarget] = useState(goal?.target ?? 0)
  const [saved, setSaved] = useState(goal?.saved ?? 0)
  const [deadline, setDeadline] = useState(goal?.deadline ?? '')
  const [tries, setTries] = useState(0)
  const errors = {
    name: !name.trim() ? 'Dê um nome à meta.' : undefined,
    target: target <= 0 ? 'Informe o valor alvo.' : undefined,
    deadline: deadline && deadline < currentMonth() ? 'Escolha um mês a partir de agora.' : undefined,
  }
  const show = (e?: string) => (tries ? e : undefined)

  async function save() {
    setTries((n) => n + 1)
    if (errors.name || errors.target || errors.deadline) return
    const fields = { name: name.trim(), target, saved, deadline: deadline || undefined, icon: goal?.icon ?? GOAL_ICONS[state.goals.length % GOAL_ICONS.length] }
    const message = makeMain && !isMain ? `${fields.name} agora é sua meta principal` : goal ? 'Meta atualizada' : 'Meta criada'
    const ok = goal
      ? await run('save', () => goalsApi.update({ ...goal, ...fields, featured: makeMain }), (g) => dispatch({ type: 'saveGoal', goal: g, featured: makeMain }), message)
      : await run('save', () => goalsApi.create({ ...fields, featured: makeMain }, currentMonth()), (g) => dispatch({ type: 'saveGoal', goal: g, featured: makeMain }), message)
    if (ok) close()
  }

  return (
    <Sheet title={goal ? goal.name : 'Nova meta'} onClose={close}>
      <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); save() }}>
        <Field label="Nome" htmlFor="gname" error={show(errors.name)} attempt={tries}>
          <input id="gname" className={inputClass} placeholder="Viagem, reserva, curso…" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} />
        </Field>
        <Field label="Valor alvo" htmlFor="gtarget" error={show(errors.target)} attempt={tries}>
          <MoneyInput id="gtarget" value={target} onChange={setTarget} />
        </Field>
        <Field label="Já guardado" htmlFor="gsaved">
          <MoneyInput id="gsaved" value={saved} onChange={setSaved} />
        </Field>
        <Field label="Data (opcional)" htmlFor="gdate" error={show(errors.deadline)} attempt={tries}>
          <input id="gdate" type="month" className={inputClass} value={deadline} min={currentMonth()} onChange={(e) => setDeadline(e.target.value)} />
        </Field>
        {!goal && state.goals.length > 0 && (
          <div className="flex items-center justify-between gap-4 rounded-[22px] bg-esk-elevated p-4">
            <span className="flex flex-col">
              <span className="font-sat text-[15px] font-medium text-white">Criar como meta principal</span>
              <span className="font-sat text-[12px] text-esk-subtle">A meta principal atual passa para as secundárias.</span>
            </span>
            <Switch label="Meta principal" checked={makeMain} onChange={setMakeMain} />
          </div>
        )}
        <PrimaryButton type="submit" loading={pending === 'save'}>
          {goal ? 'Salvar meta' : 'Criar meta'}
        </PrimaryButton>
        {goal && (
          <>
            <PrimaryButton tone="dark" onClick={() => openSheet({ type: 'save', goalId: goal.id })} disabled={!!pending}>
              Guardar valor
            </PrimaryButton>
            <DepositHistory goalId={goal.id} />
            <ConfirmDelete
              open={confirmDelete}
              onOpen={() => setConfirmDelete(true)}
              onCancel={() => setConfirmDelete(false)}
              label="Excluir meta"
              question={isMain ? 'Excluir a meta principal e o histórico de depósitos? A próxima meta vira a principal.' : 'Excluir esta meta e o histórico de depósitos dela?'}
              loading={pending === 'delete'}
              onConfirm={async () => {
                if (await run('delete', () => goalsApi.remove(goal.id), () => dispatch({ type: 'deleteGoal', id: goal.id }), 'Meta excluída', 'Não deu para excluir. Tente de novo.')) close()
              }}
            />
          </>
        )}
      </form>
    </Sheet>
  )
}

/* ------------------------------------------------------------ Guardar */

function SaveSheet({ close, goalId }: { close: () => void; goalId: string }) {
  const { state, dispatch } = useStore()
  const { openSheet } = useUI()
  const { run, pending } = useMutation()
  const hidden = state.hideBalance
  const goal = useLast(state.goals.find((g) => g.id === goalId))
  const [amount, setAmount] = useState(0)
  const [makeMain, setMakeMain] = useState(false)
  if (!goal) return null
  const isMain = (state.featuredGoalId || state.goals[0]?.id) === goal.id
  const after = goal.saved + amount
  const reaches = goal.saved < goal.target && after >= goal.target
  const featuring = makeMain && !isMain
  const nothing = amount <= 0 && !featuring
  const message = () => {
    const saved = amount > 0 ? (reaches ? `Meta ${goal.name} atingida! 🎉` : `${privateMoney(brlShort(amount), hidden)} guardados em ${goal.name}`) : ''
    if (!featuring) return saved
    return saved ? `${saved} · agora é sua meta principal` : `${goal.name} agora é sua meta principal`
  }
  return (
    <Sheet title={goal.name} onClose={close}>
      <form
        className="flex flex-col gap-5"
        onSubmit={async (e) => {
          e.preventDefault()
          if (nothing) return
          const ok = await run(
            'save',
            async () => {
              const deposit = amount > 0 ? await goalsApi.deposit(goalId, amount, todayISO()) : null
              if (featuring) await goalsApi.update({ ...goal, featured: true })
              return deposit
            },
            (deposit) => {
              if (deposit) dispatch({ type: 'deposit', deposit })
              if (featuring) dispatch({ type: 'feature', goalId: goal.id })
            },
            message(),
          )
          if (ok) close()
        }}
      >
        {isMain && (
          <p className="-mt-2 inline-flex items-center gap-2 self-start rounded-full bg-esk-lime/10 px-3 py-1 font-sat text-[12px] font-medium text-esk-lime">Meta principal</p>
        )}
        <Field label="Guardar agora (opcional)" htmlFor="save">
          <MoneyInput id="save" value={amount} onChange={setAmount} large />
        </Field>
        <div className="flex flex-wrap gap-2">
          {[100, 250, 500, 1000].map((v) => (
            <Chip key={v} active={amount === v} onClick={() => setAmount(v)}>
              {privateMoney(brlShort(v), hidden)}
            </Chip>
          ))}
        </div>
        <div className="rounded-[22px] bg-esk-elevated p-5">
          <div className="flex justify-between font-sat text-[14px]">
            <span className="text-esk-muted">{amount > 0 ? 'Depois de guardar' : 'Guardado até agora'}</span>
            <span key={pct(after, goal.target)} className="animate-check-pop font-medium text-white">
              {pct(after, goal.target)}%
            </span>
          </div>
          <p className="pt-1 font-sat text-[22px] font-medium tracking-[-0.6px] text-white">
            {privateMoney(brlShort(after), hidden)} <span className="text-[14px] text-esk-muted">de {privateMoney(brlShort(goal.target), hidden)}</span>
          </p>
          {reaches && <p className="animate-rise pt-2 font-sat text-[13px] font-medium text-esk-lime">Com esse valor você atinge a meta!</p>}
        </div>
        {!isMain && (
          <div className="flex items-center justify-between gap-4 rounded-[22px] bg-esk-elevated p-4">
            <span className="flex flex-col">
              <span className="font-sat text-[15px] font-medium text-white">Tornar meta principal</span>
              <span className="font-sat text-[12px] text-esk-subtle">A meta principal atual passa para as secundárias.</span>
            </span>
            <Switch label="Tornar meta principal" checked={makeMain} onChange={setMakeMain} />
          </div>
        )}
        <PrimaryButton type="submit" disabled={nothing} loading={pending === 'save'}>
          Salvar
        </PrimaryButton>
        <button type="button" onClick={() => openSheet({ type: 'goal', id: goal.id })} className="font-sat text-[14px] font-medium text-esk-lime-soft">
          Editar meta
        </button>
      </form>
    </Sheet>
  )
}

/* --------------------------------------------------------- Teto do mês */

function BudgetSheet({ close, category }: { close: () => void; category?: CategoryId }) {
  const { state, dispatch } = useStore()
  const { openSheet } = useUI()
  const { run, pending } = useMutation()
  const [value, setValue] = useState(category ? (state.budget.caps[category] ?? 0) : state.budget.total)
  const title = category ? `Teto de ${categoryMeta(state, category).label}` : 'Teto do mês'
  return (
    <Sheet title={title} onClose={close}>
      <form
        className="flex flex-col gap-5"
        onSubmit={async (e) => {
          e.preventDefault()
          if (value <= 0) return
          const ok = category
            ? await run('save', () => budgetApi.setCap(category, value), (r) => dispatch({ type: 'setCap', category: r.category, value: r.value }), 'Teto atualizado')
            : await run('save', () => budgetApi.setTotal(value), (r) => dispatch({ type: 'setBudgetTotal', value: r.total }), 'Teto atualizado')
          if (ok) close()
        }}
      >
        <Field label="Limite de gasto do mês" htmlFor="cap">
          <MoneyInput id="cap" value={value} onChange={setValue} large autoFocus />
        </Field>
        <PrimaryButton type="submit" disabled={value <= 0} loading={pending === 'save'}>
          Salvar teto
        </PrimaryButton>
        {category && state.budget.caps[category] !== undefined && (
          <PrimaryButton
            tone="danger"
            loading={pending === 'remove'}
            loadingText="Removendo…"
            onClick={async () => {
              if (await run('remove', () => budgetApi.removeCap(category), () => dispatch({ type: 'removeCap', category }), `Teto de ${categoryMeta(state, category).label} removido`)) close()
            }}
          >
            Remover teto da categoria
          </PrimaryButton>
        )}
        {!category && state.budget.total > 0 && (
          <PrimaryButton
            tone="danger"
            loading={pending === 'remove'}
            loadingText="Removendo…"
            onClick={async () => {
              if (await run('remove', () => budgetApi.removeTotal(), () => dispatch({ type: 'setBudgetTotal', value: 0 }), 'Teto do mês removido')) close()
            }}
          >
            Remover teto do mês
          </PrimaryButton>
        )}
        {category && hasCategory(state, category) && (
          <button type="button" onClick={() => openSheet({ type: 'category', id: category })} className="font-sat text-[14px] font-medium text-esk-lime-soft">
            Editar categoria {categoryMeta(state, category).label}
          </button>
        )}
      </form>
    </Sheet>
  )
}

/* ------------------------------------------------- Teto por categoria */

const NEW_CATEGORY = 'new'
const NEW_CATEGORY_LABEL = 'Nova categoria'
/** Leading "+" (16px) and its gap inside the create chip, plus the 1px dashed border on each side */
const NEW_CHIP_EXTRA = 16 + 6 + 2

/** Width of an element, kept current on resize (sheet width changes between mobile and desktop). */
function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const listNames = (names: string[]) => (names.length <= 2 ? names.join(' e ') : `${names.slice(0, 2).join(', ')} e mais ${names.length - 2}`)

function CapSheet({ close }: { close: () => void }) {
  const { state, dispatch } = useStore()
  const { run, pending } = useMutation()
  const hidden = state.hideBalance
  const suggestions = useMemo(() => suggestCategories(state), [state])

  // Only as many suggestions as fit in two rows next to "Nova categoria"
  const [chipsRef, width] = useElementWidth<HTMLDivElement>()
  const font = chipsRef.current ? getComputedStyle(chipsRef.current).fontFamily : 'Satoshi, sans-serif'
  const trailing = chipTextWidth(NEW_CATEGORY_LABEL, font) + CHIP.paddingX + NEW_CHIP_EXTRA
  const shown = suggestions.slice(0, fitChips(suggestions.map((s) => s.label), width, font, trailing))

  const [pick, setPick] = useState<string>(() => suggestions[0]?.key ?? NEW_CATEGORY)
  // A suggestion that stopped fitting (sheet got narrower) falls back to the first visible one
  const creating = pick === NEW_CATEGORY || shown.length === 0
  const selected = creating ? undefined : (shown.find((s) => s.key === pick) ?? shown[0])

  const [name, setName] = useState('')
  const [value, setValue] = useState(0)
  const [tries, setTries] = useState(0)
  const trimmed = name.trim()
  const sameName = creating && trimmed ? findCategoryByLabel(state, trimmed) : undefined
  const sameNameHasCap = sameName !== undefined && state.budget.caps[sameName] !== undefined
  const nameError =
    tries && creating
      ? !trimmed
        ? 'Dê um nome para a categoria.'
        : sameNameHasCap
          ? `${categoryMeta(state, sameName).label} já tem teto. Toque nela em Metas para ajustar.`
          : undefined
      : undefined
  const fromData = shown.some((s) => s.source === 'keyword' || s.source === 'spend')

  async function save() {
    setTries((n) => n + 1)
    if (value <= 0) return
    let label: string
    let existingId: CategoryId | undefined
    let txIds: string[] = []
    if (creating) {
      if (!trimmed || sameNameHasCap) return
      existingId = sameName
      label = sameName ? categoryMeta(state, sameName).label : capitalize(trimmed)
    } else {
      label = selected!.label
      existingId = selected!.existingId
      txIds = selected!.txIds
    }
    const color = nextCustomColor(state.customCategories)
    const moved = txIds.length
    const ok = await run(
      'save',
      async () => {
        const created = existingId ? null : await categoriesApi.create({ label, color })
        const id = existingId ?? created!.id
        if (moved) await categoriesApi.recategorize(txIds, id)
        const cap = await budgetApi.setCap(id, value)
        return { created, id, cap }
      },
      ({ created, id, cap }) => {
        if (created) dispatch({ type: 'addCategory', category: created })
        if (moved) dispatch({ type: 'recategorize', ids: txIds, category: id })
        dispatch({ type: 'setCap', category: cap.category, value: cap.value })
      },
      `Teto de ${label} criado${moved ? ` · ${moved} ${moved === 1 ? 'lançamento incluído' : 'lançamentos incluídos'}` : ''}`,
    )
    if (ok) close()
  }

  // One line that explains the selected chip (why it is suggested / what happens)
  let hint: string
  if (creating) hint = sameName && !sameNameHasCap ? `${categoryMeta(state, sameName).label} já existe. O teto será criado nela.` : 'Ela também aparece ao adicionar um gasto.'
  else if (selected!.source === 'keyword')
    hint = `Sugerida por ${listNames(selected!.matches)}. ${selected!.txIds.length === 1 ? 'Esse lançamento passa' : 'Esses lançamentos passam'} para ${selected!.label}.`
  else if (selected!.source === 'spend') hint = `Você gastou ${privateMoney(brlShort(selected!.amount), hidden)} em ${selected!.label} nos últimos 3 meses.`
  else if (selected!.source === 'custom') hint = 'Categoria criada por você, ainda sem teto.'
  else hint = fromData ? 'Sugestão comum. Ou crie a sua em Nova categoria.' : 'As mais comuns para começar. Ou crie a sua.'

  return (
    <Sheet title="Teto por categoria" onClose={close}>
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <Field label="Categoria">
          <div className="flex flex-col gap-2">
            <div ref={chipsRef} className="flex flex-wrap gap-2">
              {shown.map((s) => (
                <Chip key={s.key} active={!creating && selected?.key === s.key} onClick={() => setPick(s.key)}>
                  {s.label}
                </Chip>
              ))}
              <Chip active={creating} dashed onClick={() => setPick(NEW_CATEGORY)} icon={<Plus size={16} strokeWidth={2} aria-hidden />}>
                {NEW_CATEGORY_LABEL}
              </Chip>
            </div>
            <p key={creating ? NEW_CATEGORY : selected?.key} className="animate-rise font-sat text-[13px] leading-[1.4] text-esk-subtle">
              {hint}
            </p>
          </div>
        </Field>
        {creating && (
          <div className="animate-rise">
            <Field label="Nome da categoria" htmlFor="catname" error={nameError} attempt={tries}>
              <input
                id="catname"
                className={inputClass}
                placeholder="Manutenção, Pets, Academia…"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={24}
                autoFocus
                autoComplete="off"
              />
            </Field>
          </div>
        )}
        <Field label="Limite de gasto do mês" htmlFor="newcap">
          <MoneyInput id="newcap" value={value} onChange={setValue} large />
        </Field>
        <PrimaryButton type="submit" disabled={value <= 0} loading={pending === 'save'}>
          Criar teto
        </PrimaryButton>
      </form>
    </Sheet>
  )
}

/* ------------------------------------------------------- Ajustar saldo */

function BalanceSheet({ close }: { close: () => void }) {
  const { state, dispatch } = useStore()
  const { run, pending } = useMutation()
  const [value, setValue] = useState(Math.max(0, balanceOf(state)))
  return (
    <Sheet title="Ajustar saldo" onClose={close}>
      <form
        className="flex flex-col gap-5"
        onSubmit={async (e) => {
          e.preventDefault()
          if (await run('save', () => accountApi.setBalance(value), (r) => dispatch({ type: 'setBalance', value: r.balance }), 'Saldo ajustado')) close()
        }}
      >
        <Field label="Quanto você tem hoje" htmlFor="bal">
          <MoneyInput id="bal" value={value} onChange={setValue} large autoFocus />
        </Field>
        <p className="font-sat text-[13px] text-esk-subtle">Os gastos que você registrar a partir de agora saem deste valor.</p>
        <PrimaryButton type="submit" loading={pending === 'save'}>
          Salvar saldo
        </PrimaryButton>
      </form>
    </Sheet>
  )
}

/* ------------------------------------------------------- Okiva Plus */

const PLUS_FEATURES = [
  { icon: <MessageCircle size={20} strokeWidth={1.8} />, title: 'Assistente com IA', text: 'Pergunte sobre gastos, cartões e metas. Ele responde com os seus números.' },
  { icon: <FileText size={20} strokeWidth={1.8} />, title: 'Leitura de fatura', text: 'Envie o PDF ou uma foto. A IA categoriza e você confirma.' },
  { icon: <Sparkles size={20} strokeWidth={1.8} />, title: 'Dicas para suas metas', text: 'Sugestões de onde economizar para chegar antes.' },
]

function PlusSheet({ close, then }: { close: () => void; then?: View }) {
  const { dispatch } = useStore()
  const { navigate, notify } = useUI()
  return (
    <Sheet title="Okiva Plus" onClose={close}>
      <div className="relative overflow-hidden rounded-[26px] p-5 text-esk-ink" style={{ backgroundImage: 'var(--esk-gradient-insight)' }}>
        <p className="font-mono text-[11px] font-medium tracking-[1.1px]">ESTÁGIO 2</p>
        <p className="pt-2 font-sat text-[26px] leading-[1.1] font-medium tracking-[-0.8px]">Seu dinheiro com uma IA do seu lado.</p>
      </div>
      <ul className="mt-5 flex flex-col gap-4">
        {PLUS_FEATURES.map((f, i) => (
          <li key={f.title} className="flex animate-rise items-start gap-3" style={{ animationDelay: `${120 + i * 70}ms` }}>
            <span className="grid size-[40px] shrink-0 place-items-center rounded-[20px] bg-esk-elevated text-esk-lime">{f.icon}</span>
            <span className="flex flex-col">
              <span className="font-sat text-[15px] font-medium text-white">{f.title}</span>
              <span className="font-sat text-[13px] text-esk-muted">{f.text}</span>
            </span>
          </li>
        ))}
      </ul>
      <PrimaryButton
        className="mt-6"
        onClick={() => {
          dispatch({ type: 'setStage', stage: 2 })
          notify('Okiva Plus ativado')
          if (then) navigate(then)
          else close()
        }}
      >
        Ativar Okiva Plus
      </PrimaryButton>
      <p className="pt-3 text-center font-sat text-[12px] text-esk-subtle">Protótipo: ativação gratuita. Você pode desligar em Conta.</p>
    </Sheet>
  )
}

/* ------------------------------------------------------- Confirmação */

/* ------------------------------------------------- Depósitos de uma meta */

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Shared look of read-only detail rows (Detalhe da compra, Fatura importada). */
function DetailRows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="flex flex-col rounded-[24px] bg-esk-elevated px-5">
      {rows.map(([k, v], i) => (
        <div key={k} className={cx('flex justify-between gap-4 py-4 font-sat text-[15px]', i > 0 && 'border-t border-esk-border')}>
          <dt className="shrink-0 text-esk-muted">{k}</dt>
          <dd className="min-w-0 truncate text-right font-medium text-white">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function DepositHistory({ goalId }: { goalId: string }) {
  const { state } = useStore()
  const { openSheet } = useUI()
  const [all, setAll] = useState(false)
  const hidden = state.hideBalance
  const goal = state.goals.find((g) => g.id === goalId)
  const list = state.deposits.filter((d) => d.goalId === goalId)
  const shown = all ? list : list.slice(0, 4)
  return (
    <div className="flex flex-col gap-2">
      <p className="font-sat text-[13px] font-medium text-esk-muted">Depósitos{list.length ? ` (${list.length})` : ''}</p>
      {list.length === 0 ? (
        <p className="rounded-[18px] bg-esk-elevated px-4 py-3 font-sat text-[13px] text-esk-subtle">Nenhum depósito ainda. Use Guardar valor para registrar o primeiro.</p>
      ) : (
        <div className="flex flex-col rounded-[22px] bg-esk-elevated px-4">
          {shown.map((d, i) => (
            <button
              key={d.id}
              type="button"
              onClick={() => openSheet({ type: 'deposit', id: d.id })}
              className={cx('flex items-center justify-between gap-3 py-3 text-left transition hover:opacity-80', i > 0 && 'border-t border-esk-border')}
            >
              <span className="font-sat text-[14px] text-esk-muted">{longDate(d.date)}</span>
              <span className="flex items-center gap-1 font-sat text-[15px] font-medium text-white">
                + {privateMoney(brl(d.amount), hidden)}
                <ChevronRight size={15} className="text-esk-subtle" aria-hidden />
              </span>
            </button>
          ))}
        </div>
      )}
      {list.length > 4 && (
        <button type="button" onClick={() => setAll((v) => !v)} className="self-start font-sat text-[14px] font-medium text-esk-lime-soft">
          {all ? 'Mostrar menos' : `Ver todos (${list.length})`}
        </button>
      )}
      {!!goal?.initialSaved && (
        <p className="font-sat text-[12px] text-esk-subtle">Você já tinha {privateMoney(brl(goal.initialSaved), hidden)} ao criar a meta. Esse valor não entra na média.</p>
      )}
    </div>
  )
}

function DepositSheet({ close, id }: { close: () => void; id: string }) {
  const { state, dispatch } = useStore()
  const { openSheet } = useUI()
  const { run, pending } = useMutation()
  const hidden = state.hideBalance
  const dep = useLast(state.deposits.find((d) => d.id === id))
  const goal = dep ? state.goals.find((g) => g.id === dep.goalId) : undefined
  const [amount, setAmount] = useState(dep?.amount ?? 0)
  const [date, setDate] = useState(dep?.date ?? todayISO())
  const [tries, setTries] = useState(0)
  const [confirm, setConfirm] = useState(false)
  if (!dep) return null
  const back = () => (goal ? openSheet({ type: 'goal', id: goal.id }) : close())
  const amountError = tries && amount <= 0 ? 'Digite o valor guardado.' : undefined
  const dateError = tries && !date ? 'Escolha a data.' : undefined

  async function save() {
    setTries((n) => n + 1)
    if (amount <= 0 || !date || !dep) return
    const ok = await run('save', () => goalsApi.updateDeposit({ ...dep, amount, date }), (d) => dispatch({ type: 'updateDeposit', deposit: d }), 'Depósito atualizado')
    if (ok) back()
  }

  return (
    <Sheet title={`Depósito em ${goal?.name ?? 'meta'}`} onClose={back}>
      <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); save() }}>
        <Field label="Valor guardado" htmlFor="depamount" error={amountError} attempt={tries}>
          <MoneyInput id="depamount" value={amount} onChange={setAmount} large autoFocus />
        </Field>
        <Field label="Data" htmlFor="depdate" error={dateError} attempt={tries}>
          <input id="depdate" type="date" className={inputClass} value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <PrimaryButton type="submit" loading={pending === 'save'}>
          Salvar depósito
        </PrimaryButton>
        <ConfirmDelete
          open={confirm}
          onOpen={() => setConfirm(true)}
          onCancel={() => setConfirm(false)}
          label="Excluir depósito"
          question={`Excluir este depósito? ${privateMoney(brl(dep.amount), hidden)} sai de ${goal?.name ?? 'meta'} e a média é recalculada.`}
          loading={pending === 'delete'}
          onConfirm={async () => {
            if (await run('delete', () => goalsApi.removeDeposit(dep), () => dispatch({ type: 'deleteDeposit', id: dep.id }), 'Depósito excluído', 'Não deu para excluir. Tente de novo.')) back()
          }}
        />
      </form>
    </Sheet>
  )
}

function CategoriesSheet({ close }: { close: () => void }) {
  const { state } = useStore()
  const { openSheet } = useUI()
  const hidden = state.hideBalance
  const uses = (id: string) => state.transactions.filter((t) => t.category === id && (t.kind ?? 'expense') === 'expense').length
  return (
    <Sheet title="Categorias" onClose={close}>
      <div className="flex flex-col gap-5">
        <p className="-mt-2 font-sat text-[13px] text-esk-muted">As que vieram com o app são sugestões: renomeie, troque a cor ou exclua as que não usa.</p>
        {state.customCategories.length === 0 ? (
          <p className="rounded-[18px] bg-esk-elevated px-4 py-4 font-sat text-[14px] text-esk-muted">
            Nenhuma categoria. Crie as que fazem sentido para você, como Mercado, Pets ou Manutenção.
          </p>
        ) : (
          <div className="flex flex-col rounded-[24px] bg-esk-elevated px-4">
            {state.customCategories.map((c, i) => {
              const cap = state.budget.caps[c.id]
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => openSheet({ type: 'category', id: c.id })}
                  className={cx('flex items-center gap-3 py-4 text-left transition hover:opacity-80', i > 0 && 'border-t border-esk-border')}
                >
                  <span className="size-[12px] shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-sat text-[15px] font-medium text-white">{c.label}</span>
                    <span className="font-sat text-[13px] text-esk-subtle">
                      {plural(uses(c.id), 'lançamento', 'lançamentos')} · {cap !== undefined ? `teto ${privateMoney(brlShort(cap), hidden)}` : 'sem teto'}
                    </span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-esk-subtle" aria-hidden />
                </button>
              )
            })}
          </div>
        )}
        <PrimaryButton onClick={() => openSheet({ type: 'category' })}>Nova categoria</PrimaryButton>
      </div>
    </Sheet>
  )
}

function CategorySheet({ id }: { close: () => void; id?: string }) {
  const { state, dispatch } = useStore()
  const { openSheet } = useUI()
  const { run, pending } = useMutation()
  const cat = useLast(id ? state.customCategories.find((c) => c.id === id) : undefined)
  const [name, setName] = useState(cat?.label ?? '')
  const [color, setColor] = useState(cat?.color ?? nextCustomColor(state.customCategories))
  const [tries, setTries] = useState(0)
  const [confirm, setConfirm] = useState(false)
  const others = state.customCategories.filter((c) => c.id !== cat?.id)
  // Padrão: os gastos ficam sem categoria e aparecem para classificar (nada vai para "Outros" sem a pessoa decidir)
  const [moveTo, setMoveTo] = useState<CategoryId | null>(null)
  const trimmed = name.trim()
  const clash = trimmed ? findCategoryByLabel(state, trimmed) : undefined
  const nameError = tries
    ? !trimmed
      ? 'Dê um nome para a categoria.'
      : clash && clash !== cat?.id
        ? `Já existe a categoria ${categoryMeta(state, clash).label}.`
        : undefined
    : undefined
  const back = () => openSheet({ type: 'categories' })
  const uses = cat ? state.transactions.filter((t) => t.category === cat.id && (t.kind ?? 'expense') === 'expense').length : 0
  const recs = cat ? state.recurrences.filter((r) => r.category === cat.id && r.kind === 'expense').length : 0
  const hasCap = !!cat && state.budget.caps[cat.id] !== undefined
  const needsTarget = uses + recs > 0
  const rules = cat ? state.categoryRules.filter((r) => r.category === cat.id) : []
  const target = moveTo === null ? 'sem categoria' : `para ${categoryMeta(state, moveTo).label}`

  async function save() {
    setTries((n) => n + 1)
    if (!trimmed || (clash && clash !== cat?.id)) return
    const label = capitalize(trimmed)
    const ok = cat
      ? await run('save', () => categoriesApi.update({ ...cat, label, color }), (c) => dispatch({ type: 'addCategory', category: c }), 'Categoria atualizada')
      : await run('save', () => categoriesApi.create({ label, color }), (c) => dispatch({ type: 'addCategory', category: c }), `Categoria ${label} criada`)
    if (ok) back()
  }

  return (
    <Sheet title={cat ? cat.label : 'Nova categoria'} onClose={back}>
      <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); save() }}>
        <Field label="Nome da categoria" htmlFor="ecat" error={nameError} attempt={tries}>
          <input id="ecat" className={inputClass} placeholder="Mercado, Pets, Academia…" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} autoFocus={!cat} autoComplete="off" />
        </Field>
        <Field label="Cor">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cor da categoria">
            {CATEGORY_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color.toLowerCase() === c}
                aria-label={c}
                onClick={() => setColor(c)}
                className={cx('size-[34px] rounded-full ring-offset-2 ring-offset-esk-surface transition active:scale-90', color.toLowerCase() === c ? 'ring-2 ring-white' : 'ring-1 ring-black/20')}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </Field>
        {cat && (
          <p className="-mt-2 font-sat text-[13px] text-esk-subtle">
            {plural(uses, 'lançamento usa', 'lançamentos usam')} essa categoria{recs ? ` · ${plural(recs, 'recorrência', 'recorrências')}` : ''}{hasCap ? ' · tem teto em Metas' : ''}.
          </p>
        )}
        <PrimaryButton type="submit" loading={pending === 'save'}>
          {cat ? 'Salvar categoria' : 'Criar categoria'}
        </PrimaryButton>
        {cat && rules.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="font-sat text-[13px] font-medium text-esk-muted">Nomes que entram aqui sozinhos</p>
            <div className="flex flex-col rounded-[20px] bg-esk-elevated px-4">
              {rules.map((r, i) => (
                <div key={r.id} className={cx('flex items-center justify-between gap-3 py-3', i > 0 && 'border-t border-esk-border')}>
                  <span className="min-w-0 truncate font-sat text-[14px] text-white">{r.pattern}</span>
                  <button
                    type="button"
                    disabled={!!pending}
                    onClick={() => run(`rule-${r.id}`, () => rulesApi.remove(r.id), () => dispatch({ type: 'deleteRule', id: r.id }), 'Regra removida')}
                    className="shrink-0 font-sat text-[13px] font-medium text-esk-lilac hover:underline disabled:opacity-40"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
            <p className="font-sat text-[12px] text-esk-subtle">Aprendidos quando você classifica um gasto. Faturas novas com esses nomes já entram nesta categoria.</p>
          </div>
        )}
        {cat && confirm && needsTarget && (
          <Field label="Os lançamentos dela">
            <div className="flex flex-wrap gap-2">
              <Chip active={moveTo === null} onClick={() => setMoveTo(null)}>
                Deixar sem categoria
              </Chip>
              {others.map((c) => (
                <Chip key={c.id} active={moveTo === c.id} onClick={() => setMoveTo(c.id)}>
                  {c.label}
                </Chip>
              ))}
            </div>
          </Field>
        )}
        {cat && (
            <ConfirmDelete
              open={confirm}
              onOpen={() => setConfirm(true)}
              onCancel={() => setConfirm(false)}
              label="Excluir categoria"
              question={`Excluir ${cat.label}? ${uses ? `${plural(uses, 'gasto fica', 'gastos ficam')} ${target}` : 'Nenhum gasto usa essa categoria'}${recs ? `; ${plural(recs, 'recorrência vai', 'recorrências vão')} para ${moveTo === null ? 'Outros' : categoryMeta(state, moveTo).label}` : ''}${hasCap ? ' e o teto dela é removido' : ''}.`}
              loading={pending === 'delete'}
              onConfirm={async () => {
                const to = needsTarget ? moveTo : null
                if (await run('delete', () => categoriesApi.remove(cat.id, to), () => dispatch({ type: 'deleteCategory', id: cat.id, moveTo: to }), `Categoria ${cat.label} excluída`, 'Não deu para excluir. Tente de novo.')) back()
              }}
            />
        )}
      </form>
    </Sheet>
  )
}

/* ------------------------------------------------- Fatura importada */

function InvoiceImportSheet({ close, id }: { close: () => void; id: string }) {
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
            ['Cartão', card ? `${card.nickname} • ${card.last4}` : 'Sem cartão (Dinheiro)'],
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
          question={`Apagar ${plural(txs.length, 'lançamento', 'lançamentos')} desta fatura?${restores ? ` A fatura do ${card!.nickname} volta para ${privateMoney(brl(inv.previousInvoice!), hidden)}.` : ''}`}
          loading={pending === 'delete'}
          onConfirm={async () => {
            if (await run('delete', () => invoicesApi.remove(inv.id), () => dispatch({ type: 'undoInvoice', id: inv.id }), 'Importação desfeita', 'Não deu para desfazer. Tente de novo.')) close()
          }}
        />
      </div>
    </Sheet>
  )
}
