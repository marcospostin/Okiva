import { useEffect, useState } from 'react'

const SEEN_KEY = 'okiva:splash-seen'
/** Tempo mínimo na tela (a marca precisa ser lida, não piscar) */
const MIN_MS = 1600
const FADE_MS = 360

/** Celular (o painel do login fica escondido abaixo de md) e ainda não visto nesta visita. */
function shouldShow() {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(min-width: 768px)').matches) return false
  try {
    return sessionStorage.getItem(SEEN_KEY) !== '1'
  } catch {
    return true
  }
}

/**
 * Splash do celular: o mesmo cartão em degradê do login no desktop, em tela cheia,
 * enquanto o app confere a sessão. Some com fade quando `ready` e o tempo mínimo passou.
 * Uma vez por visita (sessionStorage), para não repetir ao recarregar.
 */
export function Splash({ ready }: { ready: boolean }) {
  const [visible, setVisible] = useState(shouldShow)
  const [minDone, setMinDone] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (!visible) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const id = window.setTimeout(() => setMinDone(true), reduce ? 700 : MIN_MS)
    return () => window.clearTimeout(id)
  }, [visible])

  useEffect(() => {
    if (!visible || !ready || !minDone) return
    setLeaving(true)
    try {
      sessionStorage.setItem(SEEN_KEY, '1')
    } catch {
      /* sem storage: aparece de novo na próxima visita, sem problema */
    }
    const id = window.setTimeout(() => setVisible(false), FADE_MS)
    return () => window.clearTimeout(id)
  }, [visible, ready, minDone])

  if (!visible) return null
  return (
    <div
      role="img"
      aria-label="Okiva. Registre gastos, acompanhe cartões e guarde para o que importa."
      className="fixed inset-0 z-[100] bg-esk-bg p-4 transition-opacity ease-out md:hidden"
      style={{ opacity: leaving ? 0 : 1, transitionDuration: `${FADE_MS}ms` }}
    >
      <div
        className="flex h-full flex-col justify-between rounded-[34px] px-7 pt-9 pb-10 text-esk-ink"
        style={{ backgroundImage: 'var(--esk-gradient-hero)', paddingTop: 'max(36px, env(safe-area-inset-top))', paddingBottom: 'max(40px, env(safe-area-inset-bottom))' }}
      >
        <p className="animate-rise font-sat text-[44px] leading-none font-bold tracking-[-1.4px]">Okiva</p>
        <div>
          <p className="animate-rise font-sat text-[36px] leading-[1.06] font-medium tracking-[-1.4px]" style={{ animationDelay: '120ms' }}>
            Registre gastos, acompanhe cartões e guarde para o que importa.
          </p>
          <p className="animate-rise pt-5 font-sat text-[18px] leading-[1.3] font-medium tracking-[-0.3px]" style={{ animationDelay: '220ms' }}>
            Seu assistente financeiro para gastos e conquistas.
          </p>
        </div>
      </div>
    </div>
  )
}
