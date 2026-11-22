import type { Meta, StoryObj } from '@storybook/react-vite'
import { Plus } from 'lucide-react'
import { RoundButton, ScreenHeader } from '../../components/ui'

const meta = {
  title: 'Componentes/Layout/ScreenHeader',
  component: ScreenHeader,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Linha de título das telas internas: voltar + título (`heading-screen` 29px → 36px ≥800px → 42px ≥1920px) + uma ação opcional. O voltar chama `useUI().back()`.',
      },
    },
  },
  args: { title: 'Cartões' },
  decorators: [(Story) => <div className="w-full max-w-[720px]"><Story /></div>],
} satisfies Meta<typeof ScreenHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Padrao: Story = { name: 'Padrão' }
export const ComAcao: Story = {
  name: 'Com ação',
  args: { title: 'Metas', action: <RoundButton label="Nova meta"><Plus size={19} strokeWidth={1.8} /></RoundButton> },
}
export const TituloLongo: Story = { name: 'Título longo (trunca)', args: { title: 'Fatura do cartão de crédito de novembro' } }
