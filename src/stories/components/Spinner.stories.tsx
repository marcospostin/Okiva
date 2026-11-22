import type { Meta, StoryObj } from '@storybook/react-vite'
import { Spinner } from '../../components/ui'

const meta = {
  title: 'Componentes/Feedback/Spinner',
  component: Spinner,
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: 'Indicador de carregamento (`size-spinner` 16px, traço `border-width-strong`). Herda a cor do texto (`currentColor`).' } },
  },
} satisfies Meta<typeof Spinner>

export default meta
type Story = StoryObj<typeof meta>

export const Padrao: Story = { name: 'Padrão' }
export const Cores: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Spinner />
      <Spinner className="text-esk-lime" />
      <Spinner className="text-esk-lilac" />
      <Spinner className="size-[28px] text-esk-muted" />
    </div>
  ),
}
