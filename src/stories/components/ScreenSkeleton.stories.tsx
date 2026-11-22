import type { Meta, StoryObj } from '@storybook/react-vite'
import { ScreenSkeleton } from '../../components/ui'

const meta = {
  title: 'Componentes/Feedback/ScreenSkeleton',
  component: ScreenSkeleton,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: { component: 'Placeholder enquanto uma tela carregada sob demanda baixa. Usa `bg-skeleton` → `bg-skeleton-highlight` com `animate-shimmer`.' },
      story: { inline: false, iframeHeight: 520 },
    },
  },
} satisfies Meta<typeof ScreenSkeleton>

export default meta
type Story = StoryObj<typeof meta>

export const Padrao: Story = { name: 'Padrão' }
