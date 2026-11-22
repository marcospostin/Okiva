import type { Meta, StoryObj } from '@storybook/react-vite'
import { CategoryRowIcon } from '../../components/icons'
import { ListPanel, ListRow } from '../../components/ui'

const meta = {
  title: 'Componentes/Listas/ListPanel',
  component: ListPanel,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Painel das listas: `bg-surface`, topo `radius-panel` 32px e base `radius-panel-bottom` 40px. No mobile sangra 14px para cada lado (`offset-panel-bleed`) para alinhar o ícone com a margem da página.',
      },
    },
  },
  args: { children: null },
  decorators: [(Story) => <div className="w-[400px] px-[14px]"><Story /></div>],
} satisfies Meta<typeof ListPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Padrao: Story = {
  name: 'Padrão',
  render: (args) => (
    <ListPanel {...args}>
      <ListRow icon={<CategoryRowIcon category="alimentacao" />} title="Mercado" subtitle="Hoje" value="− R$ 182,40" />
      <ListRow icon={<CategoryRowIcon category="transporte" />} title="Uber" subtitle="Ontem" value="− R$ 23,10" />
      <ListRow icon={<CategoryRowIcon category="outros" />} title="Presente" subtitle="2 nov" value="− R$ 90,00" />
    </ListPanel>
  ),
}
