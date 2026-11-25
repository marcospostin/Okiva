/**
 * Sheets da tela Conta: perfil, plano, segurança (e-mail, senha, sessões), notificações,
 * ajuda, relatar problema, avaliar e a confirmação por senha + código para ações sem volta.
 */
import { useRef, useState } from 'react'
import { Bug, Check, ChevronDown, ChevronRight, Lock, Mail, MessageCircle, MonitorSmartphone, ShieldCheck, Sparkles, Star } from 'lucide-react'
import { cx, Field, inputClass, PrimaryButton, Sheet, Switch } from '../components/ui'
import { PasswordInput, PasswordStrength, passwordMeetsRules } from '../screens/Login'
import { accountApi } from '../services/finance'
import { setToken, USE_SUPABASE, errorMessage } from '../services/http'
import { deleteLocalAccount, signOut, updateAccount } from '../services/auth'
import { maskEmail, notificationsApi, securityApi, STORE_URLS, SUPPORT_EMAIL, supportApi, deviceInfo, type SupportKind } from '../services/settings'
import { forgetAccountData, useStore } from '../state/store'
import { useMutation } from '../state/useMutation'
import { useUI } from '../state/ui'
import type { NotificationPrefs } from '../types'

/** Linha clicável dentro de um bloco de opções */
export function OptionRow({
  icon,
  label,
  hint,
  value,
  onClick,
  danger,
  first,
  disabled,
}: {
  icon?: React.ReactNode
  label: string
  hint?: string
  value?: React.ReactNode
  onClick?: () => void
  danger?: boolean
  first?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'flex w-full items-center gap-3 py-4 text-left transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50',
        !first && 'border-t border-esk-border',
      )}
    >
      {icon && <span className={cx('grid size-[34px] shrink-0 place-items-center rounded-full bg-esk-row', danger ? 'text-esk-lilac' : 'text-esk-text-2')}>{icon}</span>}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cx('font-sat text-[15px]', danger ? 'text-esk-lilac' : 'text-white')}>{label}</span>
        {hint && <span className="font-sat text-[12px] leading-[1.35] text-esk-subtle">{hint}</span>}
      </span>
      {value !== undefined && <span className="shrink-0 font-sat text-[14px] text-esk-muted">{value}</span>}
      {onClick && !disabled && <ChevronRight size={16} className="shrink-0 text-esk-subtle" aria-hidden />}
    </button>
  )
}

export const OptionGroup = ({ children }: { children: React.ReactNode }) => <div className="flex flex-col rounded-[24px] bg-esk-elevated px-5">{children}</div>

/* ------------------------------------------------------------- Perfil */

export function ProfileSheet({ close }: { close: () => void }) {
  const { state, dispatch } = useStore()
  const { run, pending } = useMutation()
  const user = state.user
  const [name, setName] = useState(user?.name ?? '')
  const [tries, setTries] = useState(0)
  if (!user) return null
  const nameError = tries && !name.trim() ? 'Digite seu nome.' : undefined

  async function save() {
    setTries((n) => n + 1)
    const value = name.trim()
    if (!value || !user) return
    const ok = await run(
      'save',
      () => accountApi.updateProfile({ name: value }),
      () => {
        dispatch({ type: 'setName', name: value })
        updateAccount({ ...user, name: value })
      },
      'Perfil atualizado',
    )
    if (ok) close()
  }

  return (
    <Sheet title="Editar perfil" onClose={close}>
      <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); save() }}>
        <Field label="Nome" htmlFor="pname" error={nameError} attempt={tries}>
          <input id="pname" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="name" autoFocus />
        </Field>
        <p className="-mt-2 font-sat text-[12px] text-esk-subtle">E-mail e senha ficam em Segurança e login.</p>
        <PrimaryButton type="submit" loading={pending === 'save'}>
          Salvar perfil
        </PrimaryButton>
      </form>
    </Sheet>
  )
}

/* -------------------------------------------------------------- Plano */

const PLUS_BENEFITS = [
  { title: 'Leitura de fatura com IA', text: 'Envie o PDF ou a foto e os gastos entram sozinhos, já categorizados.' },
  { title: 'Assistente financeiro', text: 'Pergunte sobre gastos, cartões e metas e receba respostas com os seus números.' },
  { title: 'Dicas para suas metas', text: 'Sugestões de onde economizar para chegar antes.' },
]

export function PlanSheet({ close }: { close: () => void }) {
  const { state, dispatch } = useStore()
  const { notify } = useUI()
  const plus = state.stage === 2
  const [confirmCancel, setConfirmCancel] = useState(false)

  return (
    <Sheet title="Seu plano" onClose={close}>
      <div className="flex flex-col gap-5">
        <div className={cx('rounded-[24px] p-5', plus ? 'text-esk-ink' : 'bg-esk-elevated text-white')} style={plus ? { backgroundImage: 'var(--esk-gradient-hero)' } : undefined}>
          <p className="font-mono text-[11px] font-medium tracking-[1.1px] uppercase opacity-70">Plano atual</p>
          <p className="pt-1 font-sat text-[28px] leading-tight font-medium tracking-[-0.8px]">{plus ? 'Okiva Plus' : 'Okiva Padrão'}</p>
          <p className={cx('pt-1 font-sat text-[13px]', plus ? 'text-esk-ink-2' : 'text-esk-muted')}>
            {plus ? 'Todos os recursos liberados.' : 'Gastos, cartões, contas e metas. Sem custo.'}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <p className="font-sat text-[13px] font-medium text-esk-muted">{plus ? 'Incluído no seu plano' : 'O que o Plus adiciona'}</p>
          {PLUS_BENEFITS.map((b) => (
            <div key={b.title} className="flex gap-3">
              <span className={cx('mt-[2px] grid size-[22px] shrink-0 place-items-center rounded-full', plus ? 'bg-esk-lime text-esk-ink' : 'bg-esk-row text-esk-lilac')}>
                {plus ? <Check size={13} strokeWidth={2.6} /> : <Sparkles size={12} />}
              </span>
              <div>
                <p className="font-sat text-[15px] font-medium text-white">{b.title}</p>
                <p className="font-sat text-[13px] text-esk-subtle">{b.text}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="rounded-[18px] bg-esk-elevated px-4 py-3 font-sat text-[12px] leading-[1.4] text-esk-subtle">
          Versão de testes: a assinatura ainda não cobra nada. O pagamento (loja do celular ou cartão) entra antes do lançamento.
        </p>

        {!plus ? (
          <PrimaryButton
            onClick={() => {
              dispatch({ type: 'setStage', stage: 2 })
              notify('Okiva Plus ativado')
              close()
            }}
          >
            <Sparkles size={17} /> Assinar o Plus
          </PrimaryButton>
        ) : confirmCancel ? (
          <div className="flex animate-rise flex-col gap-3 rounded-[22px] bg-esk-elevated p-4">
            <p className="font-sat text-[14px] text-white">Cancelar o Plus? A leitura de fatura e o assistente ficam bloqueados. Seus dados continuam.</p>
            <div className="grid grid-cols-2 gap-3">
              <PrimaryButton tone="dark" onClick={() => setConfirmCancel(false)}>
                Manter
              </PrimaryButton>
              <PrimaryButton
                onClick={() => {
                  dispatch({ type: 'setStage', stage: 1 })
                  notify('Assinatura cancelada. Você está no plano Padrão.', 'info')
                  close()
                }}
              >
                Cancelar
              </PrimaryButton>
            </div>
          </div>
        ) : (
          <PrimaryButton tone="danger" onClick={() => setConfirmCancel(true)}>
            Cancelar assinatura
          </PrimaryButton>
        )}
      </div>
    </Sheet>
  )
}

/* ---------------------------------------------------------- Segurança */

export function SecuritySheet({ close }: { close: () => void }) {
  const { state, dispatch } = useStore()
  const { openSheet, navigate } = useUI()
  const { run, pending } = useMutation()
  const [confirmAll, setConfirmAll] = useState(false)
  const email = state.user?.email ?? ''

  return (
    <Sheet title="Segurança e login" onClose={close}>
      <div className="flex flex-col gap-5">
        <OptionGroup>
          <OptionRow first icon={<Mail size={17} />} label="E-mail" hint={email} onClick={() => openSheet({ type: 'changeEmail' })} />
          <OptionRow icon={<Lock size={17} />} label="Senha" hint="Trocar a senha de acesso" onClick={() => openSheet({ type: 'changePassword' })} />
          <OptionRow icon={<ShieldCheck size={17} />} label="Verificação em duas etapas" hint="Código de um app autenticador ao entrar · em breve" disabled />
        </OptionGroup>

        <OptionGroup>
          {confirmAll ? (
            <div className="flex animate-rise flex-col gap-3 py-4">
              <p className="font-sat text-[14px] text-white">Sair em todos os aparelhos, inclusive este? Você vai precisar entrar de novo com sua senha.</p>
              <div className="grid grid-cols-2 gap-3">
                <PrimaryButton tone="dark" onClick={() => setConfirmAll(false)} disabled={!!pending}>
                  Cancelar
                </PrimaryButton>
                <PrimaryButton
                  loading={pending === 'all'}
                  loadingText="Saindo…"
                  onClick={() =>
                    run('all', () => securityApi.signOutEverywhere(), () => {
                      setToken(null)
                      navigate('home')
                      dispatch({ type: 'logout' })
                    }, 'Você saiu de todos os aparelhos')
                  }
                >
                  Sair de todos
                </PrimaryButton>
              </div>
            </div>
          ) : (
            <OptionRow first icon={<MonitorSmartphone size={17} />} label="Sair de todos os aparelhos" hint="Use se perdeu o celular ou entrou num computador de outra pessoa" onClick={() => setConfirmAll(true)} />
          )}
        </OptionGroup>

        <OptionGroup>
          <OptionRow first danger label="Excluir conta" hint="Apaga a conta e todos os dados. Pede sua senha e um código no e-mail." onClick={() => openSheet({ type: 'verifyAction', action: 'delete' })} />
        </OptionGroup>
      </div>
    </Sheet>
  )
}

export function ChangeEmailSheet() {
  const { state } = useStore()
  const { openSheet } = useUI()
  const { run, pending } = useMutation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [tries, setTries] = useState(0)
  const [sent, setSent] = useState(false)
  const current = state.user?.email ?? ''
  const back = () => openSheet({ type: 'security' })
  const emailError = !email.trim()
    ? 'Digite o e-mail novo.'
    : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
      ? 'Confira o e-mail.'
      : email.trim().toLowerCase() === current.toLowerCase()
        ? 'Esse já é o seu e-mail.'
        : undefined
  const passwordError = !password ? 'Digite sua senha atual.' : undefined

  async function save() {
    setTries((n) => n + 1)
    if (emailError || passwordError) return
    const ok = await run('save', async () => {
      await securityApi.checkPassword(password)
      await securityApi.changeEmail(email)
    }, () => undefined)
    if (ok) setSent(true)
  }

  if (sent) {
    return (
      <Sheet title="Confirme no e-mail" onClose={back}>
        <div className="flex flex-col gap-5">
          <p className="font-sat text-[15px] leading-[1.5] text-esk-muted">
            Enviamos um link de confirmação para <span className="text-white">{email.trim()}</span>
            {USE_SUPABASE ? ` e um aviso para ${maskEmail(current)}` : ''}. A troca só vale depois que você confirmar. Até lá, continue entrando com o e-mail atual.
          </p>
          <PrimaryButton onClick={back}>Entendi</PrimaryButton>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet title="Trocar e-mail" onClose={back}>
      <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); save() }}>
        <p className="-mt-2 font-sat text-[13px] text-esk-muted">Atual: {current}</p>
        <Field label="E-mail novo" htmlFor="new-email" error={tries ? emailError : undefined} attempt={tries}>
          <input id="new-email" type="email" autoComplete="email" className={inputClass} placeholder="voce@email.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </Field>
        <Field label="Senha atual" htmlFor="email-pass" error={tries ? passwordError : undefined} attempt={tries}>
          <PasswordInput id="email-pass" autoComplete="current-password" value={password} onChange={setPassword} />
        </Field>
        <PrimaryButton type="submit" loading={pending === 'save'} loadingText="Enviando…">
          Enviar confirmação
        </PrimaryButton>
      </form>
    </Sheet>
  )
}

export function ChangePasswordSheet({ recovery, close }: { recovery?: boolean; close: () => void }) {
  const { openSheet } = useUI()
  const { run, pending } = useMutation()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [tries, setTries] = useState(0)
  const back = recovery ? close : () => openSheet({ type: 'security' })
  const errors = {
    current: !recovery && !current ? 'Digite sua senha atual.' : undefined,
    next: !next ? 'Crie uma senha nova.' : !passwordMeetsRules(next) ? 'A senha ainda não atende aos requisitos abaixo.' : undefined,
    confirm: confirm !== next ? 'As senhas não são iguais.' : undefined,
  }

  async function save() {
    setTries((n) => n + 1)
    if (errors.current || errors.next || errors.confirm) return
    const ok = await run(
      'save',
      () => (recovery ? securityApi.setNewPassword(next) : securityApi.changePassword(current, next)),
      () => undefined,
      recovery ? 'Senha nova salva. Use ela no próximo login.' : 'Senha trocada',
    )
    if (ok) back()
  }

  return (
    <Sheet title={recovery ? 'Crie uma senha nova' : 'Trocar senha'} onClose={back}>
      <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); save() }}>
        {!recovery && (
          <Field label="Senha atual" htmlFor="cur-pass" error={tries ? errors.current : undefined} attempt={tries}>
            <PasswordInput id="cur-pass" autoComplete="current-password" value={current} onChange={setCurrent} />
          </Field>
        )}
        <Field label="Senha nova" htmlFor="new-pass" error={tries ? errors.next : undefined} attempt={tries}>
          <PasswordInput id="new-pass" autoComplete="new-password" value={next} onChange={setNext} describedBy="new-pass-strength" />
          <PasswordStrength id="new-pass-strength" password={next} />
        </Field>
        <Field label="Confirmar senha nova" htmlFor="new-pass2" error={tries ? errors.confirm : undefined} attempt={tries}>
          <PasswordInput id="new-pass2" autoComplete="new-password" value={confirm} onChange={setConfirm} />
        </Field>
        <PrimaryButton type="submit" loading={pending === 'save'}>
          Salvar senha nova
        </PrimaryButton>
      </form>
    </Sheet>
  )
}

/* ------------------------------------------- Confirmar ação sem volta */

const ACTIONS = {
  reset: {
    title: 'Começar do zero',
    what: 'Apaga gastos, receitas, cartões, contas, metas, faturas, tetos, recorrências e categorias. Sua conta, nome e e-mail continuam.',
    button: 'Apagar todos os dados',
    word: 'ZERAR',
  },
  delete: {
    title: 'Excluir conta',
    what: 'Apaga sua conta e todos os dados dela. Você não vai mais conseguir entrar com este e-mail sem criar uma conta nova.',
    button: 'Excluir minha conta',
    word: 'EXCLUIR',
  },
} as const

type Step = 'password' | 'code' | 'final'

/**
 * Ações sem volta pedem senha e um código enviado ao e-mail (o banco confere a verificação
 * por e-mail antes de apagar). Na demonstração e no protótipo basta digitar a palavra.
 */
export function VerifyActionSheet({ action, confirmed, close }: { action: 'reset' | 'delete'; confirmed?: boolean; close: () => void }) {
  const { state, dispatch } = useStore()
  const { navigate } = useUI()
  const { run, pending } = useMutation()
  const cfg = ACTIONS[action]
  const simple = !USE_SUPABASE || !!state.user?.demo
  const [step, setStep] = useState<Step>(simple || confirmed ? 'final' : 'password')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [word, setWord] = useState('')
  const [sentTo, setSentTo] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  async function checkPassword() {
    setError(undefined)
    if (!password) return setError('Digite sua senha.')
    setBusy(true)
    try {
      await securityApi.checkPassword(password)
      const to = await securityApi.sendEmailCode(`${window.location.origin}/?confirmar=${action}`)
      setSentTo(to)
      setStep('code')
    } catch (err) {
      setError(errorMessage(err, 'Não deu para continuar. Tente de novo.'))
    } finally {
      setBusy(false)
    }
  }

  async function checkCode() {
    setError(undefined)
    if (!/^\d{6,10}$/.test(code.trim())) return setError('Digite o código de 6 dígitos do e-mail.')
    setBusy(true)
    try {
      await securityApi.verifyEmailCode(code)
      setStep('final')
    } catch (err) {
      setError(errorMessage(err, 'Código inválido. Tente de novo.'))
    } finally {
      setBusy(false)
    }
  }

  async function resend() {
    setError(undefined)
    setBusy(true)
    try {
      await securityApi.sendEmailCode(`${window.location.origin}/?confirmar=${action}`)
      setError('Enviamos outro código.')
    } catch (err) {
      setError(errorMessage(err, 'Espere um pouco antes de pedir outro código.'))
    } finally {
      setBusy(false)
    }
  }

  async function execute() {
    if (simple && word.trim().toUpperCase() !== cfg.word) return setError(`Digite ${cfg.word} para confirmar.`)
    setError(undefined)
    if (action === 'reset') {
      const ok = await run(
        'go',
        async () => {
          await accountApi.clearData()
          // Supabase: recarrega (o banco recria a conta Principal e as categorias sugeridas)
          return USE_SUPABASE ? accountApi.snapshot({} as never) : null
        },
        (snapshot) => {
          dispatch({ type: 'clearData' })
          if (snapshot) dispatch({ type: 'sync', snapshot })
        },
        'Pronto: sua conta está zerada',
        'Não deu para apagar os dados. Peça um código novo e tente de novo.',
      )
      if (ok) {
        close()
        navigate('home')
      }
    } else {
      const email = state.user?.email ?? ''
      await run(
        'go',
        () => accountApi.deleteAccount(),
        () => {
          forgetAccountData(email)
          deleteLocalAccount(email)
          signOut()
          setToken(null)
          close()
          navigate('home')
          dispatch({ type: 'logout' })
        },
        'Conta excluída',
        'Não deu para excluir a conta. Peça um código novo e tente de novo.',
      )
    }
  }

  const steps: Step[] = ['password', 'code', 'final']
  return (
    <Sheet title={cfg.title} onClose={close}>
      <div className="flex flex-col gap-5">
        <p className="rounded-[18px] bg-esk-lilac/10 px-4 py-3 font-sat text-[14px] leading-[1.45] text-esk-lilac ring-1 ring-esk-lilac/30">{cfg.what} Não dá para desfazer.</p>

        {!simple && (
          <ol className="flex items-center gap-2" aria-label="Etapas">
            {steps.map((s, i) => (
              <li key={s} className={cx('h-[4px] flex-1 rounded-full', steps.indexOf(step) >= i ? 'bg-esk-lime' : 'bg-esk-track')} />
            ))}
          </ol>
        )}

        {step === 'password' && (
          <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); checkPassword() }}>
            <Field label="1. Confirme sua senha" htmlFor="va-pass">
              <PasswordInput id="va-pass" autoComplete="current-password" value={password} onChange={setPassword} />
            </Field>
            {error && <p role="alert" className="font-sat text-[13px] text-esk-lilac">{error}</p>}
            <PrimaryButton type="submit" loading={busy} loadingText="Conferindo…">
              Continuar
            </PrimaryButton>
          </form>
        )}

        {step === 'code' && (
          <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); checkCode() }}>
            <Field label="2. Código enviado ao seu e-mail" htmlFor="va-code">
              <input
                id="va-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                className={cx(inputClass, 'text-center font-mono text-[22px] tracking-[6px]')}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
                autoFocus
              />
            </Field>
            <p className="-mt-2 font-sat text-[13px] leading-[1.4] text-esk-muted">
              Enviamos para {maskEmail(sentTo)}. Também dá para tocar no link do e-mail: ele abre o Okiva direto na confirmação.
            </p>
            {error && <p role="alert" className="font-sat text-[13px] text-esk-lilac">{error}</p>}
            <PrimaryButton type="submit" loading={busy} loadingText="Conferindo…">
              Confirmar código
            </PrimaryButton>
            <button type="button" onClick={resend} disabled={busy} className="font-sat text-[14px] font-medium text-esk-lime-soft hover:underline disabled:opacity-40">
              Enviar outro código
            </button>
          </form>
        )}

        {step === 'final' && (
          <div className="flex flex-col gap-4">
            {simple ? (
              <Field label={`Digite ${cfg.word} para confirmar`} htmlFor="va-word">
                <input id="va-word" className={cx(inputClass, 'uppercase')} value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" autoFocus />
              </Field>
            ) : (
              <p className="flex items-center gap-2 font-sat text-[14px] text-esk-lime-soft">
                <Check size={16} /> Senha e e-mail confirmados.
              </p>
            )}
            {error && <p role="alert" className="font-sat text-[13px] text-esk-lilac">{error}</p>}
            <div className="grid grid-cols-2 gap-3">
              <PrimaryButton tone="dark" onClick={close} disabled={pending === 'go'}>
                Cancelar
              </PrimaryButton>
              <PrimaryButton tone="danger" onClick={execute} loading={pending === 'go'} loadingText="Apagando…">
                {cfg.button}
              </PrimaryButton>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  )
}

/* -------------------------------------------------------- Notificações */

const NOTIFICATION_ITEMS: { key: keyof NotificationPrefs; label: string; hint: string }[] = [
  { key: 'invoice_due', label: 'Fatura perto de vencer', hint: '3 dias antes do vencimento de cada cartão' },
  { key: 'cap_alert', label: 'Teto perto do limite', hint: 'Quando uma categoria chega na % de aviso que você escolheu' },
  { key: 'uncategorized', label: 'Gastos sem categoria', hint: 'Lembrete para classificar o que ficou pendente' },
  { key: 'recurrence', label: 'Recorrências lançadas', hint: 'Quando um salário, aluguel ou assinatura entra' },
  { key: 'weekly_summary', label: 'Resumo da semana', hint: 'Quanto você gastou e quanto ainda pode gastar' },
  { key: 'news', label: 'Novidades do Okiva', hint: 'Recursos novos e dicas. Nada de spam.' },
]

export function NotificationsSheet({ close }: { close: () => void }) {
  const { state, dispatch } = useStore()
  const { notify } = useUI()
  const prefs = state.notificationPrefs
  const saving = useRef(0)

  async function toggle(key: keyof NotificationPrefs, value: boolean) {
    const previous = prefs
    const next = { ...prefs, [key]: value }
    dispatch({ type: 'setNotifications', prefs: next })
    const id = ++saving.current
    try {
      await notificationsApi.save(next)
    } catch (err) {
      if (id === saving.current) dispatch({ type: 'setNotifications', prefs: previous })
      notify(errorMessage(err, 'Não deu para salvar. Tente de novo.'), 'error')
    }
  }

  return (
    <Sheet title="Notificações" onClose={close}>
      <div className="flex flex-col gap-5">
        <OptionGroup>
          {NOTIFICATION_ITEMS.map((item, i) => (
            <div key={item.key} className={cx('flex items-center justify-between gap-4 py-4', i > 0 && 'border-t border-esk-border')}>
              <span className="flex min-w-0 flex-col">
                <span className="font-sat text-[15px] text-white">{item.label}</span>
                <span className="font-sat text-[12px] leading-[1.35] text-esk-subtle">{item.hint}</span>
              </span>
              <Switch label={item.label} checked={prefs[item.key]} onChange={(v) => toggle(item.key, v)} />
            </div>
          ))}
        </OptionGroup>
        <p className="font-sat text-[12px] leading-[1.4] text-esk-subtle">
          Os avisos dentro do app (teto e gastos sem categoria) já funcionam. As notificações no celular e por e-mail começam a chegar quando o app for publicado nas lojas.
        </p>
      </div>
    </Sheet>
  )
}

/* -------------------------------------------------------------- Ajuda */

const FAQ = [
  { q: 'Por que o gasto no cartão não saiu do meu saldo?', a: 'O dinheiro só sai da conta quando você paga a fatura. Em Cartões, toque em "Pagar fatura". O gasto já conta no teto do mês da compra.' },
  { q: 'Como funciona a compra parcelada?', a: 'Cada parcela entra no mês dela. Uma compra de R$ 600 em 10x conta R$ 60 por mês no teto, e os meses seguintes aparecem como "previsto".' },
  { q: 'O que é "sem categoria"?', a: 'Gastos que ninguém sabe de onde são, como nomes de CNPJ na fatura. Eles contam no total do mês e ficam sinalizados até você escolher uma categoria.' },
  { q: 'Como cadastro meu salário todo mês?', a: 'Em Adicionar, escolha Receita e ligue "Repetir todo mês". Ele entra sozinho no dia marcado.' },
  { q: 'Meus dados estão seguros?', a: 'Cada pessoa só acessa os próprios dados, protegidos no banco. Veja a Política de privacidade em Conta.' },
]

export function HelpSheet({ close }: { close: () => void }) {
  const { openSheet } = useUI()
  const [open, setOpen] = useState<number | null>(null)
  const [writing, setWriting] = useState(false)
  const [message, setMessage] = useState('')
  const { run, pending } = useMutation()

  return (
    <Sheet title="Ajuda" onClose={close}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <p className="font-sat text-[13px] font-medium text-esk-muted">Perguntas frequentes</p>
          <div className="flex flex-col rounded-[24px] bg-esk-elevated px-5">
            {FAQ.map((f, i) => (
              <div key={f.q} className={cx(i > 0 && 'border-t border-esk-border')}>
                <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-3 py-4 text-left">
                  <span className="font-sat text-[15px] text-white">{f.q}</span>
                  <ChevronDown size={16} className={cx('shrink-0 text-esk-subtle transition', open === i && 'rotate-180')} aria-hidden />
                </button>
                {open === i && <p className="animate-rise pb-4 font-sat text-[14px] leading-[1.5] text-esk-muted">{f.a}</p>}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="font-sat text-[13px] font-medium text-esk-muted">Fale com a gente</p>
          <OptionGroup>
            {writing ? (
              <form
                className="flex animate-rise flex-col gap-3 py-4"
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!message.trim()) return
                  const ok = await run('send', () => supportApi.send({ kind: 'duvida', message }), () => undefined, 'Mensagem enviada. Respondemos no seu e-mail.')
                  if (ok) {
                    setMessage('')
                    setWriting(false)
                  }
                }}
              >
                <textarea
                  aria-label="Sua mensagem"
                  className={cx(inputClass, 'h-[120px] resize-none py-3')}
                  placeholder="Conte sua dúvida…"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={4000}
                  autoFocus
                />
                <div className="grid grid-cols-2 gap-3">
                  <PrimaryButton tone="dark" onClick={() => setWriting(false)}>
                    Cancelar
                  </PrimaryButton>
                  <PrimaryButton type="submit" disabled={!message.trim()} loading={pending === 'send'} loadingText="Enviando…">
                    Enviar
                  </PrimaryButton>
                </div>
              </form>
            ) : (
              <OptionRow first icon={<MessageCircle size={17} />} label="Enviar mensagem" hint="Respondemos no seu e-mail em até 2 dias úteis" onClick={() => setWriting(true)} />
            )}
            <OptionRow icon={<Mail size={17} />} label="E-mail" hint={SUPPORT_EMAIL} onClick={() => window.open(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Ajuda com o Okiva')}`)} />
            <OptionRow icon={<MessageCircle size={17} />} label="Chat ao vivo" hint="Em breve" disabled />
            <OptionRow icon={<Bug size={17} />} label="Relatar um problema" hint="Algo não funcionou como deveria" onClick={() => openSheet({ type: 'bug' })} />
          </OptionGroup>
        </div>
      </div>
    </Sheet>
  )
}

/* ---------------------------------------------------- Relatar problema */

export function BugReportSheet({ close }: { close: () => void }) {
  const { run, pending } = useMutation()
  const [what, setWhat] = useState('')
  const [steps, setSteps] = useState('')
  const [tries, setTries] = useState(0)
  const [showInfo, setShowInfo] = useState(false)
  const info = deviceInfo()

  async function send() {
    setTries((n) => n + 1)
    if (!what.trim()) return
    const message = steps.trim() ? `${what.trim()}\n\nO que eu estava fazendo:\n${steps.trim()}` : what.trim()
    const ok = await run('send', () => supportApi.send({ kind: 'problema', message, meta: info }), () => undefined, 'Obrigado! Recebemos o relato.')
    if (ok) close()
  }

  return (
    <Sheet title="Relatar um problema" onClose={close}>
      <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); send() }}>
        <Field label="O que aconteceu?" htmlFor="bug-what" error={tries && !what.trim() ? 'Conte o que aconteceu.' : undefined} attempt={tries}>
          <textarea id="bug-what" className={cx(inputClass, 'h-[110px] resize-none py-3')} placeholder="Ex.: o saldo não mudou depois que paguei a fatura" value={what} onChange={(e) => setWhat(e.target.value)} maxLength={2000} autoFocus />
        </Field>
        <Field label="O que você estava fazendo? (opcional)" htmlFor="bug-steps">
          <textarea id="bug-steps" className={cx(inputClass, 'h-[90px] resize-none py-3')} placeholder="Os passos até o problema aparecer" value={steps} onChange={(e) => setSteps(e.target.value)} maxLength={1500} />
        </Field>
        <button type="button" onClick={() => setShowInfo((v) => !v)} className="flex items-center gap-2 self-start font-sat text-[13px] text-esk-subtle hover:text-white">
          <ChevronDown size={14} className={cx('transition', showInfo && 'rotate-180')} /> Informações enviadas junto
        </button>
        {showInfo && (
          <dl className="-mt-2 animate-rise rounded-[18px] bg-esk-elevated px-4 py-3 font-mono text-[11px] leading-[1.6] break-all text-esk-muted">
            {Object.entries(info).map(([k, v]) => (
              <div key={k}>
                <dt className="inline text-esk-subtle">{k}: </dt>
                <dd className="inline">{v}</dd>
              </div>
            ))}
          </dl>
        )}
        <PrimaryButton type="submit" loading={pending === 'send'} loadingText="Enviando…">
          Enviar relato
        </PrimaryButton>
      </form>
    </Sheet>
  )
}

/* --------------------------------------------------------------- Avaliar */

function storeUrl() {
  const ua = navigator.userAgent
  if (/iphone|ipad|ipod/i.test(ua)) return STORE_URLS.ios
  if (/android/i.test(ua)) return STORE_URLS.android
  return ''
}

export function RateSheet({ close }: { close: () => void }) {
  const { run, pending } = useMutation()
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const url = storeUrl()
  const happy = rating >= 4

  async function send() {
    if (!rating) return
    const ok = await run(
      'send',
      () => supportApi.send({ kind: 'avaliacao' as SupportKind, rating, message: comment }),
      () => undefined,
      happy ? 'Obrigado pela avaliação!' : 'Obrigado! Vamos usar isso para melhorar.',
    )
    if (!ok) return
    if (happy && url) window.open(url, '_blank', 'noopener')
    close()
  }

  return (
    <Sheet title="Avaliar o Okiva" onClose={close}>
      <div className="flex flex-col gap-5">
        <p className="font-sat text-[15px] text-esk-muted">O que você está achando do app?</p>
        <div className="flex justify-center gap-2" role="radiogroup" aria-label="Nota de 1 a 5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} ${n === 1 ? 'estrela' : 'estrelas'}`}
              onClick={() => setRating(n)}
              className="grid size-[48px] place-items-center rounded-full transition active:scale-90"
            >
              <Star size={30} strokeWidth={1.6} className={cx('transition', n <= rating ? 'fill-esk-lime text-esk-lime' : 'text-esk-subtle')} />
            </button>
          ))}
        </div>
        {rating > 0 && (
          <div className="flex animate-rise flex-col gap-4">
            {happy ? (
              <p className="text-center font-sat text-[14px] text-esk-lime-soft">
                Que bom! {url ? 'Uma avaliação na loja ajuda muito outras pessoas a conhecerem o Okiva.' : 'Quando o app estiver nas lojas, vamos pedir sua avaliação por lá também.'}
              </p>
            ) : (
              <Field label="O que podemos melhorar?" htmlFor="rate-comment">
                <textarea id="rate-comment" className={cx(inputClass, 'h-[100px] resize-none py-3')} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} />
              </Field>
            )}
            <PrimaryButton onClick={send} loading={pending === 'send'} loadingText="Enviando…">
              {happy && url ? 'Avaliar na loja' : 'Enviar avaliação'}
            </PrimaryButton>
          </div>
        )}
      </div>
    </Sheet>
  )
}
