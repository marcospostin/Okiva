import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Switch } from '../../components/ui'

const meta = {
  title: 'Componentes/Formulários/Switch',
  component: Switch,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Liga/desliga com `role="switch"` (`switch-width` 52 × `switch-height` 30, bolinha `switch-thumb` 24). Ligado: trilho `bg-brand-primary` e bolinha `bg-ink`; desligado: trilho `bg-track`. Curva `easing-spring`.',
      },
    },
  },
  args: { checked: false, label: 'Esconder valores', onChange: () => {} },
  render: (args) => {
    const [on, setOn] = useState(args.checked)
    return (
      <label className="flex items-center gap-3 font-sat text-[15px]">
        <Switch {...args} checked={on} onChange={setOn} />
        {args.label}
      </label>
    )
  },
} satisfies Meta<typeof Switch>

export default meta
type Story = StoryObj<typeof meta>

export const Desligado: Story = {}
export const Ligado: Story = { args: { checked: true } }
