import type { Meta, StoryObj } from '@storybook/react-vite'
import { Plus } from 'lucide-react'
import { fn } from 'storybook/test'
import { PrimaryButton } from '../../components/ui'

const primaryMeta = {
  title: 'Componentes/Ações/PrimaryButton',
  component: PrimaryButton,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Botão de ação principal (altura `size-button-height` 56px, raio `radius-button` 22px). Tons: `lime` (ação primária), `dark` (secundária) e `danger` (destrutiva). Em `loading` mostra o Spinner e bloqueia o clique.',
      },
    },
  },
  args: { children: 'Salvar gasto', tone: 'lime', loading: false, disabled: false, onClick: fn() },
  argTypes: {
    tone: { control: 'inline-radio', options: ['lime', 'dark', 'danger'] },
    loadingText: { control: 'text' },
  },
  decorators: [(Story) => <div className="w-[360px]"><Story /></div>],
} satisfies Meta<typeof PrimaryButton>

export default primaryMeta
type PrimaryStory = StoryObj<typeof primaryMeta>

export const Lime: PrimaryStory = {}
export const Dark: PrimaryStory = { args: { tone: 'dark', children: 'Cancelar' } }
export const Danger: PrimaryStory = { args: { tone: 'danger', children: 'Excluir gasto' } }
export const Loading: PrimaryStory = { args: { loading: true, loadingText: 'Salvando…' } }
export const Disabled: PrimaryStory = { args: { disabled: true } }
export const ComIcone: PrimaryStory = {
  name: 'Com ícone',
  args: { children: <><Plus size={18} strokeWidth={2} /> Novo gasto</> },
}
export const Todos: PrimaryStory = {
  name: 'Todos os tons',
  render: (args) => (
    <div className="flex flex-col gap-3">
      <PrimaryButton {...args} tone="lime">Lime</PrimaryButton>
      <PrimaryButton {...args} tone="dark">Dark</PrimaryButton>
      <PrimaryButton {...args} tone="danger">Danger</PrimaryButton>
      <PrimaryButton {...args} tone="lime" loading>Lime</PrimaryButton>
      <PrimaryButton {...args} tone="lime" disabled>Desabilitado</PrimaryButton>
    </div>
  ),
}
