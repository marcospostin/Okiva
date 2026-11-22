import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect } from 'react'
import { PrimaryButton, ToastView } from '../../components/ui'
import { useUI, type ToastTone } from '../../state/ui'

function ToastDemo({ tone, message }: { tone: ToastTone; message: string }) {
  const { notify } = useUI()
  useEffect(() => {
    notify(message, tone)
  }, [notify, message, tone])
  return (
    <div className="flex h-[260px] w-[420px] items-start">
      <PrimaryButton tone="dark" onClick={() => notify(message, tone)}>
        Mostrar de novo
      </PrimaryButton>
      <ToastView />
    </div>
  )
}

const meta = {
  title: 'Componentes/Feedback/Toast',
  component: ToastDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          '`ToastView` exibe o toast do contexto de UI; dispare com `useUI().notify(mensagem, tom)`. Superfície `bg-inverse`, sombra `shadow-elevated`, ícone `feedback-success` / `feedback-error` / `feedback-info`. Some sozinho após 2,8s (erro: 4s). Erros usam `role="alert"`.',
      },
      story: { inline: false, iframeHeight: 320 },
    },
  },
  args: { tone: 'success', message: 'Gasto salvo' },
  argTypes: { tone: { control: 'inline-radio', options: ['success', 'error', 'info'] } },
} satisfies Meta<typeof ToastDemo>

export default meta
type Story = StoryObj<typeof meta>

export const Sucesso: Story = {}
export const Erro: Story = { args: { tone: 'error', message: 'Não foi possível salvar. Tente de novo.' } }
export const Info: Story = { args: { tone: 'info', message: 'Valores escondidos' } }
