import type { Meta, StoryObj } from '@storybook/react-vite'
import { FeatureCard, Kicker, ProgressBar, Ring } from '../../components/ui'

const meta = {
  title: 'Componentes/Layout/FeatureCard',
  component: FeatureCard,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Cartão de destaque com o gradiente feature (`gradient-feature-start` → `middle` → `end`), raio `radius-feature` 34px e altura mínima 238px. Conteúdo em `text-inverse`.',
      },
    },
  },
  args: { children: null },
  decorators: [(Story) => <div className="w-[380px]"><Story /></div>],
} satisfies Meta<typeof FeatureCard>

export default meta
type Story = StoryObj<typeof meta>

export const MetaPrincipal: Story = {
  name: 'Meta principal',
  render: () => (
    <FeatureCard>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Kicker className="text-esk-ink-2">Meta principal</Kicker>
          <p className="pt-2 font-sat text-[26px] font-medium tracking-[-0.8px]">Viagem para o Chile</p>
        </div>
        <Ring value={64} />
      </div>
      <div className="flex flex-col gap-2">
        <p className="font-sat text-[15px] font-medium">R$ 6.400 de R$ 10.000</p>
        <ProgressBar value={64} tone="ink" />
      </div>
    </FeatureCard>
  ),
}

export const Insight: Story = {
  render: () => (
    <FeatureCard>
      <Kicker className="text-esk-ink-2">Insight do mês</Kicker>
      <p className="font-sat text-[22px] font-medium leading-[1.25] tracking-[-0.54px]">
        Você gastou 18% menos com delivery que em outubro. Dá para guardar R$ 220 a mais.
      </p>
    </FeatureCard>
  ),
}
