import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { LinkButton } from '../../components/ui'

const meta = {
  title: 'Componentes/Ações/LinkButton',
  component: LinkButton,
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: 'Ação em texto (`text-link`, `body-xs`). Usado em cabeçalhos de seção, como "Ver tudo".' } },
  },
  args: { children: 'Ver tudo', onClick: fn() },
} satisfies Meta<typeof LinkButton>

export default meta
type Story = StoryObj<typeof meta>

export const Padrao: Story = { name: 'Padrão' }
