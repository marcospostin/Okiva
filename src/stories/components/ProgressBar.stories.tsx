import type { Meta, StoryObj } from '@storybook/react-vite'
import { ProgressBar } from '../../components/ui'

const meta = {
  title: 'Componentes/Dados/ProgressBar',
  component: ProgressBar,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Barra de progresso (8px, `radius-progress`) que se preenche ao entrar na tela (`duration-slow`, `easing-standard`). `lime`: trilho `bg-track-subtle` + barra `bg-brand-primary-soft`. `ink`: para fundos claros, trilho `bg-track-inverse` + barra `bg-ink`.',
      },
    },
  },
  args: { value: 62, tone: 'lime' },
  argTypes: { value: { control: { type: 'range', min: 0, max: 100, step: 1 } }, tone: { control: 'inline-radio', options: ['lime', 'ink'] } },
  decorators: [(Story) => <div className="w-[360px]"><Story /></div>],
} satisfies Meta<typeof ProgressBar>

export default meta
type Story = StoryObj<typeof meta>

export const Lime: Story = {}
export const Ink: Story = { args: { tone: 'ink' }, globals: { backgrounds: { value: 'inverse' } } }
export const Escala: Story = {
  render: (args) => (
    <div className="flex flex-col gap-4">
      {[0, 25, 50, 75, 100].map((v) => (
        <ProgressBar key={v} {...args} value={v} />
      ))}
    </div>
  ),
}
