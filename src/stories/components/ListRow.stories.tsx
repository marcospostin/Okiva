import type { Meta, StoryObj } from '@storybook/react-vite'
import { ChevronRight } from 'lucide-react'
import { fn } from 'storybook/test'
import { CategoryRowIcon } from '../../components/icons'
import { ListPanel, ListRow } from '../../components/ui'

const meta = {
  title: 'Componentes/Listas/ListRow',
  component: ListRow,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Linha de lista: ícone em quadro `bg-row-icon` (48px), título `body-md`, subtítulo `caption` em `text-subtle`, nota opcional que quebra linha e valor à direita. Com `onClick` vira botão com hover `bg-hover-subtle`. Com `index` entra em sequência (`animate-rise`).',
      },
    },
  },
  args: {
    icon: <CategoryRowIcon category="alimentacao" />,
    title: 'Mercado Pão de Açúcar',
    subtitle: 'Hoje · Cartão Nubank',
    value: '− R$ 182,40',
  },
  decorators: [(Story) => <div className="w-[400px]"><Story /></div>],
} satisfies Meta<typeof ListRow>

export default meta
type Story = StoryObj<typeof meta>

export const Padrao: Story = { name: 'Padrão' }
export const Clicavel: Story = { name: 'Clicável', args: { onClick: fn(), trailing: <ChevronRight size={18} className="text-esk-subtle" /> } }
export const ComNota: Story = {
  name: 'Com nota',
  args: { note: 'Parcela 3 de 10. A última cai em junho de 2027.', icon: <CategoryRowIcon category="moradia" />, title: 'Sofá', value: '− R$ 299,00' },
}

const rows = [
  { category: 'alimentacao', title: 'iFood', subtitle: 'Hoje · Pix', value: '− R$ 48,90' },
  { category: 'transporte', title: 'Uber', subtitle: 'Ontem · Cartão', value: '− R$ 23,10' },
  { category: 'moradia', title: 'Aluguel', subtitle: '5 nov · Boleto', value: '− R$ 2.100,00' },
  { category: 'assinaturas', title: 'Spotify', subtitle: '3 nov · Cartão', value: '− R$ 21,90' },
  { category: 'lazer', title: 'Cinema', subtitle: '1 nov · Cartão', value: '− R$ 64,00' },
  { category: 'saude', title: 'Farmácia', subtitle: '30 out · Pix', value: '− R$ 37,50' },
] as const

export const EmPainel: Story = {
  name: 'Lista em ListPanel',
  render: () => (
    <ListPanel>
      {rows.map((r, i) => (
        <ListRow key={r.title} index={i} icon={<CategoryRowIcon category={r.category} name={r.title} />} title={r.title} subtitle={r.subtitle} value={r.value} onClick={() => {}} />
      ))}
    </ListPanel>
  ),
}
