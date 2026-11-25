import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { CategoryId } from '../types'

export type View = 'home' | 'cards' | 'goals' | 'invoice' | 'assistant' | 'accounts' | 'settings' | 'privacy' | 'terms' | 'reports'

export type SheetState =
  /** Adicionar gasto ou receita */
  | { type: 'add'; kind?: 'expense' | 'income' }
  /** Pagar a fatura de um cartão (ou editar um pagamento: id) */
  | { type: 'payInvoice'; cardId?: string; id?: string }
  /** Compra parcelada que começou antes do Okiva (id = editar uma existente) */
  | { type: 'ongoing'; cardId?: string; id?: string }
  /** Nova conta (sem id) ou editar/excluir */
  | { type: 'bankAccount'; id?: string; parentId?: string }
  /** Mover dinheiro entre contas/subcontas (id = editar) */
  | { type: 'transfer'; id?: string; from?: string; to?: string }
  /** Conferir saldo (conta) ou fatura (cartão) com o banco */
  | { type: 'reconcile'; accountId?: string; cardId?: string }
  /** Editar, encerrar ou apagar uma recorrência */
  | { type: 'recurrence'; id: string }
  /** Classificar gastos sem categoria (id = começar por este) */
  | { type: 'categorize'; id?: string }
  /** Aviso do teto de uma categoria */
  | { type: 'capAlert'; category: CategoryId }
  | { type: 'edit'; id: string }
  | { type: 'tx'; id: string }
  | { type: 'card'; id?: string }
  | { type: 'save'; goalId: string }
  | { type: 'goal'; id?: string }
  | { type: 'budget'; category?: CategoryId }
  | { type: 'cap' }
  | { type: 'balance' }
  /** Relatórios: lançamentos que formam um valor (category = oferece "ver onde gastei") */
  | { type: 'reportDetail'; title: string; subtitle?: string; ids: string[]; category?: CategoryId | null }
  /** Tela Conta → sheets */
  | { type: 'plan' }
  | { type: 'security' }
  | { type: 'changeEmail' }
  | { type: 'changePassword' }
  /** Senha nova depois do link "Esqueci minha senha" */
  | { type: 'newPassword' }
  | { type: 'notifications' }
  | { type: 'help' }
  | { type: 'bug' }
  | { type: 'rate' }
  /** Ações sem volta: senha + código no e-mail (confirmed = voltou pelo link do e-mail) */
  | { type: 'verifyAction'; action: 'reset' | 'delete'; confirmed?: boolean }
  /** Name / e-mail of the account, and account deletion */
  | { type: 'profile' }
  /** One deposit of a goal: edit amount/date or delete */
  | { type: 'deposit'; id: string }
  /** Categories the person created */
  | { type: 'categories' }
  /** Create (no id) or edit/delete a custom category */
  | { type: 'category'; id?: string }
  /** An imported invoice: details, its expenses, undo */
  | { type: 'invoiceImport'; id: string }
  /** Okiva Plus upsell: opened from AI entry points while the account is in manual mode */
  | { type: 'plus'; then?: View }

export type ToastTone = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  message: string
  tone: ToastTone
  leaving: boolean
}

interface UIValue {
  view: View
  canGoBack: boolean
  /** Last navigation direction, drives the screen enter animation */
  direction: 'forward' | 'back'
  navigate: (v: View) => void
  /** Bottom tab bar: tabs replace each other instead of piling up in the back stack */
  switchTab: (v: View) => void
  back: () => void
  sheet: SheetState | null
  /** True while the sheet plays its exit animation */
  sheetClosing: boolean
  openSheet: (s: SheetState) => void
  closeSheet: () => void
  toast: Toast | null
  notify: (message: string, tone?: ToastTone) => void
}

const UIContext = createContext<UIValue | null>(null)

const SHEET_EXIT_MS = 200
const TOAST_MS = 2800
const TOAST_EXIT_MS = 180

/**
 * View stack + sheets. Few full screens; everything else is a sheet on top.
 * The stack is mirrored in browser history so the device back button works.
 */
export function UIProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<View[]>(['home'])
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  const [sheet, setSheet] = useState<SheetState | null>(null)
  const [sheetClosing, setSheetClosing] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)
  const sheetTimer = useRef<number | undefined>(undefined)
  const stackRef = useRef(stack)
  stackRef.current = stack

  const dropSheet = useCallback(() => {
    window.clearTimeout(sheetTimer.current)
    setSheetClosing(false)
    setSheet(null)
  }, [])

  useEffect(() => {
    history.replaceState({ depth: 0 }, '')
    const onPop = (e: PopStateEvent) => {
      const depth = (e.state?.depth as number | undefined) ?? 0
      dropSheet()
      setDirection('back')
      setStack((s) => s.slice(0, depth + 1))
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [dropSheet])

  const navigate = useCallback(
    (v: View) => {
      const s = stackRef.current
      dropSheet()
      window.scrollTo({ top: 0 })
      if (v === 'home') {
        setDirection('back')
        if (s.length > 1) history.go(-(s.length - 1))
        setStack(['home'])
        return
      }
      if (s[s.length - 1] === v) return
      const next = [...s, v]
      history.pushState({ depth: next.length - 1 }, '')
      setDirection('forward')
      setStack(next)
    },
    [dropSheet],
  )

  const switchTab = useCallback(
    (v: View) => {
      const s = stackRef.current
      if (v === 'home' || s.length === 1) return navigate(v)
      if (s[s.length - 1] === v) return
      dropSheet()
      window.scrollTo({ top: 0 })
      // Home stays at the bottom of the stack, the tab takes the place of the current screen
      if (s.length > 2) history.go(-(s.length - 2))
      else history.replaceState({ depth: 1 }, '')
      setDirection('forward')
      setStack(['home', v])
    },
    [navigate, dropSheet],
  )

  const back = useCallback(() => {
    if (stackRef.current.length > 1) history.back()
  }, [])

  const openSheet = useCallback((s: SheetState) => {
    window.clearTimeout(sheetTimer.current)
    setSheetClosing(false)
    setSheet(s)
  }, [])

  const closeSheet = useCallback(() => {
    window.clearTimeout(sheetTimer.current)
    setSheetClosing(true)
    sheetTimer.current = window.setTimeout(() => {
      setSheet(null)
      setSheetClosing(false)
    }, SHEET_EXIT_MS)
  }, [])

  const notify = useCallback((message: string, tone: ToastTone = 'success') => {
    window.clearTimeout(toastTimer.current)
    const id = Date.now()
    setToast({ id, message, tone, leaving: false })
    toastTimer.current = window.setTimeout(() => {
      setToast((t) => (t && t.id === id ? { ...t, leaving: true } : t))
      toastTimer.current = window.setTimeout(() => setToast((t) => (t && t.id === id ? null : t)), TOAST_EXIT_MS)
    }, tone === 'error' ? TOAST_MS + 1200 : TOAST_MS)
  }, [])

  const value = useMemo<UIValue>(
    () => ({
      view: stack[stack.length - 1],
      canGoBack: stack.length > 1,
      direction,
      navigate,
      switchTab,
      back,
      sheet,
      sheetClosing,
      openSheet,
      closeSheet,
      toast,
      notify,
    }),
    [stack, direction, sheet, sheetClosing, toast, navigate, switchTab, back, openSheet, closeSheet, notify],
  )
  return <UIContext.Provider value={value}>{children}</UIContext.Provider>
}

export function useUI() {
  const ctx = useContext(UIContext)
  if (!ctx) throw new Error('useUI must be used inside UIProvider')
  return ctx
}
