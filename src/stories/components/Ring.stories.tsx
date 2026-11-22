import type { Meta, StoryObj } from '@storybook/react-vite'
import { Ring } from '../../components/ui'

const meta = {
  title: 'Componentes/Dados/Ring',
  component: Ring,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Anel de meta (`size-ring` 104px, traço `ring-stroke` 11px). Desenhado para ficar sobre fundos claros (FeatureCard): trilho `bg-track-inverse`, arco e número (`heading-metric`) em `text-inverse`. O arco e o número animam ao entrar.',
      },
    },
  },
  args: { value: 64, size: 104 },
  argTypes: { value: { control: { type: 'range', min: 0, max: 100, step: 1 } } },
  globals: { backgrounds: { value: 'inverse' } },
} satisfies Meta<typeof Ring>

export default meta
type Story = StoryObj<typeof meta>

export const Padrao: Story = { name: 'Padrão' }
export const Completo: Story = { args: { value: 100 } }
export const Escala: Story = {
  render: () => (
    <div className="flex gap-4">
      {[10, 40, 75, 100].map((v) => (
        <Ring key={v} value={v} />
      ))}
    </div>
  ),
}
