import { Camera, Check, Eye, EyeOff } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { cx, Field, inputClass, MoneyInput, PrimaryButton } from '../components/ui'
import { readAvatar } from '../lib/image'
import { signIn, signUp } from '../services/auth'
import { errorMessage, USE_SUPABASE } from '../services/http'
import { accountState, useStore } from '../state/store'
import { useUI } from '../state/ui'
import type { AppState, User } from '../types'

type Mode = 'login' | 'signup'

export default function Login() {
  const [mode, setMode] = useState<Mode>('login')
  return (
    <div className="grid min-h-dvh bg-esk-bg md:grid-cols-2">
      <div className="hidden p-6 md:block lg:p-10">
        <div className="flex h-full flex-col justify-between rounded-[34px] p-10 text-esk-ink lg:p-14" style={{ backgroundImage: 'var(--esk-gradient-hero)' }}>
          <p className="font-sat text-[44px] leading-none font-bold tracking-[-1.4px] 3xl:text-[56px]">Okiva</p>
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

      <div className="flex flex-col justify-center px-[32px] py-12 md:px-14 lg:px-24">
        <div className="mx-auto w-full max-w-[400px]">
          <p className="font-sat text-[34px] leading-none font-bold tracking-[-1px] text-esk-lime md:hidden">Okiva</p>
          {mode === 'login' ? <LoginForm onSwitch={() => setMode('signup')} /> : <SignupForm onSwitch={() => setMode('login')} />}
        </div>
      </div>
    </div>
  )
}

function Header({ title, text }: { title: string; text: string }) {
  return (
    <>
      <h1 className="pt-6 font-sat text-[34px] leading-[1.1] font-medium tracking-[-1.3px] text-white md:pt-0">{title}</h1>
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
const MIN_PASSWORD = 6

function FormError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p role="alert" className="animate-rise rounded-[16px] bg-esk-elevated px-4 py-3 font-sat text-[14px] text-esk-lilac">
      {message}
    </p>
  )
}

function PasswordInput({
  id,
  autoComplete,
  value,
  onChange,
}: {
  id: string
  autoComplete: string
  value: string
  onChange: (value: string) => void
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

function LoginForm({ onSwitch }: { onSwitch: () => void }) {
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
        <RememberMe checked={remember} onChange={setRemember} />
        <FormError message={error} />
        <PrimaryButton type="submit" className="mt-2" loading={loading} loadingText="Entrando…">
          Entrar
        </PrimaryButton>
        {freeNote && <p className="text-center font-sat text-[13px] text-esk-subtle">{freeNote}</p>}
        <SwitchLink text="Ainda não tem conta?" action="Criar conta" onClick={onSwitch} />
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
        password: password.length < MIN_PASSWORD ? `Use pelo menos ${MIN_PASSWORD} caracteres.` : undefined,
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
        <Header title="Confirme seu e-mail." text={`Enviamos um link para ${confirmEmail}. Abra o link para ativar sua conta e depois entre com sua senha.`} />
        <div className="flex flex-col gap-5 pt-8">
          <PrimaryButton onClick={onSwitch}>Ir para o login</PrimaryButton>
          <p className="text-center font-sat text-[13px] text-esk-subtle">Não chegou? Confira o spam ou tente de novo em alguns minutos.</p>
        </div>
      </>
    )
  }

  return (
    <>
      <Header title="Crie sua conta." text="Leva menos de um minuto. Depois é só registrar seus gastos." />
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
          <PasswordInput id="password" autoComplete="new-password" value={password} onChange={setPassword} />
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
