import type { Preview } from '@storybook/react-vite'
import '../src/index.css'
import '../tokens/tokens.css'
import { UIProvider } from '../src/state/ui'

const preview: Preview = {
  parameters: {
    layout: 'centered',
    backgrounds: {
      options: {
        canvas: { name: 'bg-canvas', value: '#030303' },
        screen: { name: 'bg-screen', value: '#0a0a0c' },
        surface: { name: 'bg-surface', value: '#151518' },
        inverse: { name: 'bg-inverse', value: '#f1f1ee' },
      },
    },
    controls: { matchers: { color: /(background|color)$/i } },
    options: {
      storySort: { order: ['Introdução', 'Fundamentos', 'Componentes', ['Ações', 'Formulários', 'Feedback', 'Layout', 'Listas', 'Dados', 'Identidade', 'Ícones'], 'Telas'] },
    },
  },
  initialGlobals: { backgrounds: { value: 'canvas' } },
  // ScreenHeader, Sheet e ToastView leem o contexto de UI
  decorators: [
    (Story) => (
      <UIProvider>
        <div className="font-sat text-white">
          <Story />
        </div>
      </UIProvider>
    ),
  ],
}

export default preview
