import type { Meta, StoryObj } from '@storybook/react-vite'
import { FileUp, PiggyBank } from 'lucide-react'
import { fn } from 'storybook/test'
import { ActionRow } from '../../components/ui'

const meta = {
  title: 'Componentes/Ações/ActionRow',
  component: ActionRow,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Quadrado lime (`size-action-tile` 84px, `bg-brand-primary-soft`) + rótulo em `bg-elevated`. Usado para "Guardar R$ 500" e "Enviar outro PDF".',
      },
    },
  },
  args: { label: 'Guardar R$ 500', icon: <PiggyBank size={26} strokeWidth={1.6} className="text-esk-ink" />, onClick: fn(), disabled: false },
  decorators: [(Story) => <div className="w-[380px]"><Story /></div>],
} satisfies Meta<typeof ActionRow>

export default meta
type Story = StoryObj<typeof meta>

export const Padrao: Story = { name: 'Padrão' }
export const EnviarPdf: Story = {
  name: 'Enviar PDF',
  args: { label: 'Enviar outro PDF', icon: <FileUp size={26} strokeWidth={1.6} className="text-esk-ink" /> },
}
export const Desabilitado: Story = { args: { disabled: true } }
