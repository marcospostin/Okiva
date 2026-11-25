import { ArrowLeft, Camera, Check, Eye, EyeOff, Sparkles } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { cx, Field, inputClass, MoneyInput, PrimaryButton, RoundButton } from '../components/ui'
import { readAvatar } from '../lib/image'
import { finishRecovery, signIn, signUp, startDemo } from '../services/auth'
import { securityApi } from '../services/settings'
import { errorMessage, USE_SUPABASE } from '../services/http'
import { accountState, useStore } from '../state/store'
import { useUI } from '../state/ui'
import type { AppState, User } from '../types'

type Mode = 'login' | 'signup' | 'forgot' | 'reset'

/** Saindo da demonstração por "Criar minha conta": o login abre direto no cadastro. */
export const SIGNUP_NEXT_KEY = 'okiva:signup-next'

function initialMode(): Mode {
  try {
    if (sessionStorage.getItem(SIGNUP_NEXT_KEY)) {
      sessionStorage.removeItem(SIGNUP_NEXT_KEY)
      return 'signup'
    }
  } catch {
    /* storage indisponível */
  }
  return 'login'
}

/**
 * `recovery`: chegou pelo link "Esqueci minha senha". A sessão de recuperação NÃO abre o app:
 * a pessoa só cria a senha nova; depois a sessão é encerrada (em todos os aparelhos) e ela entra
 * de novo com a senha nova.
 */
export default function Login({ recovery, onRecoveryDone, notice }: { recovery?: boolean; onRecoveryDone?: () => void; notice?: string }) {
  const [mode, setMode] = useState<Mode>(() => (recovery ? 'reset' : initialMode()))
  return (
    // Desktop: form in a fixed column (400px form + 96px air each side) and the hero card
    // takes the rest, with the same 48px margin on its outer sides. Keeps card→form and
    // form→edge distances equal instead of a huge gap in the middle.
    <div className="grid min-h-dvh bg-esk-bg md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_592px] 3xl:grid-cols-[minmax(0,1fr)_656px]">
      <div className="hidden p-6 md:block lg:p-12 lg:pr-0">
        <div className="flex h-full flex-col justify-between rounded-[34px] p-10 text-esk-ink lg:p-14" style={{ backgroundImage: 'var(--esk-gradient-hero)' }}>
          <p className="font-sat text-[54px] leading-none font-bold tracking-[-1.7px] 3xl:text-[66px]">Okiva</p>
          <div>
            <p className="max-w-[460px] font-sat text-[44px] leading-[1.05] font-medium tracking-[-1.8px] 3xl:text-[56px]">
              Registre gastos, acompanhe cartões e guarde para o que importa.
            </p>
            <p className="max-w-[420px] pt-6 font-sat text-[22px] leading-[1.25] font-medium tracking-[-0.5px]">
              Seu assistente financeiro para gastos e conquistas.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-center px-[32px] py-12 md:px-12 lg:px-24 3xl:px-32">
        <div className="mx-auto w-full max-w-[400px]">
          <p className="font-sat text-[42px] leading-none font-bold tracking-[-1.2px] text-esk-lime md:hidden">Okiva</p>
          {mode === 'login' && <LoginForm onSwitch={() => setMode('signup')} onForgot={() => setMode('forgot')} />}
          {mode === 'signup' && <SignupForm onSwitch={() => setMode('login')} />}
          {mode === 'forgot' && <ForgotForm onBack={() => setMode('login')} />}
          {mode === 'reset' && (
            <ResetForm
              onDone={() => {
                onRecoveryDone?.()
                setMode('login')
              }}
            />
          )}
          {notice && mode === 'login' && <p role="status" className="mt-6 rounded-[16px] bg-esk-elevated px-4 py-3 font-sat text-[14px] text-esk-lime-soft">{notice}</p>}
        </div>
      </div>
    </div>
  )
}

function Header({ title, text, onBack }: { title: string; text: string; onBack?: () => void }) {
  const heading = <h1 className="font-sat text-[34px] leading-[1.1] font-medium tracking-[-1.3px] text-white">{title}</h1>
  return (
    <>
      {onBack ? (
        // Mesmo padrão dos cabeçalhos do app (ScreenHeader): botão redondo de voltar ao lado do título
        <div className="flex items-center gap-3 pt-6 md:pt-0">
          <RoundButton label="Voltar" onClick={onBack}>
            <ArrowLeft size={19} strokeWidth={1.6} />
          </RoundButton>
          {heading}
        </div>
      ) : (
        <div className="pt-6 md:pt-0">{heading}</div>
      )}
      <p className="pt-3 font-sat text-[15px] text-esk-muted">{text}</p>
    </>
  )
}

function SwitchLink({ text, action, onClick }: { text: string; action: string; onClick: () => void }) {
  return (
    <p className="text-center font-sat text-[14px] text-esk-muted">
      {text}{' '}
      <button type="button" onClick={onClick} className="font-medium text-esk-lime hover:underline">
        {action}
      </button>
    </p>
  )
}

function RememberMe({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 self-start font-sat text-[14px] text-white select-none">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        className={cx(
          'grid size-[22px] place-items-center rounded-[7px] transition peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-esk-lime',
          checked ? 'bg-esk-lime text-esk-ink' : 'ring-1 ring-esk-subtle',
        )}
      >
        {checked && <Check size={14} strokeWidth={2.4} />}
      </span>
      Lembrar de mim
    </label>
  )
}

/** Com o Supabase ligado o login é real (e-mail e senha); sem ele, o protótipo aceita qualquer coisa. */
const REAL_AUTH = USE_SUPABASE
const freeNote = REAL_AUTH ? '' : 'Protótipo: nenhum campo é obrigatório.'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function FormError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p role="alert" className="animate-rise rounded-[16px] bg-esk-elevated px-4 py-3 font-sat text-[14px] text-esk-lilac">
      {message}
    </p>
  )
}

/* ------------------------------------------------------------ força da senha */

/**
 * Regras exibidas ao digitar a senha no cadastro. Obrigatórias: tamanho, maiúscula,
 * minúscula e número. Símbolo é recomendado (conta para "Forte"). Segue as boas
 * práticas atuais: comprimento pesa mais que complexidade, colar senha é permitido
 * e o retorno aparece enquanto a pessoa digita.
 */
const PASSWORD_RULES = [
  { id: 'length', label: 'Pelo menos 8 caracteres', test: (p: string) => p.length >= 8, required: true },
  { id: 'upper', label: 'Uma letra maiúscula', test: (p: string) => /[A-ZÀ-Ý]/.test(p), required: true },
  { id: 'lower', label: 'Uma letra minúscula', test: (p: string) => /[a-zß-ÿ]/.test(p), required: true },
  { id: 'number', label: 'Um número', test: (p: string) => /\d/.test(p), required: true },
  { id: 'symbol', label: 'Um símbolo (recomendado)', test: (p: string) => /[^A-Za-zÀ-ÿ0-9\s]/.test(p), required: false },
] as const

/** Senhas óbvias ficam sempre como "Fraca", mesmo cumprindo as regras. */
const WEAK_PATTERN = /(123456|654321|abcdef|qwerty|senha|password|okiva|(.)\2{3,})/i

const STRENGTH = [
  { label: 'Muito fraca', color: '#f08a8a' },
  { label: 'Fraca', color: '#f08a8a' },
  { label: 'Média', color: '#f6dca4' },
  { label: 'Boa', color: '#d6e6c4' },
  { label: 'Forte', color: 'var(--color-esk-lime)' },
] as const

export function passwordMeetsRules(p: string) {
  return PASSWORD_RULES.every((r) => !r.required || r.test(p))
}

function passwordScore(p: string) {
  if (!p) return 0
  const classes = [/[A-ZÀ-Ý]/, /[a-zß-ÿ]/, /\d/, /[^A-Za-zÀ-ÿ0-9\s]/].filter((re) => re.test(p)).length
  let score = 0
  if (p.length >= 8) score++
  if (p.length >= 12) score++
  if (classes >= 3) score++
  if (classes === 4) score++
  if (WEAK_PATTERN.test(p)) score = Math.min(score, 1)
  // "Forte" exige cumprir as regras obrigatórias
  if (!passwordMeetsRules(p)) score = Math.min(score, 2)
  return score
}

export function PasswordStrength({ id, password }: { id: string; password: string }) {
  if (!password) return null
  const score = passwordScore(password)
  const level = STRENGTH[score]
  return (
    <div id={id} className="flex animate-rise flex-col gap-3 pt-1">
      <div className="flex items-center gap-3">
        <div className="grid flex-1 grid-cols-4 gap-1" aria-hidden>
          {[1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="h-[4px] rounded-full transition-colors duration-300"
              style={{ backgroundColor: i <= Math.max(score, 1) ? level.color : 'var(--color-esk-track)' }}
            />
          ))}
        </div>
        <span className="min-w-[72px] text-right font-sat text-[12px] font-medium" style={{ color: level.color }} aria-live="polite">
          {level.label}
        </span>
      </div>
      <ul className="grid gap-[6px] sm:grid-cols-2" aria-label="Requisitos da senha">
        {PASSWORD_RULES.map((r) => {
          const ok = r.test(password)
          return (
            <li key={r.id} className={cx('flex items-center gap-2 font-sat text-[12px] transition-colors', ok ? 'text-esk-lime-soft' : 'text-esk-subtle')}>
              <span
                className={cx(
                  'grid size-[16px] shrink-0 place-items-center rounded-full transition',
                  ok ? 'bg-esk-lime text-esk-ink' : 'ring-1 ring-esk-track',
                )}
                aria-hidden
              >
                {ok && <Check size={11} strokeWidth={3} />}
              </span>
              <span>
                {r.label}
                <span className="sr-only">{ok ? ' (ok)' : ' (pendente)'}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function PasswordInput({
  id,
  autoComplete,
  value,
  onChange,
  describedBy,
}: {
  id: string
  autoComplete: string
  value: string
  onChange: (value: string) => void
  describedBy?: string
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        className={cx(inputClass, 'pr-12')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={describedBy}
      />
      <button
        type="button"
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
        className="absolute top-1/2 right-4 grid size-7 -translate-y-1/2 place-items-center rounded-md text-esk-muted transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-esk-lime"
      >
        {visible ? <EyeOff size={19} strokeWidth={1.8} /> : <Eye size={19} strokeWidth={1.8} />}
      </button>
    </div>
  )
}

function useEnter() {
  const { dispatch } = useStore()
  const { notify } = useUI()
  return (user: User, opts: { state?: AppState; balance?: number; welcome: string }) => {
    // Supabase: dados vindos do banco. Protótipo: dados salvos neste navegador.
    dispatch({ type: 'hydrate', state: opts.state ?? accountState(user, { balance: opts.balance }) })
    notify(opts.welcome)
  }
}

/* ------------------------------------------------------------------ Login */

function LoginForm({ onSwitch, onForgot }: { onSwitch: () => void; onForgot: () => void }) {
  const enter = useEnter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)
  const [tries, setTries] = useState(0)
  const [error, setError] = useState<string>()
  const errors = REAL_AUTH
    ? {
        email: !email.trim() ? 'Digite seu e-mail.' : !EMAIL_RE.test(email.trim()) ? 'Confira o e-mail.' : undefined,
        password: !password ? 'Digite sua senha.' : undefined,
      }
    : {}
  const show = (e?: string) => (tries ? e : undefined)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setTries((n) => n + 1)
    setError(undefined)
    if (errors.email || errors.password) return
    setLoading(true)
    try {
      const result = await signIn({ email, password, remember })
      if ('confirmEmail' in result) return setError('Confirme seu e-mail pelo link que enviamos antes de entrar.')
      enter(result.user, { state: result.state, welcome: `Olá, ${result.user.name.split(' ')[0]}` })
    } catch (err) {
      setError(errorMessage(err, 'Não deu para entrar agora. Tente de novo.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Header
        title="Assuma o controle dos seus planos financeiros."
        text={REAL_AUTH ? 'Entre com seu e-mail e senha.' : 'Toque em Entrar para abrir a conta de demonstração.'}
      />
      <form noValidate className="flex flex-col gap-5 pt-10" onSubmit={submit}>
        <Field label="E-mail" htmlFor="email" error={show(errors.email)} attempt={tries}>
          <input id="email" type="email" autoComplete="email" className={inputClass} placeholder="voce@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Senha" htmlFor="password" error={show(errors.password)} attempt={tries}>
          <PasswordInput id="password" autoComplete="current-password" value={password} onChange={setPassword} />
        </Field>
        <div className="flex items-center justify-between gap-3">
          <RememberMe checked={remember} onChange={setRemember} />
          {REAL_AUTH && (
            <button type="button" onClick={onForgot} className="font-sat text-[14px] font-medium text-esk-lime-soft hover:underline">
              Esqueci minha senha
            </button>
          )}
        </div>
        <FormError message={error} />
        <PrimaryButton type="submit" className="mt-2" loading={loading} loadingText="Entrando…">
          Entrar
        </PrimaryButton>
        {freeNote && <p className="text-center font-sat text-[13px] text-esk-subtle">{freeNote}</p>}
        {REAL_AUTH && <DemoEntry />}
        <SwitchLink text="Ainda não tem conta?" action="Criar conta" onClick={onSwitch} />
      </form>
    </>
  )
}

/** Entrada da demonstração: conta temporária com os dados do Lucas, só deste visitante. */
function DemoEntry() {
  const enter = useEnter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()

  async function start() {
    setError(undefined)
    setLoading(true)
    try {
      const result = await startDemo()
      if ('confirmEmail' in result) return
      enter(result.user, { state: result.state, welcome: 'Bem-vindo à demonstração do Okiva' })
    } catch (err) {
      setError(errorMessage(err, 'Não deu para abrir a demonstração. Tente de novo.'))
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 font-sat text-[13px] text-esk-subtle" aria-hidden>
        <span className="h-px flex-1 bg-esk-track" />
        ou
        <span className="h-px flex-1 bg-esk-track" />
      </div>
      <FormError message={error} />
      <PrimaryButton tone="dark" onClick={start} loading={loading} loadingText="Preparando demonstração…">
        <Sparkles size={17} strokeWidth={1.8} aria-hidden />
        Ver demonstração
      </PrimaryButton>
      <p className="text-center font-sat text-[13px] leading-[1.4] text-esk-subtle">
        Entre como Lucas, com dados de exemplo, sem cadastro. Tudo é apagado quando você sai.
      </p>
    </div>
  )
}

/* ------------------------------------------------------- Esqueci a senha */

function ForgotForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [tries, setTries] = useState(0)
  const [error, setError] = useState<string>()
  const emailError = !email.trim() ? 'Digite seu e-mail.' : !EMAIL_RE.test(email.trim()) ? 'Confira o e-mail.' : undefined

  async function submit(e: FormEvent) {
    e.preventDefault()
    setTries((n) => n + 1)
    setError(undefined)
    if (emailError) return
    setLoading(true)
    try {
      await securityApi.requestPasswordReset(email)
      setSent(true)
    } catch (err) {
      setError(errorMessage(err, 'Não deu para enviar o e-mail agora. Tente de novo em alguns minutos.'))
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <>
        <Header onBack={onBack} title="Confira seu e-mail" text={`Se existir uma conta com ${email.trim()}, enviamos um link para criar uma senha nova. O link vale por 1 hora.`} />
        <div className="flex flex-col gap-4 pt-10">
          <p className="font-sat text-[13px] text-esk-subtle">Não chegou? Veja a caixa de spam ou tente de novo em alguns minutos.</p>
          <PrimaryButton onClick={onBack}>Voltar para o login</PrimaryButton>
        </div>
      </>
    )
  }

  return (
    <>
      <Header onBack={onBack} title="Esqueceu a senha?" text="Digite o e-mail da sua conta. Enviamos um link para você criar uma senha nova." />
      <form noValidate className="flex flex-col gap-5 pt-10" onSubmit={submit}>
        <Field label="E-mail" htmlFor="forgot-email" error={tries ? emailError : undefined} attempt={tries}>
          <input id="forgot-email" type="email" autoComplete="email" className={inputClass} placeholder="voce@email.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </Field>
        <FormError message={error} />
        <PrimaryButton type="submit" loading={loading} loadingText="Enviando…">
          Enviar link
        </PrimaryButton>
        <SwitchLink text="Lembrou?" action="Voltar para o login" onClick={onBack} />
      </form>
    </>
  )
}

/* --------------------------------------------- Senha nova (link do e-mail) */

function ResetForm({ onDone }: { onDone: () => void }) {
  const { notify } = useUI()
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [tries, setTries] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const errors = {
    next: !next ? 'Crie uma senha nova.' : !passwordMeetsRules(next) ? 'A senha ainda não atende aos requisitos abaixo.' : undefined,
    confirm: confirm !== next ? 'As senhas não são iguais.' : undefined,
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setTries((n) => n + 1)
    setError(undefined)
    if (errors.next || errors.confirm) return
    setLoading(true)
    try {
      await securityApi.setNewPassword(next)
      await finishRecovery()
      notify('Senha alterada. Entre com a senha nova.')
      onDone()
    } catch (err) {
      setError(errorMessage(err, 'Não deu para salvar a senha. Peça um link novo.'))
    } finally {
      setLoading(false)
    }
  }

  async function cancel() {
    await finishRecovery()
    onDone()
  }

  return (
    <>
      <Header onBack={cancel} title="Crie uma senha nova" text="Escolha uma senha para entrar no Okiva. Depois de salvar, você entra de novo com ela em todos os aparelhos." />
      <form noValidate className="flex flex-col gap-5 pt-10" onSubmit={submit}>
        <Field label="Senha nova" htmlFor="reset-pass" error={tries ? errors.next : undefined} attempt={tries}>
          <PasswordInput id="reset-pass" autoComplete="new-password" value={next} onChange={setNext} describedBy="reset-strength" />
          <PasswordStrength id="reset-strength" password={next} />
        </Field>
        <Field label="Confirmar senha nova" htmlFor="reset-pass2" error={tries ? errors.confirm : undefined} attempt={tries}>
          <PasswordInput id="reset-pass2" autoComplete="new-password" value={confirm} onChange={setConfirm} />
        </Field>
        <FormError message={error} />
        <PrimaryButton type="submit" loading={loading} loadingText="Salvando…">
          Salvar senha nova
        </PrimaryButton>
      </form>
    </>
  )
}

/* ---------------------------------------------------------------- Cadastro */

function SignupForm({ onSwitch }: { onSwitch: () => void }) {
  const enter = useEnter()
  const fileInput = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [balance, setBalance] = useState(0)
  const [avatar, setAvatar] = useState<string>()
  const [photoError, setPhotoError] = useState<string>()
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)
  const [tries, setTries] = useState(0)
  const [error, setError] = useState<string>()
  const [confirmEmail, setConfirmEmail] = useState<string>()
  const errors = REAL_AUTH
    ? {
        email: !email.trim() ? 'Digite seu e-mail.' : !EMAIL_RE.test(email.trim()) ? 'Confira o e-mail.' : undefined,
        password: !password ? 'Crie uma senha.' : !passwordMeetsRules(password) ? 'A senha ainda não atende aos requisitos abaixo.' : undefined,
        confirm: confirmPassword !== password ? 'As senhas não são iguais.' : undefined,
      }
    : {}
  const show = (e?: string) => (tries ? e : undefined)

  async function pickPhoto(file?: File) {
    if (!file) return
    try {
      setAvatar(await readAvatar(file))
      setPhotoError(undefined)
    } catch (err) {
      setPhotoError((err as Error).message)
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setTries((n) => n + 1)
    setError(undefined)
    if (errors.email || errors.password || errors.confirm) return
    setLoading(true)
    try {
      const result = await signUp({ name, email, password, avatar, balance, remember })
      if ('confirmEmail' in result) return setConfirmEmail(result.confirmEmail)
      enter(result.user, { state: result.state, balance, welcome: 'Conta criada. Bem-vindo à Okiva!' })
    } catch (err) {
      setError(errorMessage(err, 'Não deu para criar a conta agora. Tente de novo.'))
    } finally {
      setLoading(false)
    }
  }

  // Projeto com confirmação de e-mail: a conta abre depois do link
  if (confirmEmail) {
    return (
      <>
        <Header onBack={onSwitch} title="Confirme seu e-mail." text={`Enviamos um link para ${confirmEmail}. Abra o link para ativar sua conta e depois entre com sua senha.`} />
        <div className="flex flex-col gap-5 pt-8">
          <PrimaryButton onClick={onSwitch}>Ir para o login</PrimaryButton>
          <p className="text-center font-sat text-[13px] text-esk-subtle">Não chegou? Confira o spam ou tente de novo em alguns minutos.</p>
        </div>
      </>
    )
  }

  return (
    <>
      <Header onBack={onSwitch} title="Crie sua conta." text="Leva menos de um minuto. Depois é só registrar seus gastos." />
      <form noValidate className="flex flex-col gap-5 pt-8" onSubmit={submit}>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            aria-label={avatar ? 'Trocar foto' : 'Carregar foto'}
            className="relative grid size-[76px] shrink-0 place-items-center overflow-hidden rounded-full bg-esk-elevated ring-1 ring-esk-track transition hover:ring-esk-lime"
          >
            {avatar ? <img alt="" src={avatar} className="size-full object-cover" /> : <Camera size={24} strokeWidth={1.6} className="text-esk-muted" />}
          </button>
          <div className="flex flex-col items-start gap-1">
            <button type="button" onClick={() => fileInput.current?.click()} className="font-sat text-[15px] font-medium text-esk-lime hover:underline">
              {avatar ? 'Trocar foto' : 'Carregar foto'}
            </button>
            {avatar ? (
              <button type="button" onClick={() => setAvatar(undefined)} className="font-sat text-[13px] text-esk-subtle hover:text-white">
                Remover
              </button>
            ) : (
              <span className="font-sat text-[13px] text-esk-subtle">Opcional · JPG ou PNG</span>
            )}
            {photoError && <span className="font-sat text-[13px] text-esk-lilac">{photoError}</span>}
          </div>
          <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(e) => { pickPhoto(e.target.files?.[0]); e.target.value = '' }} />
        </div>
        <Field label="Nome" htmlFor="name">
          <input id="name" autoComplete="given-name" className={inputClass} placeholder="Como quer ser chamado" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        </Field>
        <Field label="E-mail" htmlFor="email" error={show(errors.email)} attempt={tries}>
          <input id="email" type="email" autoComplete="email" className={inputClass} placeholder="voce@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Senha" htmlFor="password" error={show(errors.password)} attempt={tries}>
          <PasswordInput id="password" autoComplete="new-password" value={password} onChange={setPassword} describedBy={REAL_AUTH ? 'password-strength' : undefined} />
          {REAL_AUTH && <PasswordStrength id="password-strength" password={password} />}
        </Field>
        <Field label="Confirmar senha" htmlFor="confirm-password" error={show(errors.confirm)} attempt={tries}>
          <PasswordInput id="confirm-password" autoComplete="new-password" value={confirmPassword} onChange={setConfirmPassword} />
        </Field>
        <Field label="Quanto você tem hoje?" htmlFor="balance">
          <MoneyInput id="balance" value={balance} onChange={setBalance} />
          <span className="font-sat text-[12px] text-esk-subtle">Vira seu saldo inicial. Você pode ajustar depois na sua conta.</span>
        </Field>
        <RememberMe checked={remember} onChange={setRemember} />
        <FormError message={error} />
        <PrimaryButton type="submit" className="mt-2" loading={loading} loadingText="Criando conta…">
          Criar conta
        </PrimaryButton>
        {freeNote && <p className="text-center font-sat text-[13px] text-esk-subtle">{freeNote}</p>}
        <SwitchLink text="Já tem conta?" action="Entrar" onClick={onSwitch} />
      </form>
    </>
  )
}
