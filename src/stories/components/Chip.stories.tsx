import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { fn } from 'storybook/test'
import { Chip } from '../../components/ui'

const meta = {
  title: 'Componentes/Ações/Chip',
  component: Chip,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Seleção em pílula (`size-chip-height` 40px, `radius-chip`). Ativo: `bg-brand-primary` + brilho `shadow-glow-brand`. Inativo: `bg-elevated` com ring `border-strong`. Expõe `aria-pressed`.',
      },
    },
  },
  args: { active: false, children: 'Alimentação', onClick: fn() },
} satisfies Meta<typeof Chip>

export default meta
type Story = StoryObj<typeof meta>

export const Inativo: Story = {}
export const Ativo: Story = { args: { active: true } }

const options = ['Moradia', 'Alimentação', 'Transporte', 'Lazer', 'Saúde']
export const Grupo: Story = {
  name: 'Grupo interativo',
  render: () => {
    const [value, setValue] = useState('Alimentação')
    return (
      <div className="flex max-w-[420px] flex-wrap gap-2">
        {options.map((o) => (
          <Chip key={o} active={value === o} onClick={() => setValue(o)}>
            {o}
          </Chip>
        ))}
      </div>
    )
  },
}
