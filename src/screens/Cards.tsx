import { FileText } from 'lucide-react'
import { Asset } from '../components/icons'
import { EmptyState, LinkButton, ListPanel, ListRow, Page, PrimaryButton, ProgressBar, RoundButton, ScreenHeader, SectionHeader } from '../components/ui'
import { brlShort, longDate, pct, privateMoney } from '../lib/format'
import { cardsApi } from '../services/finance'
import { daysUntilDue, useStore } from '../state/store'
import { useUI } from '../state/ui'
import type { Card } from '../types'

const CARD_BG: Record<Card['color'], string> = {
  gradient: 'var(--esk-gradient-wallet)',
  lilac: 'linear-gradient(#bbaaf8, #bbaaf8)',
  offwhite: 'linear-gradient(#f1f1ee, #f1f1ee)',
}
/** Colors follow stack position (front first), so neighbours never share a color. */
const STACK_COLORS: Card['color'][] = ['gradient', 'lilac', 'offwhite']
const CARD_H = 214
const dueLabel = (d: number) => (d === 0 ? 'Vence hoje' : `Vence em ${d} ${d === 1 ? 'dia' : 'dias'}`)
const OFFSET = 46

export default function Cards() {
  const { state, dispatch } = useStore()
  const { openSheet } = useUI()
  const hidden = state.hideBalance
  const ordered = state.cardOrder.map((id) => state.cards.find((c) => c.id === id)).filter(Boolean) as Card[]
  const front = ordered[ordered.length - 1]
  const used = front ? pct(front.invoice, front.limit) : 0
  const upcoming = [...state.cards].sort((a, b) => daysUntilDue(a) - daysUntilDue(b))

  const addCard = (
    <RoundButton label="Novo cartão" onClick={() => openSheet({ type: 'card' })}>
      <Asset name="5e25d.svg" size={19} />
    </RoundButton>
  )

  return (
    <div className="min-h-[calc(100dvh-var(--tabbar-space,0px))] bg-esk-bg-2">
      <Page>
        <ScreenHeader title="Meus cartões" action={addCard} />

        {ordered.length === 0 ? (
          <div className="pt-6">
            <EmptyState
              title="Nenhum cartão ainda"
              text="Cadastre apelido, final e limite. A fatura você digita à mão."
              action={
                <PrimaryButton className="mt-2 max-w-[240px]" onClick={() => openSheet({ type: 'card' })}>
                  Novo cartão
                </PrimaryButton>
              }
            />
          </div>
        ) : (
          <div className="grid gap-x-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:pt-4 lg:gap-x-16 3xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            <div className="md:max-w-[520px]">
              {/* Wallet stack: tapping brings the next card to the front */}
              <div className="pt-6">
                <button
                  type="button"
                  onClick={() => {
                    if (ordered.length < 2) return
                    const front = state.cardOrder[state.cardOrder.length - 1]
                    dispatch({ type: 'cycleCards' })
                    // Order is a preference: saved in the background, never blocks the tap
                    cardsApi.reorder([front, ...state.cardOrder.slice(0, -1)]).catch(() => undefined)
                  }}
                  aria-label={`Cartão da frente: ${front.nickname}. Toque para trocar.`}
                  className="relative block w-full text-left transition-transform duration-200 active:scale-[0.985]"
                  style={{ height: CARD_H + (ordered.length - 1) * OFFSET }}
                >
                  {ordered.map((c, i) => {
                    const isFront = i === ordered.length - 1
                    return (
                      <div
                        key={c.id}
                        className="absolute inset-x-0 flex flex-col rounded-[32px] px-[22px] py-5 text-esk-ink shadow-[0_-8px_24px_rgba(0,0,0,0.25)] transition-[top,transform] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
                        style={{ top: i * OFFSET, height: CARD_H, backgroundImage: CARD_BG[STACK_COLORS[(ordered.length - 1 - i) % STACK_COLORS.length]], zIndex: i }}
                      >
                        <div className="flex items-start justify-between font-sat text-[15px] font-medium">
                          <span>{c.nickname}</span>
                          <span>•• {c.last4}</span>
                        </div>
                        {isFront && (
                          <div className="mt-auto animate-fade-in">
                            <p className="flex items-baseline justify-between gap-3 font-sat text-[15px] font-medium">
                              <span>Fatura atual</span>
                              <span className="text-[13px] opacity-70">{dueLabel(daysUntilDue(c))}</span>
                            </p>
                            <p className="pt-[6px] font-sat text-[46px] leading-[46px] font-medium tracking-[-2.07px] whitespace-nowrap">
                              {privateMoney(brlShort(c.invoice), hidden)}
                            </p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </button>
              </div>

              <div className="pt-[22px]">
                <div className="flex items-start justify-between font-sat text-[15px]">
                  <span className="text-esk-muted">Limite usado</span>
                  <span className="font-medium text-white">{used}%</span>
                </div>
                <ProgressBar value={used} className="mt-[10px]" />
                <p className="pt-3 font-sat text-[13px] text-esk-subtle">
                  {privateMoney(brlShort(front.invoice), hidden)} de {privateMoney(brlShort(front.limit), hidden)}
                  {ordered.length > 1 && ' · toque na pilha para trocar'}
                </p>
                <div className="pt-3">
                  <LinkButton onClick={() => openSheet({ type: 'card', id: front.id })}>Editar {front.nickname}</LinkButton>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-[18px] pt-[18px] md:pt-6">
              <SectionHeader title="Próximas faturas" />
              <ListPanel>
                {upcoming.map((c, i) => {
                  const d = daysUntilDue(c)
                  return (
                    <ListRow
                      key={c.id}
                      index={i}
                      onClick={() => openSheet({ type: 'card', id: c.id })}
                      icon={<Asset name="04670.svg" size={20} />}
                      title={c.nickname}
                      subtitle={dueLabel(d)}
                      value={privateMoney(brlShort(c.invoice), hidden)}
                    />
                  )
                })}
              </ListPanel>
              <p className="px-1 font-sat text-[13px] text-esk-subtle">
                {state.stage === 2
                  ? 'Valores digitados por você ou preenchidos pela leitura da fatura.'
                  : 'Valores digitados por você. Toque para ajustar.'}
              </p>
            </div>
          </div>
        )}

        {/* History of invoices read by the AI: open one to see its expenses or undo the import */}
        {state.invoices.length > 0 && (
          <section aria-label="Faturas importadas" className="flex flex-col gap-3 pt-10 md:max-w-[calc(50%-24px)] md:pt-12">
            <h3 className="font-sat text-[17px] font-medium text-esk-muted">Faturas importadas</h3>
            <ListPanel>
              {state.invoices.map((inv, i) => {
                const card = inv.cardId ? state.cards.find((c) => c.id === inv.cardId) : undefined
                const count = state.transactions.filter((t) => t.invoiceId === inv.id).length
                return (
                  <ListRow
                    key={inv.id}
                    index={i}
                    onClick={() => openSheet({ type: 'invoiceImport', id: inv.id })}
                    icon={<FileText size={19} strokeWidth={1.6} className="text-esk-text-2" aria-hidden />}
                    title={inv.fileName}
                    subtitle={`${card ? card.nickname : 'Sem cartão'} · ${longDate(inv.importedAt)} · ${count} ${count === 1 ? 'lançamento' : 'lançamentos'}`}
                    value={privateMoney(brlShort(inv.total), hidden)}
                  />
                )
              })}
            </ListPanel>
          </section>
        )}
      </Page>
    </div>
  )
}
