import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { isRecoverySession, markRecoveryPending, onPasswordRecovery, onSessionChange, restoreSupabaseSession } from './services/auth'
import { errorMessage, OFFLINE_MESSAGE, USE_SUPABASE } from './services/http'
import { WifiOff } from 'lucide-react'
import DemoBanner from './components/DemoBanner'
import { Splash } from './components/Splash'
import TabBar, { SideRail } from './components/TabBar'
import { cx, ScreenSkeleton, ToastView } from './components/ui'
import Home from './screens/Home'
import Login from './screens/Login'
import { StoreProvider, todayISO, useStore } from './state/store'
import { accountApi } from './services/finance'
import { UIProvider, useUI } from './state/ui'

// Code splitting: secondary screens and sheets load on demand
const loadSheets = () => import('./sheets/SheetHost')
const loadAssistant = () => import('./screens/Assistant')
const Cards = lazy(() => import('./screens/Cards'))
const Goals = lazy(() => import('./screens/Goals'))
const Accounts = lazy(() => import('./screens/Accounts'))
const Settings = lazy(() => import('./screens/Settings'))
const Legal = lazy(() => import('./screens/Legal'))
const Reports = lazy(() => import('./screens/Reports'))
const Invoice = lazy(() => import('./screens/Invoice'))
const Assistant = lazy(loadAssistant)
const SheetHost = lazy(loadSheets)

/** Chegou pelo link do e-mail de confirmação (lido antes de o Supabase limpar a URL). */
const FROM_CONFIRMATION_LINK = typeof window !== 'undefined' && /type=(signup|email)(?![_a-z])|[?&]code=/.test(window.location.hash + window.location.search)
/** Troca de e-mail: o 2º link (de dois) foi confirmado e a troca valeu. */
const EMAIL_CHANGED = typeof window !== 'undefined' && /type=email_change/.test(window.location.hash)
/** Troca de e-mail: o 1º link foi aceito; falta o do outro e-mail ("Secure email change" do Supabase). */
const EMAIL_CHANGE_HALF = typeof window !== 'undefined' && /message=Confirmation(\+|%20| )link(\+|%20| )accepted/i.test(window.location.hash)
const EMAIL_CHANGE_HALF_TEXT = 'Primeira confirmação feita. Agora abra o link que enviamos para o outro e-mail para concluir a troca.'
/** Voltou pelo link "Esqueci minha senha": só a tela de senha nova, sem abrir a conta. */
const FROM_RECOVERY_LINK = typeof window !== 'undefined' && /type=recovery/.test(window.location.hash + window.location.search)
/** Link do e-mail vencido ou já usado (o Supabase devolve o erro na URL). */
const LINK_ERROR = typeof window !== 'undefined' && /error_code=|error=access_denied/.test(window.location.hash + window.location.search)
/** Voltou pelo link do código de confirmação (Começar do zero / Excluir conta). */
const CONFIRM_ACTION = typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('confirmar') as 'reset' | 'delete' | null) : null

function Screen({ onReady }: { onReady: () => void }) {
  const { state, dispatch } = useStore()
  const { view, navigate, sheet, direction, notify, openSheet } = useUI()
  const plusOnly = view === 'invoice' || view === 'assistant'
  const signedIn = !!state.user
  // Supabase: confere a sessão salva (ou o link de confirmação) antes de mostrar o login
  const [booting, setBooting] = useState(USE_SUPABASE)
  const [recovery, setRecovery] = useState(false)
  // Não deu para abrir a conta (sem internet, servidor fora): mostra o aviso em vez do login
  const [bootError, setBootError] = useState<string | null>(null)

  useEffect(() => {
    if (!USE_SUPABASE) return
    let alive = true
    if (FROM_RECOVERY_LINK) markRecoveryPending()
    isRecoverySession()
      .then((isRecovery) => {
        if (isRecovery) {
          if (alive) setRecovery(true)
          return null
        }
        return restoreSupabaseSession()
      })
      .then((account) => {
        if (!alive || !account) return
        dispatch({ type: 'hydrate', state: account })
        if (CONFIRM_ACTION === 'reset' || CONFIRM_ACTION === 'delete') {
          navigate('settings')
          openSheet({ type: 'verifyAction', action: CONFIRM_ACTION, confirmed: true })
        } else if (EMAIL_CHANGED) notify('E-mail trocado. A partir de agora, entre com o e-mail novo.')
        else if (EMAIL_CHANGE_HALF) notify(EMAIL_CHANGE_HALF_TEXT)
        else if (FROM_CONFIRMATION_LINK) notify('E-mail confirmado. Bem-vindo ao Okiva!')
        if (CONFIRM_ACTION || EMAIL_CHANGE_HALF) window.history.replaceState(window.history.state, '', window.location.pathname)
      })
      .catch((err) => alive && setBootError(errorMessage(err, OFFLINE_MESSAGE)))
      .finally(() => alive && setBooting(false))
    // Sessão desta aba acabou (ou virou outra pessoa) fora do app: login, ou recarrega a conta certa
    const stop = onSessionChange((change) => (change === 'out' ? dispatch({ type: 'logout' }) : window.location.reload()))
    // Link de recuperação aberto com o app já carregado: fecha a conta e mostra só a senha nova
    const stopRecovery = onPasswordRecovery(() => {
      dispatch({ type: 'logout' })
      setRecovery(true)
    })
    return () => {
      alive = false
      stop()
      stopRecovery()
    }
  }, [dispatch, notify, openSheet, navigate])

  // Stage 1 has no AI screens
  useEffect(() => {
    if (plusOnly && state.stage === 1) navigate('home')
  }, [plusOnly, state.stage, navigate])

  // Warm the sheet chunk (and the assistant) after sign-in so the first tap opens instantly
  useEffect(() => {
    if (!signedIn) return
    const id = window.setTimeout(() => {
      loadSheets()
      loadAssistant()
    }, 600)
    return () => window.clearTimeout(id)
  }, [signedIn])

  useEffect(() => {
    if (!booting) onReady()
  }, [booting, onReady])

  // Virou o dia com o app aberto (aba esquecida aberta, celular que volta do segundo plano):
  // processa recorrências e parcelas que venceram e atualiza "hoje", o mês atual e os vencimentos.
  const latest = useRef(state)
  latest.current = state
  useEffect(() => {
    if (!signedIn) return
    let day = todayISO()
    const check = () => {
      const now = todayISO()
      if (now === day) return
      day = now
      if (USE_SUPABASE) {
        // O banco processa os vencimentos (process_due) ao carregar a conta
        accountApi.snapshot(latest.current).then((snapshot) => dispatch({ type: 'sync', snapshot }), () => dispatch({ type: 'newDay' }))
      } else {
        dispatch({ type: 'newDay' })
      }
    }
    const onVisible = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', check)
    const id = window.setInterval(check, 60_000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', check)
      window.clearInterval(id)
    }
  }, [signedIn, dispatch])

  if (booting) return <ScreenSkeleton />

  if (bootError && !signedIn)
    return (
      <div className="grid min-h-dvh place-items-center bg-esk-bg px-8 text-center">
        <div className="flex max-w-[360px] flex-col items-center gap-4">
          <WifiOff size={32} className="text-esk-muted" aria-hidden />
          <p className="font-sat text-[20px] font-medium text-white">Não deu para abrir sua conta</p>
          <p className="font-sat text-[14px] leading-[1.45] text-esk-muted">{bootError} Sua sessão continua salva.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-2 h-[48px] rounded-[24px] bg-esk-lime px-6 font-sat text-[15px] font-medium text-esk-ink transition active:scale-95"
          >
            Tentar de novo
          </button>
        </div>
      </div>
    )

  // Link de recuperação: só cria a senha nova; a conta não abre por essa sessão
  if (recovery)
    return (
      <>
        <Login recovery onRecoveryDone={() => setRecovery(false)} />
        <ToastView />
      </>
    )

  if (!signedIn)
    return (
      <>
        <Login
          notice={
            LINK_ERROR
              ? 'Esse link expirou ou já foi usado. Peça um novo em "Esqueci minha senha".'
              : EMAIL_CHANGE_HALF
                ? EMAIL_CHANGE_HALF_TEXT
                : undefined
          }
        />
        <ToastView />
      </>
    )

  return (
    <div className="tabbar-space">
      <DemoBanner />
      {/* Tablet/computador: barra lateral na mesma linha do conteúdo, então desce junto com a faixa de demonstração */}
      <div className="md:flex md:items-start">
        <SideRail />
        <main key={view} className={cx('min-w-0 flex-1 pb-[var(--tabbar-space)]', direction === 'back' ? 'animate-screen-back' : 'animate-screen-forward')}>
        <Suspense fallback={<ScreenSkeleton />}>
          {view === 'home' && <Home />}
          {view === 'cards' && <Cards />}
          {view === 'goals' && <Goals />}
          {view === 'accounts' && <Accounts />}
          {view === 'settings' && <Settings />}
          {view === 'privacy' && <Legal doc="privacy" />}
          {view === 'terms' && <Legal doc="terms" />}
          {view === 'reports' && <Reports />}
          {view === 'invoice' && state.stage === 2 && <Invoice />}
          {view === 'assistant' && state.stage === 2 && <Assistant />}
        </Suspense>
        </main>
      </div>
      {/* Celular: menu inferior (md:hidden) */}
      <TabBar />
      {sheet && (
        <Suspense fallback={null}>
          <SheetHost />
        </Suspense>
      )}
      <ToastView />
    </div>
  )
}

export default function App() {
  // Splash do celular fica fora das telas: não reinicia quando o app troca de carregando para login/Home
  const [ready, setReady] = useState(false)
  const markReady = useCallback(() => setReady(true), [])
  return (
    <StoreProvider>
      <UIProvider>
        <Screen onReady={markReady} />
        <Splash ready={ready} />
      </UIProvider>
    </StoreProvider>
  )
}
