import type { StorybookConfig } from '@storybook/react-vite'
import type { PluginOption } from 'vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs'],
  framework: { name: '@storybook/react-vite', options: {} },
  // /assets/* (avatar, ícones de categoria) vêm de public/
  staticDirs: ['../public'],
  core: { disableTelemetry: true },
  async viteFinal(config) {
    // Os plugins do Figma Make (servidor, overlay, kit) não fazem sentido dentro do Storybook.
    const keep = (p: PluginOption): boolean => {
      if (!p || typeof p !== 'object' || Array.isArray(p) || !('name' in p)) return true
      return !String(p.name).startsWith('figma-')
    }
    const flat = (list: PluginOption[]): PluginOption[] => list.flatMap((p) => (Array.isArray(p) ? flat(p) : [p]))
    config.plugins = flat(config.plugins ?? []).filter(keep)
    return config
  },
}

export default config
