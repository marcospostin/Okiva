/**
 * Metas: criar/editar meta, guardar dinheiro e histórico de depósitos.
 */
import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { Chip, cx, Field, inputClass, MoneyInput, PrimaryButton, Sheet, Switch } from '../../components/ui'
import { brl, brlShort, isValidDate, longDate, MIN_DATE, pct, privateMoney } from '../../lib/format'
import { currentMonth, todayISO, useStore } from '../../state/store'
import { goalsApi } from '../../services/finance'
import { useMutation } from '../../state/useMutation'
import { useUI } from '../../state/ui'
import { ConfirmDelete, useLast } from '../MoneySheets'
import type { Goal } from '../../types'

const GOAL_ICONS: Goal['icon'][] = ['plane', 'shield', 'book', 'car', 'target', 'home']

export function GoalSheet({ close, id }: { close: () => void; id?: string }) {
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

export function SaveSheet({ close, goalId }: { close: () => void; goalId: string }) {
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
              // O depósito já foi gravado: se só "meta principal" falhar, não deixa tentar de novo (guardaria em dobro)
              const featured = featuring ? await goalsApi.update({ ...goal, featured: true }).then(() => true, () => !deposit && Promise.reject()) : false
              return { deposit, featured }
            },
            ({ deposit, featured }) => {
              if (deposit) dispatch({ type: 'deposit', deposit })
              if (featured) dispatch({ type: 'feature', goalId: goal.id })
            },
            ({ featured }) => (featuring && !featured ? `${message().split(' · ')[0]} · não deu para tornar meta principal agora` : message()),
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

export function DepositSheet({ close, id }: { close: () => void; id: string }) {
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
  const dateError = tries && !date ? 'Escolha a data.' : tries && !isValidDate(date) ? 'Confira a data.' : tries && date > todayISO() ? 'A data não pode ser no futuro.' : undefined

  async function save() {
    setTries((n) => n + 1)
    if (amount <= 0 || !isValidDate(date) || date > todayISO() || !dep) return
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
          <input id="depdate" type="date" className={inputClass} value={date} min={MIN_DATE} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
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
