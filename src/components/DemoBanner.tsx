import { Sparkles } from 'lucide-react'
import { useState } from 'react'
import { signOut } from '../services/auth'
import { setToken } from '../services/http'
import { useStore } from '../state/store'
import { useUI } from '../state/ui'
import { SIGNUP_NEXT_KEY } from '../screens/Login'

/**
 * Faixa no topo durante a demonstração: deixa claro que os dados são de exemplo
 * e temporários, e leva quem gostou para o cadastro de verdade.
 */
export default function DemoBanner() {
  const { state, dispatch } = useStore()
  const { navigate } = useUI()
  const [leaving, setLeaving] = useState(false)
  if (!state.user?.demo) return null

  async function leave(toSignup: boolean) {
    if (leaving) return
    setLeaving(true)
    try {
      if (toSignup) sessionStorage.setItem(SIGNUP_NEXT_KEY, '1')
    } catch {
      /* storage indisponível */
    }
    // Apaga a conta temporária e os dados dela e só então volta ao login (espera terminar)
    await signOut()
    setToken(null)
    navigate('home')
    dispatch({ type: 'logout' })
  }

  return (
    <div role="status" className="border-b border-esk-lilac/20 bg-esk-lilac/10 md:pl-[104px] 3xl:pl-[120px]">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-3 px-[26px] py-[10px] md:px-10">
        <p className="flex items-center gap-2 font-sat text-[13px] text-esk-lilac">
          <Sparkles size={14} strokeWidth={1.8} aria-hidden className="shrink-0" />
          <span>
            <span className="font-medium whitespace-nowrap">
              <span className="sm:hidden">Modo </span>Demonstração
            </span>
            <span className="hidden sm:inline">: dados de exemplo, apagados quando você sai.</span>
          </span>
        </p>
        <div className="flex shrink-0 items-center gap-3">
          <button type="button" onClick={() => leave(false)} disabled={leaving} className="font-sat text-[13px] text-esk-subtle transition hover:text-white disabled:opacity-60">
            {leaving ? 'Saindo…' : 'Sair'}
          </button>
          <button
            type="button"
            onClick={() => leave(true)}
            disabled={leaving}
            className="rounded-full bg-esk-lilac px-3 py-[6px] font-sat text-[13px] font-medium text-esk-ink transition hover:brightness-105 active:scale-95"
          >
            <span className="sm:hidden">Criar conta</span>
            <span className="hidden sm:inline">Criar minha conta</span>
          </button>
        </div>
      </div>
    </div>
  )
}
