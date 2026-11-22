import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Chip, Field, inputClass, MoneyInput, PrimaryButton, Sheet } from '../../components/ui'

function SheetDemo({ title, startOpen }: { title: string; startOpen: boolean }) {
  const [open, setOpen] = useState(startOpen)
  const [value, setValue] = useState(42.9)
  const [cat, setCat] = useState('Alimentação')
  return (
    <div className="flex h-[640px] w-full items-start justify-center pt-6">
      <div className="w-[280px]">
        <PrimaryButton onClick={() => setOpen(true)}>Abrir sheet</PrimaryButton>
      </div>
      {open && (
        <Sheet title={title} onClose={() => setOpen(false)}>
          <div className="flex flex-col gap-5">
            <Field label="Valor" htmlFor="sheet-value">
              <MoneyInput id="sheet-value" value={value} onChange={setValue} large />
            </Field>
            <Field label="Descrição" htmlFor="sheet-desc">
              <input id="sheet-desc" className={inputClass} placeholder="Ex.: Mercado" />
            </Field>
            <div className="flex flex-wrap gap-2">
              {['Moradia', 'Alimentação', 'Lazer'].map((c) => (
                <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
                  {c}
                </Chip>
              ))}
            </div>
            <PrimaryButton onClick={() => setOpen(false)}>Salvar gasto</PrimaryButton>
          </div>
        </Sheet>
      )}
    </div>
  )
}

const meta = {
  title: 'Componentes/Feedback/Sheet',
  component: SheetDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Painel modal: bottom sheet no mobile e diálogo centralizado a partir de 800px. Fundo `bg-surface`, raio `radius-panel`, véu `bg-overlay` com `backdrop-blur-overlay`. Fecha com Esc, clique no véu ou no botão. Prende o foco e trava o scroll do body enquanto aberto.',
      },
      story: { inline: false, iframeHeight: 680 },
    },
  },
  args: { title: 'Novo gasto', startOpen: true },
} satisfies Meta<typeof SheetDemo>

export default meta
type Story = StoryObj<typeof meta>

export const Aberto: Story = {}
export const Mobile: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } }
