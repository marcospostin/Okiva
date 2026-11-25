import { lazy, Suspense, useEffect, useState } from 'react'
import { isRecoverySession, markRecoveryPending, onPasswordRecovery, onSignedOut, restoreSupabaseSession } from './services/auth'
import { USE_SUPABASE } from './services/http'
import DemoBanner from './components/DemoBanner'
import TabBar from './components/TabBar'
import { cx, ScreenSkeleton, ToastView } from './components/ui'
import Home from './screens/Home'
import Login from './screens/Login'
import { StoreProvider, useStore } from './state/store'
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
const FROM_CONFIRMATION_LINK = typeof window !== 'undefined' && /type=(signup|email)|[?&]code=/.test(window.location.hash + window.location.search)
/** Voltou pelo link "Esqueci minha senha": só a tela de senha nova, sem abrir a conta. */
const FROM_RECOVERY_LINK = typeof window !== 'undefined' && /type=recovery/.test(window.location.hash + window.location.search)
/** Link do e-mail vencido ou já usado (o Supabase devolve o erro na URL). */
const LINK_ERROR = typeof window !== 'undefined' && /error_code=|error=access_denied/.test(window.location.hash + window.location.search)
/** Voltou pelo link do código de confirmação (Começar do zero / Excluir conta). */
const CONFIRM_ACTION = typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('confirmar') as 'reset' | 'delete' | null) : null

function Screen() {
  const { state, dispatch } = useStore()
  const { view, navigate, sheet, direction, notify, openSheet } = useUI()
  const plusOnly = view === 'invoice' || view === 'assistant'
  const signedIn = !!state.user
  // Supabase: confere a sessão salva (ou o link de confirmação) antes de mostrar o login
  const [booting, setBooting] = useState(USE_SUPABASE)
  const [recovery, setRecovery] = useState(false)

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
        } else if (FROM_CONFIRMATION_LINK) notify('E-mail confirmado. Bem-vindo ao Okiva!')
        if (CONFIRM_ACTION) window.history.replaceState(window.history.state, '', window.location.pathname)
      })
      .finally(() => alive && setBooting(false))
    const stop = onSignedOut(() => dispatch({ type: 'logout' }))
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

  if (booting) return <ScreenSkeleton />

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
        <Login notice={LINK_ERROR ? 'Esse link expirou ou já foi usado. Peça um novo em "Esqueci minha senha".' : undefined} />
        <ToastView />
      </>
    )

  return (
    <div className="tabbar-space">
      <DemoBanner />
      <main key={view} className={cx('pb-[var(--tabbar-space)]', direction === 'back' ? 'animate-screen-back' : 'animate-screen-forward')}>
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
      {/* Small screens only (md:hidden inside) */}
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
  return (
    <StoreProvider>
      <UIProvider>
        <Screen />
      </UIProvider>
    </StoreProvider>
  )
}
