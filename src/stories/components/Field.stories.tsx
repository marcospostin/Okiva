import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Field, inputClass, MoneyInput, PrimaryButton } from '../../components/ui'

const meta = {
  title: 'Componentes/Formulários/Field',
  component: Field,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Rótulo + controle + mensagem de erro. Com `error` o rótulo e o ring do controle ficam `text-error` / `border-error` e o campo treme; `attempt` (contador de envios) repete o tremor a cada tentativa. Use com `inputClass` para inputs de texto.',
      },
    },
  },
  args: { label: 'Descrição', htmlFor: 'desc', children: null },
  decorators: [(Story) => <div className="w-[360px]"><Story /></div>],
} satisfies Meta<typeof Field>

export default meta
type Story = StoryObj<typeof meta>

export const Texto: Story = {
  render: (args) => (
    <Field {...args}>
      <input id="desc" className={inputClass} placeholder="Ex.: Mercado" />
    </Field>
  ),
}

export const ComErro: Story = {
  name: 'Com erro',
  args: { error: 'Informe uma descrição.' },
  render: (args) => (
    <Field {...args}>
      <input id="desc" className={inputClass} placeholder="Ex.: Mercado" />
    </Field>
  ),
}

export const Data: Story = {
  args: { label: 'Data', htmlFor: 'date' },
  render: (args) => (
    <Field {...args}>
      <input id="date" type="date" className={inputClass} defaultValue="2026-11-21" />
    </Field>
  ),
}

export const ValidacaoInterativa: Story = {
  name: 'Validação (interativo)',
  render: () => {
    const [value, setValue] = useState('')
    const [attempt, setAttempt] = useState(0)
    const [error, setError] = useState<string>()
    return (
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          setAttempt((a) => a + 1)
          setError(value.trim() ? undefined : 'Informe uma descrição.')
        }}
      >
        <Field label="Descrição" htmlFor="desc-i" error={error} attempt={attempt}>
          <input id="desc-i" className={inputClass} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Envie vazio para ver o erro" />
        </Field>
        <PrimaryButton type="submit">Salvar</PrimaryButton>
      </form>
    )
  },
}

export const ComMoneyInput: Story = {
  name: 'Com MoneyInput',
  args: { label: 'Valor', htmlFor: 'money' },
  render: (args) => {
    const [v, setV] = useState(1234.5)
    return (
      <Field {...args}>
        <MoneyInput id="money" value={v} onChange={setV} />
      </Field>
    )
  },
}
