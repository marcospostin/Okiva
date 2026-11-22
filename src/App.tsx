import { lazy, Suspense, useEffect, useState } from 'react'
import { onSignedOut, restoreSupabaseSession } from './services/auth'
import { USE_SUPABASE } from './services/http'
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
const Invoice = lazy(() => import('./screens/Invoice'))
const Assistant = lazy(loadAssistant)
const SheetHost = lazy(loadSheets)

function Screen() {
  const { state, dispatch } = useStore()
  const { view, navigate, sheet, direction } = useUI()
  const plusOnly = view === 'invoice' || view === 'assistant'
  const signedIn = !!state.user
  // Supabase: confere a sessão salva (ou o link de confirmação) antes de mostrar o login
  const [booting, setBooting] = useState(USE_SUPABASE)

  useEffect(() => {
    if (!USE_SUPABASE) return
    let alive = true
    restoreSupabaseSession()
      .then((account) => {
        if (alive && account) dispatch({ type: 'hydrate', state: account })
      })
      .finally(() => alive && setBooting(false))
    const stop = onSignedOut(() => dispatch({ type: 'logout' }))
    return () => {
      alive = false
      stop()
    }
  }, [dispatch])

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

  if (!signedIn)
    return (
      <>
        <Login />
        <ToastView />
      </>
    )

  return (
    <div className="tabbar-space">
      <main key={view} className={cx('pb-[var(--tabbar-space)]', direction === 'back' ? 'animate-screen-back' : 'animate-screen-forward')}>
        <Suspense fallback={<ScreenSkeleton />}>
          {view === 'home' && <Home />}
          {view === 'cards' && <Cards />}
          {view === 'goals' && <Goals />}
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
