import type { Meta, StoryObj } from '@storybook/react-vite'
import { LinkButton, SectionHeader } from '../../components/ui'

const meta = {
  title: 'Componentes/Layout/SectionHeader',
  component: SectionHeader,
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: 'Título de seção (`heading-section` 21px) com ação opcional à direita, alinhados pela base.' } },
  },
  args: { title: 'Últimos gastos' },
  decorators: [(Story) => <div className="w-[420px]"><Story /></div>],
} satisfies Meta<typeof SectionHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Padrao: Story = { name: 'Padrão' }
export const ComLink: Story = { name: 'Com link', args: { action: <LinkButton>Ver tudo</LinkButton> } }
