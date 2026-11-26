/**
 * Tetos e categorias: teto do mês, teto por categoria (com categoria nova) e gerenciar categorias.
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { CATEGORY_PALETTE, categoryMeta, findCategoryByLabel, hasCategory, nextCustomColor } from '../../data/categories'
import { chipTextWidth, CHIP, fitChips, suggestCategories } from '../../lib/categorySuggestions'
import { ChevronRight, Plus } from 'lucide-react'
import { Chip, cx, Field, inputClass, MoneyInput, PrimaryButton, Sheet } from '../../components/ui'
import { brlShort, privateMoney } from '../../lib/format'
import { useStore } from '../../state/store'
import { budgetApi, categoriesApi, rulesApi } from '../../services/finance'
import { useMutation } from '../../state/useMutation'
import { useUI } from '../../state/ui'
import { ConfirmDelete, useLast } from '../MoneySheets'
import type { CategoryId } from '../../types'
import { plural } from './common'

export function BudgetSheet({ close, category }: { close: () => void; category?: CategoryId }) {
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

export function CapSheet({ close }: { close: () => void }) {
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
        // Cada etapa entra no estado assim que grava: se uma seguinte falhar, a nova tentativa
        // reaproveita a categoria criada (não cria "Pets" duas vezes)
        const created = existingId ? null : await categoriesApi.create({ label, color })
        if (created) dispatch({ type: 'addCategory', category: created })
        const id = existingId ?? created!.id
        if (moved) {
          await categoriesApi.recategorize(txIds, id)
          dispatch({ type: 'recategorize', ids: txIds, category: id })
        }
        return budgetApi.setCap(id, value)
      },
      (cap) => dispatch({ type: 'setCap', category: cap.category, value: cap.value }),
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

export function CategoriesSheet({ close }: { close: () => void }) {
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

export function CategorySheet({ id }: { close: () => void; id?: string }) {
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
