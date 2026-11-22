import type { Meta, StoryObj } from '@storybook/react-vite'
import { Kicker } from '../../components/ui'

const meta = {
  title: 'Componentes/Layout/Kicker',
  component: Kicker,
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: 'Rótulo monoespaçado em caixa alta (papel `kicker`: IBM Plex Mono 11px, tracking 1.1px). A cor vem de `className`.' } },
  },
  args: { children: 'Saldo disponível', className: 'text-esk-muted' },
} satisfies Meta<typeof Kicker>

export default meta
type Story = StoryObj<typeof meta>

export const Padrao: Story = { name: 'Padrão' }
export const Acento: Story = { args: { className: 'text-esk-lime' } }
export const SobreFundoClaro: Story = {
  name: 'Sobre fundo claro',
  args: { className: 'text-esk-ink' },
  globals: { backgrounds: { value: 'inverse' } },
}
