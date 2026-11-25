import type { Meta, StoryObj } from '@storybook/react-vite'
import { CategoryRowIcon, CategoryTileIcon, GoalIcon } from '../../components/icons'
import { CATEGORIES, CATEGORY_IDS } from '../../data/categories'
import type { Goal } from '../../types'

const meta = {
  title: 'Componentes/Ícones/Categorias e metas',
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          '`CategoryRowIcon` (claro, dentro do quadro `bg-row-icon` das linhas), `CategoryTileIcon` (escuro, sobre a cor da categoria `color/category/*`) e `GoalIcon` (metas). SVGs do design vêm de `public/assets`; os demais usam lucide-react.',
      },
    },
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const Label = ({ children }: { children: string }) => <span className="font-sat text-[12px] text-esk-muted">{children}</span>

export const Linha: Story = {
  name: 'CategoryRowIcon',
  render: () => (
    <div className="flex flex-wrap gap-6">
      {CATEGORY_IDS.map((id) => (
        <div key={id} className="flex flex-col items-center gap-2">
          <span className="grid size-[48px] place-items-center rounded-[24px] bg-esk-row">
            <CategoryRowIcon category={id} />
          </span>
          <Label>{CATEGORIES[id].label}</Label>
        </div>
      ))}
      <div className="flex flex-col items-center gap-2">
        <span className="grid size-[48px] place-items-center rounded-[24px] bg-esk-row">
          <CategoryRowIcon category="alimentacao" name="Restaurante" />
        </span>
        <Label>Restaurante</Label>
      </div>
    </div>
  ),
}

export const Tile: Story = {
  name: 'CategoryTileIcon',
  render: () => (
    <div className="flex flex-wrap gap-4">
      {CATEGORY_IDS.map((id) => (
        <div key={id} className="flex flex-col items-center gap-2">
          <span className="grid size-[64px] place-items-center rounded-[22px]" style={{ background: CATEGORIES[id].color }}>
            <CategoryTileIcon category={id} />
          </span>
          <Label>{CATEGORIES[id].label}</Label>
        </div>
      ))}
    </div>
  ),
}

const goals: Goal['icon'][] = ['plane', 'shield', 'book', 'car', 'target', 'home']
export const Metas: Story = {
  name: 'GoalIcon',
  render: () => (
    <div className="flex flex-wrap gap-6">
      {goals.map((g) => (
        <div key={g} className="flex flex-col items-center gap-2">
          <span className="grid size-[48px] place-items-center rounded-[24px] bg-esk-row">
            <GoalIcon icon={g} />
          </span>
          <Label>{g}</Label>
        </div>
      ))}
    </div>
  ),
}
