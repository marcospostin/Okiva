import type { Meta, StoryObj } from '@storybook/react-vite'
import App from '../App'

/** O app inteiro (já traz seus próprios providers), para ver os componentes em contexto. */
const meta = {
  title: 'Telas/Aplicativo',
  component: App,
  parameters: {
    layout: 'fullscreen',
    docs: { story: { inline: false, iframeHeight: 820 } },
  },
  // O App monta o próprio UIProvider; o decorator global é inofensivo aqui.
} satisfies Meta<typeof App>

export default meta
type Story = StoryObj<typeof meta>

export const Completo: Story = { name: 'App completo' }
export const Mobile: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } }
