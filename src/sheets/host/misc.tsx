/**
 * Outros: ajustar saldo e Okiva Plus.
 */
import { useState } from 'react'
import { FileText, MessageCircle, Sparkles } from 'lucide-react'
import { Field, MoneyInput, PrimaryButton, Sheet } from '../../components/ui'
import { balanceOf, useStore } from '../../state/store'
import { accountApi } from '../../services/finance'
import { useMutation } from '../../state/useMutation'
import { useUI, type View } from '../../state/ui'

export function BalanceSheet({ close }: { close: () => void }) {
  const { state, dispatch } = useStore()
  const { run, pending } = useMutation()
  const [value, setValue] = useState(balanceOf(state))
  return (
    <Sheet title="Ajustar saldo" onClose={close}>
      <form
        className="flex flex-col gap-5"
        onSubmit={async (e) => {
          e.preventDefault()
          if (await run('save', () => accountApi.setBalance(value), (r) => dispatch({ type: 'setBalance', value: r.balance }), 'Saldo ajustado')) close()
        }}
      >
        <Field label="Quanto você tem hoje" htmlFor="bal">
          <MoneyInput id="bal" value={value} onChange={setValue} large autoFocus allowNegative />
        </Field>
        <p className="font-sat text-[13px] text-esk-subtle">Os gastos que você registrar a partir de agora saem deste valor.</p>
        <PrimaryButton type="submit" loading={pending === 'save'}>
          Salvar saldo
        </PrimaryButton>
      </form>
    </Sheet>
  )
}

/* ------------------------------------------------------- Okiva Plus */

const PLUS_FEATURES = [
  { icon: <MessageCircle size={20} strokeWidth={1.8} />, title: 'Assistente com IA', text: 'Pergunte sobre gastos, cartões e metas. Ele responde com os seus números.' },
  { icon: <FileText size={20} strokeWidth={1.8} />, title: 'Leitura de fatura', text: 'Envie o PDF ou uma foto. A IA categoriza e você confirma.' },
  { icon: <Sparkles size={20} strokeWidth={1.8} />, title: 'Dicas para suas metas', text: 'Sugestões de onde economizar para chegar antes.' },
]

export function PlusSheet({ close, then }: { close: () => void; then?: View }) {
  const { dispatch } = useStore()
  const { navigate, notify } = useUI()
  return (
    <Sheet title="Okiva Plus" onClose={close}>
      <div className="relative overflow-hidden rounded-[26px] p-5 text-esk-ink" style={{ backgroundImage: 'var(--esk-gradient-insight)' }}>
        <p className="font-mono text-[11px] font-medium tracking-[1.1px]">ESTÁGIO 2</p>
        <p className="pt-2 font-sat text-[26px] leading-[1.1] font-medium tracking-[-0.8px]">Seu dinheiro com uma IA do seu lado.</p>
      </div>
      <ul className="mt-5 flex flex-col gap-4">
        {PLUS_FEATURES.map((f, i) => (
          <li key={f.title} className="flex animate-rise items-start gap-3" style={{ animationDelay: `${120 + i * 70}ms` }}>
            <span className="grid size-[40px] shrink-0 place-items-center rounded-[20px] bg-esk-elevated text-esk-lime">{f.icon}</span>
            <span className="flex flex-col">
              <span className="font-sat text-[15px] font-medium text-white">{f.title}</span>
              <span className="font-sat text-[13px] text-esk-muted">{f.text}</span>
            </span>
          </li>
        ))}
      </ul>
      <PrimaryButton
        className="mt-6"
        onClick={() => {
          dispatch({ type: 'setStage', stage: 2 })
          notify('Okiva Plus ativado')
          if (then) navigate(then)
          else close()
        }}
      >
        Ativar Okiva Plus
      </PrimaryButton>
      <p className="pt-3 text-center font-sat text-[12px] text-esk-subtle">Protótipo: ativação gratuita. Você pode desligar em Conta.</p>
    </Sheet>
  )
}

/* ------------------------------------------------------- Confirmação */

/* ------------------------------------------------- Depósitos de uma meta */
