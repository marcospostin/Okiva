import type { Meta, StoryObj } from '@storybook/react-vite'
import { LinkButton, PrimaryButton, EmptyState } from '../../components/ui'

const meta = {
  title: 'Componentes/Feedback/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: 'Estado vazio com borda tracejada `border-strong` e raio `radius-tile`. Aceita uma ação opcional.' } },
  },
  args: { title: 'Nenhum gasto ainda', text: 'Registre o primeiro gasto do mês para ver para onde vai o seu dinheiro.' },
  decorators: [(Story) => <div className="w-[400px]"><Story /></div>],
} satisfies Meta<typeof EmptyState>

export default meta
type Story = StoryObj<typeof meta>

export const Padrao: Story = { name: 'Padrão' }
export const ComLink: Story = { name: 'Com link', args: { action: <LinkButton>Adicionar gasto</LinkButton> } }
export const ComBotao: Story = {
  name: 'Com botão',
  args: { action: <div className="w-full pt-2"><PrimaryButton>Adicionar gasto</PrimaryButton></div> },
}
