import type { Meta, StoryObj } from '@storybook/react-vite'
import { Avatar } from '../../components/ui'

const meta = {
  title: 'Componentes/Identidade/Avatar',
  component: Avatar,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Foto do usuário. Conta demo (ou sem usuário) mostra a foto do design; contas novas sem foto mostram as iniciais em `bg-brand-secondary` com `text-inverse`. Tamanho padrão `size-control` 44px.',
      },
    },
  },
  args: { user: { name: 'Marina Duarte', email: 'marina@exemplo.com' }, size: 44 },
  argTypes: { size: { control: { type: 'range', min: 24, max: 120, step: 4 } } },
} satisfies Meta<typeof Avatar>

export default meta
type Story = StoryObj<typeof meta>

export const Iniciais: Story = {}
export const ContaDemo: Story = { name: 'Conta demo', args: { user: null } }
export const Tamanhos: Story = {
  render: (args) => (
    <div className="flex items-end gap-3">
      {[32, 44, 56, 80].map((s) => (
        <Avatar key={s} {...args} size={s} />
      ))}
    </div>
  ),
}
