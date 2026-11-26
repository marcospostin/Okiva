import { ArrowDownLeft, Camera, Check, CreditCard, Landmark, Lightbulb } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { categoryIds, categoryMeta, hasCategory } from '../data/categories'
import type { CategoryId } from '../types'
import { Asset, CategoryRowIcon } from '../components/icons'
import { ActionRow, Chip, CountUp, cx, FeatureCard, LinkButton, ListPanel, ListRow, Page, PrimaryButton, ProgressBar, RoundButton, ScreenHeader, SectionHeader } from '../components/ui'
import { brl, brlShort, monthKey, privateMoney } from '../lib/format'
import { INCOME_SOURCES, isIncomeSource } from '../lib/ledger'
import { invoiceFileKind, readInvoice, withInstallments, type InvoiceFileKind, type InvoiceItem, type InvoiceResult } from '../services/ai'
import { DemoNotice } from '../components/DemoNotice'
import { invoicesApi, type TransactionInput } from '../services/finance'
import { errorMessage } from '../services/http'
import { accountLabel, cardLabel, cardShort, currentMonth, ruleFor, todayISO, useStore } from '../state/store'
import { useMutation } from '../state/useMutation'
import { useUI } from '../state/ui'

type Phase = { name: 'pick' } | { name: 'reading'; file: File; progress: number } | { name: 'found'; result: InvoiceResult }

const MAX_MB = 20
/** OFX primeiro: é o formato que traz os dados exatos do banco. */
const FILE_ACCEPT = '.ofx,.qfx,.csv,.pdf,application/x-ofx,text/csv,application/pdf'
const KIND_LABEL: Record<InvoiceFileKind, string> = { ofx: 'OFX', csv: 'CSV', pdf: 'PDF', photo: 'Foto' }
const kindOfItem = (it: InvoiceItem) => it.kind ?? 'expense'

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
  /** Destino escolhido antes de enviar: "card:<id>" (fatura) ou "account:<id>" (extrato) */
  const [dest, setDest] = useState(() => (state.cards[0] ? `card:${state.cards[0].id}` : state.accounts[0] ? `account:${state.accounts[0].id}` : ''))
  const destType = dest.startsWith('account:') ? 'account' : 'card'
  const cardId = dest.startsWith('card:') ? dest.slice(5) : ''
  const accountId = dest.startsWith('account:') ? dest.slice(8) : ''
  /** Pagamento de fatura lido no extrato: de qual cartão (índice do item → id do cartão) */
  const [payCards, setPayCards] = useState<Record<number, string>>({})
  const hidden = state.hideBalance
  const fileInput = useRef<HTMLInputElement>(null)
  const photoInput = useRef<HTMLInputElement>(null)
  const abort = useRef<AbortController | null>(null)

  useEffect(() => () => abort.current?.abort(), [])

  async function start(file: File | undefined) {
    if (!file) return
    if (!invoiceFileKind(file)) return setError('Envie um arquivo OFX, CSV ou PDF, ou uma foto (JPG, PNG, HEIC).')
    if (file.size > MAX_MB * 1024 * 1024) return setError(`O arquivo passa de ${MAX_MB} MB.`)
    setError(null)
    abort.current?.abort()
    const ctrl = new AbortController()
    abort.current = ctrl
    setPhase({ name: 'reading', file, progress: 0 })
    try {
      const raw = await readInvoice(file, (progress) => setPhase({ name: 'reading', file, progress }), ctrl.signal, destType)
      // Compras parceladas ("PARC 04/10"): o Okiva lança as próximas parcelas sozinho
      const result = { ...raw, items: withInstallments(raw.items) }
      setSelected(new Set(result.items.map((_, i) => i)))
      setCats({})
      setPayCards({})
      setShowAll(false)
      setPhase({ name: 'found', result })
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setError(errorMessage(e, 'Não conseguimos ler esse arquivo. Tente o OFX ou o PDF.'))
        setPhase({ name: 'pick' })
      }
    }
  }

  const pickAgain = () => (phase.name === 'reading' && invoiceFileKind(phase.file) === 'photo' ? photoInput : fileInput).current?.click()

  /** Cartão do pagamento de fatura: o escolhido, senão o cartão cujo banco aparece no nome, senão o primeiro */
  const payCardOf = (i: number, it: InvoiceItem) =>
    payCards[i] ?? state.cards.find((c) => c.bank && it.name.toLowerCase().includes(c.bank.toLowerCase()))?.id ?? state.cards[0]?.id ?? ''

  async function confirm() {
    if (phase.name !== 'found') return
    const result = phase.result
    if (result.statement && accountId) return confirmStatement(result)
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
          state.cards,
        ),
      (r) => dispatch({ type: 'importInvoice', txs: r.transactions, card: r.card, invoice: r.invoice, cards: r.cards }),
      () => {
        const n = comuns.length + parceladas.length
        const extra = parceladas.reduce((s, it) => s + (it.installment!.total - it.installment!.number), 0)
        return `${n} ${n === 1 ? 'lançamento adicionado' : 'lançamentos adicionados'}${extra ? ` · ${extra} parcelas futuras` : ''}${toSort ? ` · ${toSort} para classificar` : ''}`
      },
      'Não deu para salvar os lançamentos. Tente de novo.',
    )
    if (ok) navigate('home')
  }

  /** Extrato de conta: entradas viram receitas, saídas viram gastos da conta e o pagamento abate a fatura do cartão */
  async function confirmStatement(result: InvoiceResult) {
    const chosen = result.items.map((it, i) => ({ it, i })).filter(({ i }) => selected.has(i))
    const items: TransactionInput[] = chosen.map(({ it, i }) => {
      const k = kindOfItem(it)
      const payCard = k === 'invoice_payment' ? payCardOf(i, it) : ''
      // Sem cartão cadastrado, o pagamento de fatura entra como gasto comum ("outros")
      if (k === 'invoice_payment' && payCard)
        return { kind: 'invoice_payment', name: it.name, category: 'outros', amount: it.amount, date: it.date, method: { type: 'card', cardId: payCard }, accountId, source: 'fatura' }
      if (k === 'income')
        return { kind: 'income', name: it.name, category: categoryOf(i) ?? 'receita_outros', amount: it.amount, date: it.date, method: { type: 'pix' }, accountId, source: 'fatura' }
      return { kind: 'expense', name: it.name, category: k === 'invoice_payment' ? 'outros' : categoryOf(i), amount: it.amount, date: it.date, method: { type: 'pix' }, accountId, source: 'fatura' }
    })
    const toSort = items.filter((t) => t.kind === 'expense' && t.category === null).length
    const outflow = Math.round(items.filter((t) => t.kind !== 'income').reduce((s, t) => s + t.amount, 0) * 100) / 100
    const ok = await run(
      'confirm',
      () => invoicesApi.import({ cardId: null, accountId, total: outflow, fileName: result.fileName, items }, null, todayISO(), state.cards),
      (r) => dispatch({ type: 'importInvoice', txs: r.transactions, card: r.card, invoice: r.invoice, cards: r.cards }),
      () => `${items.length} ${items.length === 1 ? 'lançamento adicionado' : 'lançamentos adicionados'}${toSort ? ` · ${toSort} para classificar` : ''}`,
      'Não deu para salvar os lançamentos. Tente de novo.',
    )
    if (ok) navigate('home')
  }

  const found = phase.name === 'found' ? phase.result : null
  /** Categoria da IA (se a pessoa ainda tem), senão a regra aprendida pelo nome, senão sem categoria */
  const aiCategory = (i: number): CategoryId | null => {
    const it = found?.items[i]
    if (!it) return null
    if (kindOfItem(it) === 'invoice_payment') return 'outros'
    if (kindOfItem(it) === 'income') return it.category && isIncomeSource(it.category) ? it.category : 'receita_outros'
    if (it.category && hasCategory(state, it.category)) return it.category
    return ruleFor(state, it.name) ?? null
  }
  const categoryOf = (i: number): CategoryId | null => (i in cats ? cats[i] : aiCategory(i))
  const learned = (i: number) => !(i in cats) && !!found && kindOfItem(found.items[i]) === 'expense' && !found.items[i].category && aiCategory(i) !== null
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
  const kind = KIND_LABEL[(phase.name === 'reading' ? invoiceFileKind(phase.file) : found?.kind) ?? 'pdf']
  const selectedItems = found ? found.items.filter((_, i) => selected.has(i)) : []
  const signed = (it: InvoiceItem) => (kindOfItem(it) === 'income' ? it.amount : -it.amount)
  const statement = !!found?.statement
  // Fatura: soma das compras. Extrato: entradas − saídas (pode ser negativo)
  const selectedTotal = statement ? selectedItems.reduce((s, it) => s + signed(it), 0) : selectedItems.reduce((s, it) => s + it.amount, 0)
  const incomes = found ? found.items.filter((it) => kindOfItem(it) === 'income').length : 0
  const net = found ? found.items.reduce((s, it) => s + signed(it), 0) : 0
  const reads = destType === 'account' ? 'extrato' : 'fatura'
  const subs = found ? found.items.filter((i) => i.subscription).length : 0
  const foundInstallments = found ? found.items.filter((it, i) => it.installment && selected.has(i)) : []
  // Importing twice for the same card in the same month would duplicate every purchase
  const alreadyImported =
    !!found &&
    (statement
      ? state.invoices.some((i) => monthKey(i.importedAt) === currentMonth() && i.accountId === accountId)
      : state.invoices.some((i) => monthKey(i.importedAt) === currentMonth() && i.cardId === (cardId || null) && !i.accountId) ||
      state.transactions.some(
        (t) => t.source === 'fatura' && monthKey(t.date) === currentMonth() && (cardId ? t.method.type === 'card' && t.method.cardId === cardId : t.method.type === 'cash'),
      ))

  return (
    <div className="min-h-[calc(100dvh-var(--tabbar-space,0px))] bg-esk-bg-2">
      <input ref={fileInput} type="file" accept={FILE_ACCEPT} className="hidden" onChange={(e) => { start(e.target.files?.[0]); e.target.value = '' }} />
      <input ref={photoInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { start(e.target.files?.[0]); e.target.value = '' }} />
      <Page>
        <ScreenHeader
          title="Importar"
          action={
            <RoundButton label="Escolher arquivo" onClick={() => fileInput.current?.click()}>
              <Asset name="c2640.svg" size={19} />
            </RoundButton>
          }
        />

        <div className="grid gap-x-12 wide:grid-cols-2 md:pt-4 lg:gap-x-16">
          <div className="flex flex-col">
            <DemoNotice className="mt-6">
              A leitura de faturas e extratos ainda não funciona de verdade. Qualquer arquivo mostra lançamentos de exemplo, que você pode confirmar para testar.
            </DemoNotice>
            <div className="pt-6">
              {phase.name === 'pick' ? (
                <FeatureCard>
                  <div className="flex items-center justify-between font-sat text-[15px] font-medium">
                    <span>OFX, CSV, PDF ou foto</span>
                    <span>Okiva Plus</span>
                  </div>
                  <div>
                    <p className="font-sat text-[15px] font-medium">Tudo vira lançamento</p>
                    <p className="pt-[6px] font-sat text-[34px] leading-[36px] font-medium tracking-[-1.36px]">Envie sua fatura ou extrato</p>
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
                      {found ? (statement ? 'Extrato lido' : 'Fatura lida') : (
                        <>
                          Lendo {reads === 'extrato' ? 'seu extrato' : 'sua fatura'}
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

            {phase.name === 'pick' ? (
              <div className="flex flex-col gap-3 pt-5" role="group" aria-labelledby="dest-label">
                <p id="dest-label" className="font-sat text-[15px] font-medium text-white">
                  De onde é esse arquivo?
                </p>
                {state.cards.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="w-full font-sat text-[12px] text-esk-subtle">Fatura do cartão</span>
                    {state.cards.map((c) => (
                      <Chip key={c.id} active={dest === `card:${c.id}`} onClick={() => setDest(`card:${c.id}`)}>
                        {cardShort(c)}
                      </Chip>
                    ))}
                  </div>
                )}
                {state.accounts.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="w-full font-sat text-[12px] text-esk-subtle">Extrato da conta</span>
                    {state.accounts.map((a) => (
                      <Chip key={a.id} active={dest === `account:${a.id}`} onClick={() => setDest(`account:${a.id}`)}>
                        {accountLabel(state, a.id)}
                      </Chip>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="flex flex-wrap items-center gap-x-2 pt-4 font-sat text-[14px] text-esk-muted">
                {destType === 'account' ? <Landmark size={16} strokeWidth={1.7} aria-hidden /> : <CreditCard size={16} strokeWidth={1.7} aria-hidden />}
                <span>
                  {destType === 'account' ? 'Extrato da conta' : 'Fatura do cartão'}{' '}
                  <span className="text-white">
                    {destType === 'account'
                      ? accountLabel(state, accountId)
                      : (() => {
                          const c = state.cards.find((x) => x.id === cardId)
                          return c ? cardLabel(c) : 'sem cartão (Dinheiro)'
                        })()}
                  </span>
                </span>
                {phase.name === 'found' && (
                  <LinkButton onClick={() => setPhase({ name: 'pick' })}>Trocar</LinkButton>
                )}
              </p>
            )}

            <div className="flex flex-col gap-[10px] pt-4">
              <ActionRow
                icon={<Asset name="f4010.svg" size={24} />}
                label={phase.name === 'pick' ? 'Enviar arquivo' : `Enviar outro ${kind === 'Foto' ? 'arquivo' : kind}`}
                onClick={phase.name === 'pick' ? () => fileInput.current?.click() : pickAgain}
              />
              {phase.name === 'pick' && (
                <ActionRow icon={<Camera size={24} strokeWidth={1.8} className="text-esk-ink" />} label={destType === 'account' ? 'Tirar foto do extrato' : 'Tirar foto da fatura'} onClick={() => photoInput.current?.click()} />
              )}
            </div>
            {phase.name === 'pick' && (
              <div className="mt-4 flex items-start gap-3 rounded-[20px] bg-esk-surface px-4 py-[14px] ring-1 ring-esk-track">
                <Lightbulb size={20} strokeWidth={1.8} className="mt-[1px] shrink-0 text-esk-lime" aria-hidden />
                <p className="font-sat text-[14px] leading-[1.45] text-esk-muted">
                  <span className="font-medium text-white">Prefira o arquivo OFX.</span> Ele vem com os dados exatos do banco (data, valor e descrição), então a leitura sai mais precisa que no PDF ou na foto. Procure por “Exportar OFX” no app ou no site do seu banco.
                </p>
              </div>
            )}
            {error && <p role="alert" className="pt-4 font-sat text-[14px] text-esk-lilac">{error}</p>}
          </div>

          <div className="flex flex-col gap-[18px] pt-[42px] md:pt-6">
            <SectionHeader title="Encontramos" />
            <ListPanel>
              <ListRow
                icon={<Asset name="04670.svg" size={20} />}
                title={reads === 'extrato' ? 'Lançamentos' : 'Compras'}
                subtitle={found && pendingItems ? `${pendingItems} sem categoria` : 'Categorizadas com IA'}
                value={found ? <CountUp value={found.items.length} format={(n) => String(Math.round(n))} /> : <Skeleton active={phase.name === 'reading'} />}
              />
              {reads === 'extrato' ? (
                <>
                  <ListRow
                    icon={<ArrowDownLeft size={20} strokeWidth={1.7} className="text-esk-lime" aria-hidden />}
                    title="Entradas"
                    subtitle="Salário, Pix recebido, rendimentos"
                    value={found ? <CountUp value={incomes} format={(n) => String(Math.round(n))} /> : <Skeleton active={phase.name === 'reading'} />}
                  />
                  <ListRow
                    icon={<Asset name="97e22.svg" size={20} />}
                    title="Entradas − saídas"
                    subtitle={found ? 'No período do extrato' : phase.name === 'reading' ? 'Lendo com IA…' : 'Aguardando leitura'}
                    value={
                      found ? (
                        <CountUp value={net} format={(n) => privateMoney(`${n < 0 ? '− ' : '+ '}${brlShort(Math.abs(Math.round(n)))}`, hidden)} />
                      ) : (
                        <Skeleton active={phase.name === 'reading'} />
                      )
                    }
                  />
                </>
              ) : (
                <>
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
                </>
              )}
            </ListPanel>

            {found && (
              <div className="flex animate-rise flex-col gap-4 pt-4">
                <div className="flex items-baseline justify-between">
                  <h2 className="font-sat text-[17px] font-medium text-white">Confirme os lançamentos</h2>
                  <LinkButton onClick={() => setSelected(selected.size === found.items.length ? new Set() : new Set(found.items.map((_, i) => i)))}>
                    {selected.size === found.items.length ? 'Desmarcar todos' : 'Marcar todos'}
                  </LinkButton>
                </div>

                {statement && found.items.some((it) => kindOfItem(it) === 'invoice_payment') && (
                  <p className="rounded-[18px] bg-esk-elevated px-4 py-3 font-sat text-[13px] leading-[1.45] text-esk-muted ring-1 ring-esk-track">
                    {state.cards.length > 0
                      ? 'O pagamento de fatura abate a fatura do cartão escolhido e não conta como gasto de novo.'
                      : 'Sem cartão cadastrado: o pagamento de fatura entra como gasto em "Outros".'}
                  </p>
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
                    const k = kindOfItem(it)
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
                            {k === 'income' ? (
                              <ArrowDownLeft size={18} strokeWidth={1.7} className="text-esk-lime" aria-hidden />
                            ) : k === 'invoice_payment' ? (
                              <CreditCard size={17} strokeWidth={1.6} className="text-esk-text-2" aria-hidden />
                            ) : (
                              <CategoryRowIcon category={category} name={it.name} size={17} />
                            )}
                          </span>
                          <span className="min-w-0 flex-1 truncate font-sat text-[15px] font-medium text-white">{it.name}</span>
                          <span className={cx('font-sat text-[15px] font-medium whitespace-nowrap', k === 'income' ? 'text-esk-lime' : 'text-white')}>
                            {k === 'income' ? '+' : '−'} {privateMoney(brl(it.amount), hidden)}
                          </span>
                        </button>
                        <div className="flex items-center gap-2 pt-1 pl-[70px]">
                          {k === 'invoice_payment' ? (
                            state.cards.length > 0 ? (
                              <select
                                aria-label={`Cartão pago em ${it.name}`}
                                value={payCardOf(idx, it)}
                                onChange={(e) => setPayCards((c) => ({ ...c, [idx]: e.target.value }))}
                                className="cursor-pointer rounded-[10px] bg-transparent py-1 font-sat text-[12px] text-esk-subtle outline-none hover:text-white focus:text-white"
                              >
                                {state.cards.map((c) => (
                                  <option key={c.id} value={c.id} className="bg-esk-elevated text-white">
                                    Pagamento da fatura · {cardShort(c)}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="py-1 font-sat text-[12px] text-esk-subtle">Pagamento de fatura</span>
                            )
                          ) : k === 'income' ? (
                            <select
                              aria-label={`Tipo de entrada de ${it.name}`}
                              value={category ?? 'receita_outros'}
                              onChange={(e) => setCats((c) => ({ ...c, [idx]: e.target.value as CategoryId }))}
                              className="cursor-pointer rounded-[10px] bg-transparent py-1 font-sat text-[12px] text-esk-subtle outline-none hover:text-white focus:text-white"
                            >
                              {INCOME_SOURCES.map((src) => (
                                <option key={src.id} value={src.id} className="bg-esk-elevated text-white">
                                  {src.label}
                                </option>
                              ))}
                            </select>
                          ) : (
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
                          )}
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
                    {statement
                      ? 'Você já importou um extrato desta conta este mês. Confirmar de novo pode duplicar os lançamentos.'
                      : `Você já importou uma fatura ${cardId ? 'deste cartão' : 'sem cartão'} este mês. Confirmar de novo duplica os lançamentos.`}
                  </p>
                )}
                <PrimaryButton disabled={selected.size === 0} onClick={confirm} loading={pending === 'confirm'} loadingText="Salvando lançamentos…">
                  Confirmar {selected.size} {selected.size === 1 ? 'lançamento' : 'lançamentos'} ·{' '}
                  {statement ? `${selectedTotal < 0 ? '− ' : '+ '}${privateMoney(brl(Math.abs(selectedTotal)), hidden)}` : privateMoney(brl(selectedTotal), hidden)}
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
