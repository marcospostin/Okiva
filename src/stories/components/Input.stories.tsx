import type { Meta, StoryObj } from '@storybook/react-vite'
import { inputClass } from '../../components/ui'

/** `inputClass` não é um componente: é a classe compartilhada pelos inputs de texto. */
const meta = {
  title: 'Componentes/Formulários/Input (inputClass)',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '`inputClass` é a classe base dos inputs de texto: altura `size-input-height` 52px, raio `radius-input` 18px, fundo `bg-elevated`, ring `border-strong` e `border-focus` no foco, placeholder `text-subtle`.\n\n```tsx\n<input className={inputClass} />\n```',
      },
    },
  },
  args: { placeholder: 'Ex.: Mercado', disabled: false, type: 'text' },
  argTypes: { type: { control: 'inline-radio', options: ['text', 'email', 'password', 'date'] } },
  render: (args) => <input className={inputClass} {...args} />,
  decorators: [(Story) => <div className="w-[360px]"><Story /></div>],
} satisfies Meta<{ placeholder: string; disabled: boolean; type: string }>

export default meta
type Story = StoryObj<typeof meta>

export const Texto: Story = {}
export const Email: Story = { args: { type: 'email', placeholder: 'voce@email.com' } }
export const Senha: Story = { args: { type: 'password', placeholder: '••••••••' } }
export const Desabilitado: Story = { args: { disabled: true } }
