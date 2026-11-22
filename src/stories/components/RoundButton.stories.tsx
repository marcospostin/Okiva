import type { Meta, StoryObj } from '@storybook/react-vite'
import { ArrowLeft, Bell, Plus, X } from 'lucide-react'
import { fn } from 'storybook/test'
import { RoundButton } from '../../components/ui'

const meta = {
  title: 'Componentes/Ações/RoundButton',
  component: RoundButton,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Botão circular só com ícone (`size-control` 44px, fundo `bg-control`, hover `bg-control-hover`). `label` vira `aria-label` e `title` — obrigatório para acessibilidade.',
      },
    },
  },
  args: { label: 'Voltar', children: <ArrowLeft size={19} strokeWidth={1.6} />, onClick: fn() },
} satisfies Meta<typeof RoundButton>

export default meta
type Story = StoryObj<typeof meta>

export const Padrao: Story = { name: 'Padrão' }
export const Pequeno: Story = {
  args: { label: 'Fechar', className: 'size-[38px] rounded-[19px]', children: <X size={17} strokeWidth={1.7} /> },
}
export const Variacoes: Story = {
  name: 'Ícones',
  render: (args) => (
    <div className="flex gap-3">
      <RoundButton {...args} label="Voltar"><ArrowLeft size={19} strokeWidth={1.6} /></RoundButton>
      <RoundButton {...args} label="Adicionar"><Plus size={19} strokeWidth={1.8} /></RoundButton>
      <RoundButton {...args} label="Notificações"><Bell size={18} strokeWidth={1.8} /></RoundButton>
      <RoundButton {...args} label="Fechar" className="size-[38px] rounded-[19px]"><X size={17} strokeWidth={1.7} /></RoundButton>
    </div>
  ),
}
