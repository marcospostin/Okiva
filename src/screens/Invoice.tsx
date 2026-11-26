import { Camera, Check } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { categoryIds, categoryMeta, hasCategory } from '../data/categories'
import type { CategoryId } from '../types'
import { Asset, CategoryRowIcon } from '../components/icons'
import { ActionRow, Chip, CountUp, cx, FeatureCard, LinkButton, ListPanel, ListRow, Page, PrimaryButton, ProgressBar, RoundButton, ScreenHeader, SectionHeader } from '../components/ui'
import { brl, brlShort, monthKey, privateMoney } from '../lib/format'
import { readInvoice, withInstallments, type InvoiceResult } from '../services/ai'
import { invoicesApi } from '../services/finance'
import { errorMessage } from '../services/http'
import { cardLabel, currentMonth, ruleFor, todayISO, useStore } from '../state/store'
import { useMutation } from '../state/useMutation'
import { useUI } from '../state/ui'

type Phase = { name: 'pick' } | { name: 'reading'; file: File; progress: number } | { name: 'found'; result: InvoiceResult }

const MAX_MB = 20

export default function Invoice() {
  const { state, dispatch } = useStore()
  const { navigate } = useUI()
  const { run, pending } = useMutation()
  const [phase, setPhase] = useState<Phase>({ name: 'pick' })
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [showAll, setShowAll] = useState(false)
  /** Category corrections made by the person before confirming (null = deixar sem categoria) */
  const [cats, setCats] = useState<Record<number, CategoryId | null>>({})
  const [cardId, setCardId] = useState(state.cards[0]?.id ?? '')
  const hidden = state.hideBalance
  const pdfInput = useRef<HTMLInputElement>(null)
  const photoInput = useRef<HTMLInputElement>(null)
  const abort = useRef<AbortController | null>(null)

  useEffect(() => () => abort.current?.abort(), [])

  async function start(file: File | undefined) {
    if (!file) return
    const ok = file.type === 'application/pdf' || file.type.startsWith('image/')
    if (!ok) return setError('Envie um PDF ou uma foto (JPG, PNG, HEIC).')
    if (file.size > MAX_MB * 1024 * 1024) return setError(`O arquivo passa de ${MAX_MB} MB.`)
    setError(null)
    abort.current?.abort()
    const ctrl = new AbortController()
    abort.current = ctrl
    setPhase({ name: 'reading', file, progress: 0 })
    try {
      const raw = await readInvoice(file, (progress) => setPhase({ name: 'reading', file, progress }), ctrl.signal)
      // Compras parceladas ("PARC 04/10"): o Okiva lança as próximas parcelas sozinho
      const result = { ...raw, items: withInstallments(raw.items) }
      setSelected(new Set(result.items.map((_, i) => i)))
      setCats({})
      setShowAll(false)
      setPhase({ name: 'found', result })
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setError(errorMessage(e, 'Não conseguimos ler essa fatura. Tente outra foto ou o PDF.'))
        setPhase({ name: 'pick' })
      }
    }
  }

  const pickAgain = () => (phase.name === 'reading' && phase.file.type.startsWith('image/') ? photoInput : pdfInput).current?.click()

  async function confirm() {
    if (phase.name !== 'found') return
    const result = phase.result
    const items = result.items
      .map((it, i) => ({ ...it, category: categoryOf(i) }))
      .filter((_, i) => selected.has(i))
    const toSort = items.filter((it) => it.category === null).length
    const card = state.cards.find((c) => c.id === cardId) ?? null
    // Com cartão, compra parcelada vira "em andamento": a parcela desta fatura (já no total lido)
    // e as próximas, uma por mês. Sem cartão, entra como lançamento comum.
    const parceladas = card ? items.filter((it) => it.installment) : []
    const comuns = items.filter((it) => !parceladas.includes(it))
    const ok = await run(
      'confirm',
      // Uma operação só no banco: lançamentos, parcelas em andamento e a fatura entram juntos
      () =>
        invoicesApi.import(
          {
            cardId: card?.id ?? null,
            total: result.total,
            fileName: result.fileName,
            items: comuns.map((it) => ({
              name: it.name,
              category: it.category,
              amount: it.amount,
              date: it.date,
              method: card ? { type: 'card', cardId: card.id } : { type: 'cash' },
              source: 'fatura',
            })),
            ongoing: parceladas.map((it) => ({
              name: it.name,
              category: it.category,
              amount: it.amount,
              current: it.installment!.number,
              total: it.installment!.total,
              date: it.date,
            })),
          },
          card,
          todayISO(),
        ),
      (r) => dispatch({ type: 'importInvoice', txs: r.transactions, card: r.card, invoice: r.invoice }),
      () => {
        const n = comuns.length + parceladas.length
        const extra = parceladas.reduce((s, it) => s + (it.installment!.total - it.installment!.number), 0)
        return `${n} ${n === 1 ? 'lançamento adicionado' : 'lançamentos adicionados'}${extra ? ` · ${extra} parcelas futuras` : ''}${toSort ? ` · ${toSort} para classificar` : ''}`
      },
      'Não deu para salvar os lançamentos. Tente de novo.',
    )
    if (ok) navigate('home')
  }

  const found = phase.name === 'found' ? phase.result : null
  /** Categoria da IA (se a pessoa ainda tem), senão a regra aprendida pelo nome, senão sem categoria */
  const aiCategory = (i: number): CategoryId | null => {
    const it = found?.items[i]
    if (!it) return null
    if (it.category && hasCategory(state, it.category)) return it.category
    return ruleFor(state, it.name) ?? null
  }
  const categoryOf = (i: number): CategoryId | null => (i in cats ? cats[i] : aiCategory(i))
  const learned = (i: number) => !(i in cats) && !!found && !found.items[i].category && aiCategory(i) !== null
  // Sem categoria primeiro, para ninguém deixar passar. A ordem é decidida uma vez, quando a leitura
  // chega: classificar um item não o faz pular de lugar (antes o próximo toque caía no item errado).
  const order = useMemo(
    () => (found ? found.items.map((_, i) => i).sort((a, b) => Number(aiCategory(b) === null) - Number(aiCategory(a) === null)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [found],
  )
  const pendingItems = order.filter((i) => categoryOf(i) === null).length
  const progress = phase.name === 'reading' ? phase.progress : found ? 100 : 0
  const fileName = phase.name === 'reading' ? phase.file.name : found?.fileName
  const kind = phase.name === 'reading' ? (phase.file.type.startsWith('image/') ? 'Foto' : 'PDF') : found?.kind === 'photo' ? 'Foto' : 'PDF'
  const selectedItems = found ? found.items.filter((_, i) => selected.has(i)) : []
  const selectedTotal = selectedItems.reduce((s, it) => s + it.amount, 0)
  const subs = found ? found.items.filter((i) => i.subscription).length : 0
  const foundInstallments = found ? found.items.filter((it, i) => it.installment && selected.has(i)) : []
  // Importing twice for the same card in the same month would duplicate every purchase
  const alreadyImported =
    !!found &&
    (state.invoices.some((i) => monthKey(i.importedAt) === currentMonth() && i.cardId === (cardId || null)) ||
      state.transactions.some(
        (t) => t.source === 'fatura' && monthKey(t.date) === currentMonth() && (cardId ? t.method.type === 'card' && t.method.cardId === cardId : t.method.type === 'cash'),
      ))

  return (
    <div className="min-h-[calc(100dvh-var(--tabbar-space,0px))] bg-esk-bg-2">
      <input ref={pdfInput} type="file" accept="application/pdf" className="hidden" onChange={(e) => { start(e.target.files?.[0]); e.target.value = '' }} />
      <input ref={photoInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { start(e.target.files?.[0]); e.target.value = '' }} />
      <Page>
        <ScreenHeader
          title="Importar fatura"
          action={
            <RoundButton label="Escolher PDF" onClick={() => pdfInput.current?.click()}>
              <Asset name="c2640.svg" size={19} />
            </RoundButton>
          }
        />

        <div className="grid gap-x-12 wide:grid-cols-2 md:pt-4 lg:gap-x-16">
          <div className="flex flex-col">
            <div className="pt-6">
              {phase.name === 'pick' ? (
                <FeatureCard>
                  <div className="flex items-center justify-between font-sat text-[15px] font-medium">
                    <span>PDF ou foto</span>
                    <span>Okiva Plus</span>
                  </div>
                  <div>
                    <p className="font-sat text-[15px] font-medium">Sua fatura vira lançamentos</p>
                    <p className="pt-[6px] font-sat text-[34px] leading-[36px] font-medium tracking-[-1.36px]">Envie sua fatura</p>
                    <p className="pt-3 font-sat text-[14px] font-medium opacity-70">A IA lê, categoriza e você confirma.</p>
                  </div>
                </FeatureCard>
              ) : (
                <FeatureCard>
                  <div className="flex items-center justify-between font-sat text-[15px] font-medium">
                    <span>{kind}</span>
                    <span aria-live="polite">{progress}%</span>
                  </div>
                  <div>
                    <p className="truncate font-sat text-[15px] font-medium">{fileName}</p>
                    <p key={found ? 'done' : 'reading'} className="animate-rise pt-[6px] font-sat text-[34px] leading-[34px] font-medium tracking-[-1.36px]">
                      {found ? 'Fatura lida' : (
                        <>
                          Lendo sua fatura
                          <span className="animate-caret">…</span>
                        </>
                      )}
                    </p>
                    <ProgressBar value={progress} tone="ink" className="mt-[14px]" />
                  </div>
                </FeatureCard>
              )}
              {phase.name === 'reading' && (
                <div className="pt-3">
                  <LinkButton
                    onClick={() => {
                      abort.current?.abort()
                      setPhase({ name: 'pick' })
                    }}
                  >
                    Cancelar leitura
                  </LinkButton>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-[10px] pt-3">
              <ActionRow
                icon={<Asset name="f4010.svg" size={24} />}
                label={phase.name === 'pick' ? 'Enviar PDF' : `Enviar outro ${kind === 'Foto' ? 'arquivo' : 'PDF'}`}
                onClick={phase.name === 'pick' ? () => pdfInput.current?.click() : pickAgain}
              />
              {phase.name === 'pick' && (
                <ActionRow icon={<Camera size={24} strokeWidth={1.8} className="text-esk-ink" />} label="Tirar foto da fatura" onClick={() => photoInput.current?.click()} />
              )}
            </div>
            {error && <p role="alert" className="pt-4 font-sat text-[14px] text-esk-lilac">{error}</p>}
          </div>

          <div className="flex flex-col gap-[18px] pt-[42px] md:pt-6">
            <SectionHeader title="Encontramos" />
            <ListPanel>
              <ListRow
                icon={<Asset name="04670.svg" size={20} />}
                title="Compras"
                subtitle={found && pendingItems ? `${pendingItems} sem categoria` : 'Categorizadas com IA'}
                value={found ? <CountUp value={found.items.length} format={(n) => String(Math.round(n))} /> : <Skeleton active={phase.name === 'reading'} />}
              />
              <ListRow
                icon={<Asset name="7f1c0.svg" size={20} />}
                title="Assinaturas"
                subtitle="Cobranças recorrentes"
                value={found ? <CountUp value={subs} format={(n) => String(Math.round(n))} /> : <Skeleton active={phase.name === 'reading'} />}
              />
              <ListRow
                icon={<Asset name="97e22.svg" size={20} />}
                title="Total da fatura"
                subtitle={found ? `Vence em ${found.dueInDays} ${found.dueInDays === 1 ? 'dia' : 'dias'}` : phase.name === 'reading' ? 'Lendo com IA…' : 'Aguardando leitura'}
                value={found ? <CountUp value={found.total} format={(n) => privateMoney(brlShort(Math.round(n)), hidden)} /> : <Skeleton active={phase.name === 'reading'} />}
              />
            </ListPanel>

            {found && (
              <div className="flex animate-rise flex-col gap-4 pt-4">
                <div className="flex items-baseline justify-between">
                  <h2 className="font-sat text-[17px] font-medium text-white">Confirme os lançamentos</h2>
                  <LinkButton onClick={() => setSelected(selected.size === found.items.length ? new Set() : new Set(found.items.map((_, i) => i)))}>
                    {selected.size === found.items.length ? 'Desmarcar todos' : 'Marcar todos'}
                  </LinkButton>
                </div>

                {state.cards.length === 0 && (
                  <p className="font-sat text-[13px] text-esk-subtle">Sem cartão cadastrado: os lançamentos entram como Dinheiro.</p>
                )}
                {state.cards.length > 0 && (
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Cartão da fatura">
                    {state.cards.map((c) => (
                      <Chip key={c.id} active={cardId === c.id} onClick={() => setCardId(c.id)}>
                        {cardLabel(c)}
                      </Chip>
                    ))}
                  </div>
                )}

                {pendingItems > 0 && (
                  <p className="rounded-[18px] bg-esk-lilac/10 px-4 py-3 font-sat text-[13px] leading-[1.4] text-esk-lilac ring-1 ring-esk-lilac/30">
                    {pendingItems === 1 ? '1 compra ficou' : `${pendingItems} compras ficaram`} sem categoria: a IA não reconheceu o nome. Escolha agora ou importe assim e classifique depois na Home.
                  </p>
                )}

                {foundInstallments.length > 0 && (
                  <p className="rounded-[18px] bg-esk-elevated px-4 py-3 font-sat text-[13px] leading-[1.45] text-esk-muted ring-1 ring-esk-track">
                    Encontramos {foundInstallments.length === 1 ? '1 compra parcelada' : `${foundInstallments.length} compras parceladas`}:{' '}
                    <span className="text-white">
                      {foundInstallments.map((it) => `${it.name} (${it.installment!.number} de ${it.installment!.total})`).join(', ')}
                    </span>
                    .{' '}
                    {cardId
                      ? 'As próximas parcelas serão lançadas automaticamente, mês a mês.'
                      : 'Escolha o cartão da fatura para o Okiva lançar as próximas parcelas.'}
                  </p>
                )}

                <ul className="flex flex-col rounded-[26px] bg-esk-surface p-2">
                  {(showAll ? order : order.slice(0, 8)).map((idx) => {
                    const it = found.items[idx]
                    const on = selected.has(idx)
                    const category = categoryOf(idx)
                    return (
                      <li key={idx} className="flex flex-col rounded-[18px] px-2 py-[10px] transition hover:bg-white/[0.03]">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={on}
                          onClick={() => {
                            const next = new Set(selected)
                            if (on) next.delete(idx)
                            else next.add(idx)
                            setSelected(next)
                          }}
                          className="flex w-full items-center gap-3 text-left"
                        >
                          <span className={cx('grid size-[22px] shrink-0 place-items-center rounded-[7px] transition duration-200', on ? 'animate-check-pop bg-esk-lime text-esk-ink' : 'ring-1 ring-esk-subtle')}>
                            {on && <Check size={14} strokeWidth={2.4} className="animate-check-draw" />}
                          </span>
                          <span className="grid size-[36px] shrink-0 place-items-center rounded-full bg-esk-row">
                            <CategoryRowIcon category={category} name={it.name} size={17} />
                          </span>
                          <span className="min-w-0 flex-1 truncate font-sat text-[15px] font-medium text-white">{it.name}</span>
                          <span className="font-sat text-[15px] font-medium whitespace-nowrap text-white">− {privateMoney(brl(it.amount), hidden)}</span>
                        </button>
                        <div className="flex items-center gap-2 pt-1 pl-[70px]">
                          <select
                            aria-label={`Categoria de ${it.name}`}
                            value={category ?? ''}
                            onChange={(e) => setCats((c) => ({ ...c, [idx]: (e.target.value || null) as CategoryId | null }))}
                            className={cx(
                              'cursor-pointer rounded-[10px] bg-transparent py-1 font-sat text-[12px] outline-none hover:text-white focus:text-white',
                              category === null ? 'text-esk-lilac' : 'text-esk-subtle',
                            )}
                          >
                            <option value="" className="bg-esk-elevated text-white">
                              {category === null ? 'Escolher categoria…' : 'Sem categoria'}
                            </option>
                            {categoryIds(state).map((c) => (
                              <option key={c} value={c} className="bg-esk-elevated text-white">
                                {categoryMeta(state, c).label}
                              </option>
                            ))}
                          </select>
                          {idx in cats && <span className="font-sat text-[12px] text-esk-lime-soft">ajustado</span>}
                          {learned(idx) && <span className="font-sat text-[12px] text-esk-subtle">· como da última vez</span>}
                          {it.subscription && <span className="font-sat text-[12px] text-esk-subtle">· recorrente</span>}
                          {it.installment && (
                            <span className="font-sat text-[12px] text-esk-lilac">
                              · parcela {it.installment.number} de {it.installment.total}
                              {cardId && it.installment.number < it.installment.total ? ` · +${it.installment.total - it.installment.number} próximas` : ''}
                            </span>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
                {order.length > 8 && (
                  <LinkButton onClick={() => setShowAll((v) => !v)}>{showAll ? 'Mostrar menos' : `Ver mais (${found.items.length - 8})`}</LinkButton>
                )}

                {alreadyImported && (
                  <p role="status" className="animate-rise rounded-[18px] bg-esk-elevated px-4 py-3 font-sat text-[13px] leading-[1.4] text-esk-lilac ring-1 ring-esk-track">
                    Você já importou uma fatura {cardId ? 'deste cartão' : 'sem cartão'} este mês. Confirmar de novo duplica os lançamentos.
                  </p>
                )}
                <PrimaryButton disabled={selected.size === 0} onClick={confirm} loading={pending === 'confirm'} loadingText="Salvando lançamentos…">
                  Confirmar {selected.size} {selected.size === 1 ? 'lançamento' : 'lançamentos'} · {privateMoney(brl(selectedTotal), hidden)}
                </PrimaryButton>
              </div>
            )}
          </div>
        </div>
      </Page>
    </div>
  )
}

function Skeleton({ active }: { active: boolean }) {
  return <span className={cx('inline-block h-[14px] w-[44px] rounded-[7px]', active ? 'skeleton-shimmer animate-shimmer' : 'bg-esk-track')} aria-label={active ? 'Carregando' : 'Aguardando'} />
}
