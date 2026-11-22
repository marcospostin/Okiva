import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { MoneyInput } from '../../components/ui'

const meta = {
  title: 'Componentes/Formulários/MoneyInput',
  component: MoneyInput,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Campo de dinheiro que digita os centavos da direita para a esquerda (1 → 0,01 → 0,12 → 1,23). `large` usa o papel `display-money` (42px). Foco: ring `border-focus`.',
      },
    },
  },
  args: { value: 0, onChange: () => {}, large: false },
  decorators: [(Story) => <div className="w-[360px]"><Story /></div>],
  render: (args) => {
    const [v, setV] = useState(args.value)
    return <MoneyInput {...args} value={v} onChange={setV} />
  },
} satisfies Meta<typeof MoneyInput>

export default meta
type Story = StoryObj<typeof meta>

export const Padrao: Story = { name: 'Padrão', args: { value: 89.9 } }
export const Grande: Story = { args: { value: 500, large: true } }
export const Vazio: Story = { args: { value: 0 } }
