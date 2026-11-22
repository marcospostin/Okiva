import type { Meta, StoryObj } from '@storybook/react-vite'
import { Page, ScreenHeader, SectionHeader } from '../../components/ui'

const meta = {
  title: 'Componentes/Layout/Page',
  component: Page,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Container de página: largura máxima 1280px (1680px ≥1920px), margens `page-gutter` 26px (ou `page-gutter-wide` 32px com `wide`), 40px ≥800px, 56px ≥1100px e 64px ≥1920px.',
      },
    },
  },
  args: { wide: false, children: null },
} satisfies Meta<typeof Page>

export default meta
type Story = StoryObj<typeof meta>

const Content = () => (
  <>
    <ScreenHeader title="Metas" />
    <div className="flex flex-col gap-4 pt-6">
      <SectionHeader title="Seção" />
      <div className="h-[160px] rounded-[26px] bg-esk-surface" />
      <div className="h-[160px] rounded-[26px] bg-esk-surface" />
    </div>
  </>
)

export const Padrao: Story = { name: 'Padrão', render: (args) => <div className="bg-esk-bg-2"><Page {...args}><Content /></Page></div> }
export const Larga: Story = { args: { wide: true }, render: (args) => <div className="bg-esk-bg-2"><Page {...args}><Content /></Page></div> }
