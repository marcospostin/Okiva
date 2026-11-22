import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { CountUp, PrimaryButton } from '../../components/ui'
import { brl } from '../../lib/format'

const meta = {
  title: 'Componentes/Dados/CountUp',
  component: CountUp,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Valor que rola do número anterior até o novo (easeOutCubic, `duration-count-up` 650ms). `format` mantém a formatação da tela (ex.: `brl`). Respeita `prefers-reduced-motion`.',
      },
    },
  },
  args: { value: 4820.5, format: brl },
  render: (args) => {
    const [value, setValue] = useState(args.value)
    return (
      <div className="flex w-[320px] flex-col gap-4">
        <span className="font-sat text-[42px] font-medium tracking-[-1.7px] tabular-nums">
          <CountUp value={value} format={args.format} />
        </span>
        <PrimaryButton tone="dark" onClick={() => setValue(Math.round(Math.random() * 1000000) / 100)}>
          Sortear novo valor
        </PrimaryButton>
      </div>
    )
  },
} satisfies Meta<typeof CountUp>

export default meta
type Story = StoryObj<typeof meta>

export const Padrao: Story = { name: 'Padrão' }
