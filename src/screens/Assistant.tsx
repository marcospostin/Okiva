import { ArrowLeft, RotateCcw, Sparkles, Square } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Asset } from '../components/icons'
import { cx, RoundButton } from '../components/ui'
import { askAssistant, replyText, type AssistantReply, type ChatTurn } from '../services/ai'
import { errorMessage } from '../services/http'
import { HIDDEN_MONEY, privateMoneyText } from '../lib/format'
import { useStore } from '../state/store'
import { useUI } from '../state/ui'

type Message =
  | { id: number; role: 'user'; text: string }
  | { id: number; role: 'assistant'; reply: AssistantReply; fresh?: boolean }
  | { id: number; role: 'error'; question: string; message: string }

const SUGGESTIONS = ['Quanto gastei com delivery?', 'E as assinaturas?', 'Como está meu cartão?', 'Quanto ainda posso gastar?', 'Como guardo mais para a meta?', 'Qual é meu saldo?']
const MAX_LEN = 280

/** The conversation survives leaving the screen (per account, per browser tab). */
const chatKey = (email?: string) => `okiva:chat:${email ?? 'anon'}`
function loadChat(email?: string): Message[] {
  try {
    const raw = sessionStorage.getItem(chatKey(email))
    return raw ? (JSON.parse(raw) as Message[]).map((m) => (m.role === 'assistant' ? { ...m, fresh: false } : m)) : []
  } catch {
    return []
  }
}
function saveChat(email: string | undefined, messages: Message[]) {
  try {
    sessionStorage.setItem(chatKey(email), JSON.stringify(messages.filter((m) => m.role !== 'error').slice(-40)))
  } catch {
    /* private mode: the chat lives only while the screen is open */
  }
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function Assistant() {
  const { state } = useStore()
  const { back, notify } = useUI()
  const email = state.user?.email
  const hidden = state.hideBalance
  const [messages, setMessages] = useState<Message[]>(() => loadChat(email))
  const [input, setInput] = useState('')
  const [waiting, setWaiting] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abort = useRef<AbortController | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  useEffect(() => saveChat(email, messages), [email, messages])
  useEffect(() => () => abort.current?.abort(), [])

  const scrollToEnd = useCallback((smooth = true) => {
    endRef.current?.scrollIntoView({ behavior: smooth && !reducedMotion() ? 'smooth' : 'auto', block: 'end' })
  }, [])
  useEffect(() => scrollToEnd(), [messages.length, waiting, scrollToEnd])

  async function ask(q: string) {
    const history = messagesRef.current.flatMap<ChatTurn>((m) =>
      m.role === 'user' ? [{ role: 'user', text: m.text }] : m.role === 'assistant' ? [{ role: 'assistant', text: replyText(m.reply) }] : [],
    )
    const ctrl = new AbortController()
    abort.current = ctrl
    setWaiting(true)
    try {
      const reply = await askAssistant(q, history, stateRef.current, ctrl.signal)
      setMessages((m) => [...m, { id: Date.now(), role: 'assistant', reply, fresh: true }])
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setMessages((m) => [...m, { id: Date.now(), role: 'error', question: q, message: errorMessage(err, 'O assistente não respondeu. Tente de novo.') }])
    } finally {
      if (abort.current === ctrl) abort.current = null
      setWaiting(false)
      inputRef.current?.focus({ preventScroll: true })
    }
  }

  function send(text: string) {
    const q = text.trim().slice(0, MAX_LEN)
    if (!q || waiting) return
    setInput('')
    setMessages((m) => [...m, { id: Date.now(), role: 'user', text: q }])
    ask(q)
  }

  function retry(errorId: number, question: string) {
    if (waiting) return
    setMessages((m) => m.filter((x) => x.id !== errorId))
    ask(question)
  }

  function stop() {
    abort.current?.abort()
    abort.current = null
    setWaiting(false)
    notify('Resposta interrompida', 'info')
  }

  function reset() {
    abort.current?.abort()
    setWaiting(false)
    setMessages([])
    setInput('')
    notify('Nova conversa', 'info')
    inputRef.current?.focus()
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    send(input)
  }

  const lastAsked = [...messages].reverse().find((m) => m.role === 'user')
  const suggestions = SUGGESTIONS.filter((s) => s !== (lastAsked?.role === 'user' ? lastAsked.text : ''))

  return (
    <div className="flex min-h-[calc(100dvh-var(--tabbar-space,0px))] flex-col bg-esk-bg-2">
      <div className="mx-auto flex w-full max-w-[820px] flex-1 flex-col px-[26px] md:px-10 3xl:max-w-[960px]">
        {/* Sticky header: back, title + live status, new chat */}
        <header className="sticky top-0 z-10 -mx-[26px] flex items-center justify-between gap-3 bg-esk-bg-2/85 px-[26px] pt-[20px] pb-3 backdrop-blur-md md:-mx-10 md:px-10 md:pt-10">
          <div className="flex min-w-0 items-center gap-3">
            <RoundButton label="Voltar" onClick={back}>
              <ArrowLeft size={19} strokeWidth={1.6} />
            </RoundButton>
            <div className="min-w-0">
              <h1 className="truncate font-sat text-[29px] leading-[1.1] font-medium tracking-[-1.015px] text-white md:text-[36px] md:tracking-[-1.3px]">Assistente</h1>
              <p className="flex items-center gap-[6px] font-sat text-[12px] text-esk-muted" aria-live="polite">
                <span className={cx('size-[7px] rounded-full transition-colors', waiting ? 'animate-pulse bg-esk-lilac' : 'bg-esk-lime')} />
                {waiting ? 'Analisando seus números…' : 'Online · responde com seus dados'}
              </p>
            </div>
          </div>
          <RoundButton label="Nova conversa" onClick={reset} disabled={messages.length === 0 && !waiting} className="disabled:opacity-40">
            <Asset name="79b35.svg" size={19} />
          </RoundButton>
        </header>

        <div className="flex flex-1 flex-col gap-3 pt-4 pb-6" role="log" aria-live="polite" aria-label="Conversa com o assistente">
          {messages.length === 0 && (
            <div className="flex flex-col gap-5 pt-6">
              <div className="flex animate-rise flex-col gap-2">
                <span className="grid size-[48px] animate-glow place-items-center rounded-[24px] text-esk-ink" style={{ backgroundImage: 'var(--esk-gradient-insight)' }}>
                  <Sparkles size={22} strokeWidth={1.8} />
                </span>
                <p className="pt-2 font-mono text-[11px] font-medium tracking-[1.1px] text-esk-muted">ASSISTENTE OKIVA</p>
                <p className="max-w-[420px] font-sat text-[29px] leading-[1.15] font-medium tracking-[-1px] text-white">Pergunte sobre seu dinheiro.</p>
                <p className="font-sat text-[15px] text-esk-muted">Respondo com os seus números: gastos, cartões e metas.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {SUGGESTIONS.slice(0, 4).map((s, i) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    style={{ animationDelay: `${120 + i * 60}ms` }}
                    className="flex animate-rise items-center justify-between gap-3 rounded-[22px] bg-esk-surface px-5 py-4 text-left font-sat text-[15px] font-medium text-white ring-1 ring-esk-track transition duration-200 hover:bg-esk-elevated hover:ring-esk-subtle active:scale-[0.98]"
                  >
                    {s}
                    <span className="text-esk-lime">↗</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => {
            if (m.role === 'user')
              return (
                <div key={m.id} className="flex animate-msg-user justify-end">
                  <p className="max-w-[300px] rounded-[24px] rounded-br-[8px] bg-esk-lime-soft px-[18px] py-[15px] font-sat text-[17px] leading-[22.1px] text-balance break-words text-esk-ink md:max-w-[440px]">
                    {m.text}
                  </p>
                </div>
              )
            if (m.role === 'error')
              return (
                <div key={m.id} className="flex animate-msg-bot flex-col items-start gap-2" role="alert">
                  <p className="max-w-[300px] rounded-[24px] rounded-bl-[8px] bg-esk-elevated px-[18px] py-[15px] font-sat text-[15px] leading-[21px] text-esk-lilac ring-1 ring-esk-lilac/40 md:max-w-[440px]">
                    {m.message}
                  </p>
                  <button
                    type="button"
                    onClick={() => retry(m.id, m.question)}
                    disabled={waiting}
                    className="flex items-center gap-2 rounded-full bg-esk-elevated px-4 py-2 font-sat text-[13px] font-medium text-white ring-1 ring-esk-track transition hover:bg-esk-hover active:scale-95 disabled:opacity-40"
                  >
                    <RotateCcw size={14} strokeWidth={2} />
                    Tentar de novo
                  </button>
                </div>
              )
            if (m.reply.kind === 'text')
              return (
                <div key={m.id} className="flex animate-msg-bot justify-start">
                  <p className="max-w-[300px] rounded-[24px] rounded-bl-[8px] bg-esk-elevated px-[18px] py-[15px] font-sat text-[17px] leading-[22.1px] text-balance text-esk-text-2 md:max-w-[440px]">
                    <TypedParts parts={m.reply.parts} hidden={hidden} animate={!!m.fresh} onTick={() => scrollToEnd(false)} />
                  </p>
                </div>
              )
            return (
              <div key={m.id} className="animate-insight pt-[2px]">
                <div className="flex flex-col rounded-[30px] p-[22px] text-esk-ink md:max-w-[520px]" style={{ backgroundImage: 'var(--esk-gradient-insight)' }}>
                  <p className="font-sat text-[15px] font-medium">{m.reply.lead}</p>
                  <p className="pt-2 font-sat text-[40px] leading-[40px] font-medium tracking-[-1.6px]">{privateMoneyText(m.reply.value, hidden)}</p>
                  <p className="pt-[10px] font-sat text-[14px] font-medium">{m.reply.consequence}</p>
                </div>
              </div>
            )
          })}

          {waiting && (
            <div className="flex animate-msg-bot justify-start" role="status" aria-label="Assistente digitando">
              <span className="flex items-center gap-[5px] rounded-[24px] rounded-bl-[8px] bg-esk-elevated px-5 py-[19px]">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="size-[7px] animate-typing rounded-full bg-esk-lime-soft" style={{ animationDelay: `${i * 160}ms` }} />
                ))}
              </span>
            </div>
          )}
          <div ref={endRef} className="scroll-mb-[180px]" />
        </div>

        <div className="sticky bottom-[var(--tabbar-space,0px)] -mx-[10px] bg-gradient-to-t from-esk-bg-2 from-70% to-transparent pt-4 pb-[max(20px,env(safe-area-inset-bottom))] md:mx-0">
          {messages.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-3 [scrollbar-width:none]">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={waiting}
                  onClick={() => send(s)}
                  className="h-[36px] shrink-0 rounded-[18px] bg-esk-elevated px-4 font-sat text-[13px] font-medium text-white ring-1 ring-esk-track transition duration-200 hover:bg-esk-hover active:scale-95 disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <form
            onSubmit={onSubmit}
            className="flex h-[66px] items-center justify-between gap-2 rounded-[33px] bg-esk-surface pr-[9px] pl-[22px] ring-1 ring-transparent transition focus-within:ring-esk-track"
          >
            <label htmlFor="ask" className="sr-only">
              Pergunte sobre seu dinheiro
            </label>
            <input
              id="ask"
              ref={inputRef}
              value={input}
              maxLength={MAX_LEN}
              onChange={(e) => setInput(e.target.value)}
              placeholder={waiting ? 'Aguarde a resposta…' : 'Pergunte sobre seu dinheiro'}
              autoComplete="off"
              enterKeyHint="send"
              className="min-w-0 flex-1 bg-transparent font-sat text-[16px] text-white outline-none placeholder:text-esk-subtle"
            />
            {input.length > MAX_LEN - 40 && <span className="font-sat text-[11px] text-esk-subtle tabular-nums">{MAX_LEN - input.length}</span>}
            {waiting ? (
              <button
                type="button"
                aria-label="Parar resposta"
                onClick={stop}
                className="grid size-[48px] shrink-0 animate-pop-in place-items-center rounded-[24px] bg-esk-elevated text-white ring-1 ring-esk-track transition active:scale-90"
              >
                <Square size={15} fill="currentColor" strokeWidth={0} />
              </button>
            ) : (
              <button
                type="submit"
                aria-label="Enviar"
                disabled={!input.trim()}
                className="grid size-[48px] shrink-0 place-items-center rounded-[24px] bg-esk-lime-soft transition duration-200 enabled:hover:brightness-95 active:scale-90 disabled:scale-95 disabled:opacity-40"
              >
                <Asset name="7d9c9.svg" size={20} />
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}

/**
 * Reveals a fresh reply a few characters at a time (like a streamed answer).
 * Older messages and reduced-motion users get the full text at once.
 */
function TypedParts({ parts, hidden, animate, onTick }: { parts: { text: string; bold?: boolean }[]; hidden: boolean; animate: boolean; onTick: () => void }) {
  const shownParts = parts.map((p) => (hidden ? (p.bold ? HIDDEN_MONEY : privateMoneyText(p.text, true)) : p.text))
  const total = shownParts.reduce((s, t) => s + t.length, 0)
  const [count, setCount] = useState(animate && !reducedMotion() ? 0 : total)
  const tick = useRef(onTick)
  tick.current = onTick

  useEffect(() => {
    if (count >= total) return
    const step = Math.max(1, Math.ceil(total / 60))
    const id = window.setTimeout(() => {
      setCount((c) => Math.min(total, c + step))
      tick.current()
    }, 16)
    return () => window.clearTimeout(id)
  }, [count, total])

  let left = count
  return (
    <>
      {/* Screen readers get the whole answer once; the typing effect is visual only */}
      <span className="sr-only">{shownParts.join('')}</span>
      <span aria-hidden>
        {shownParts.map((t, i) => {
          const visible = t.slice(0, Math.max(0, left))
          left -= t.length
          return parts[i].bold ? (
            <b key={i} className="font-bold">
              {visible}
            </b>
          ) : (
            <span key={i}>{visible}</span>
          )
        })}
        {count < total && <span className="ml-[1px] inline-block h-[17px] w-[2px] translate-y-[3px] animate-caret bg-esk-lime-soft" />}
      </span>
    </>
  )
}
