/**
 * Fonte única dos design tokens do Okiva.
 *
 * Tudo nasce aqui: o script `scripts/build-tokens.mjs` gera a partir deste arquivo
 *   - tokens/tokens.json      (consumido pelo script do Figma)
 *   - tokens/tokens.css       (CSS custom properties, usado pelo Storybook)
 *   - docs/design-tokens.md   (documentação)
 *
 * Convenção de nomes: kebab-case. No Figma o "/" cria a pasta
 * (ex.: `color/neutral-920`); no CSS vira `--color-neutral-920`.
 *
 * Tipos: color | number | string
 * Valores derivados do código atual (src/index.css, src/components/ui.tsx e telas).
 */

/* ------------------------------------------------------------------ */
/* PRIMITIVOS                                                          */
/* ------------------------------------------------------------------ */

const neutral = {
  'neutral-0': '#ffffff',
  'neutral-50': '#f2f2f2',
  'neutral-400': '#9a9a9a',
  'neutral-500': '#8f8f96',
  'neutral-550': '#85858a',
  'neutral-700': '#333333',
  'neutral-750': '#2a2a2f',
  'neutral-800': '#26262a',
  'neutral-820': '#242428',
  'neutral-840': '#232327',
  'neutral-860': '#1f1f23',
  'neutral-880': '#1c1c1f',
  'neutral-885': '#1c1c1c',
  'neutral-890': '#1a1a1d',
  'neutral-900': '#18181b',
  'neutral-920': '#151518',
  'neutral-950': '#0a0a0c',
  'neutral-960': '#0a0a0a',
  'neutral-990': '#030303',
  'neutral-1000': '#000000',
}

const brand = {
  'sand-100': '#f1f1ee',
  'lime-100': '#eafebd',
  'lime-200': '#e5ffb5',
  'lilac-100': '#d8ccfa',
  'lilac-150': '#d6ccf7',
  'lilac-300': '#bbaaf8',
  'lilac-400': '#bfa9fe',
  'mauve-200': '#c9c3dc',
  'sage-200': '#d6e6c4',
}

// rgba: [r, g, b, alpha 0-1]
const alpha = {
  'white-alpha-3': [255, 255, 255, 0.03],
  'white-alpha-5': [255, 255, 255, 0.05],
  'black-alpha-5': [0, 0, 0, 0.05],
  'black-alpha-25': [0, 0, 0, 0.25],
  'black-alpha-50': [0, 0, 0, 0.5],
  'black-alpha-70': [0, 0, 0, 0.7],
  'ink-alpha-14': [10, 10, 10, 0.14],
  'lime-alpha-12': [229, 255, 181, 0.12],
  'lime-alpha-18': [229, 255, 181, 0.18],
}

const spaceValues = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 18, 19, 20, 22, 24, 26, 28, 32, 40, 42, 48, 56, 64, 70, 96]
const negativeSpaceValues = [1, 2, 4, 6, 8, 12, 14, 16, 18, 24, 32, 180]
const radiusValues = [0, 2, 3, 4, 5, 6, 7, 8, 10, 12, 16, 18, 19, 20, 22, 24, 26, 30, 32, 33, 34, 40]
const fontSizeValues = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 26, 28, 29, 34, 36, 38, 40, 42, 43, 44, 46, 56, 66]
const lineHeightPx = [21, 22.1, 34, 36, 38, 40, 46]
const lineHeightRatio = [1, 1.05, 1.1, 1.15, 1.2, 1.25, 1.3, 1.35, 1.4]
const letterSpacingValues = [-3, -2.4, -2.07, -1.9, -1.8, -1.72, -1.71, -1.7, -1.6, -1.44, -1.4, -1.36, -1.3, -1.015, -1, -0.8, -0.66, -0.6, -0.54, -0.5, -0.42, -0.24, -0.2, 0, 0.6, 0.8, 1.1]
const strokeValues = [0, 1, 1.5, 1.6, 1.7, 1.8, 2, 2.2, 2.4, 11]
const sizeValues = [5, 7, 10, 16, 22, 24, 26, 28, 30, 32, 36, 38, 40, 44, 48, 52, 56, 76, 84, 104, 238]
const opacityValues = [0, 3, 5, 14, 35, 40, 50, 60, 100]
const durationValues = [180, 200, 220, 260, 300, 340, 360, 380, 420, 560, 650, 700, 900, 1000, 1200, 1400, 2400]
const blurValues = [0, 2, 16, 24, 40]

/** 1.015 -> "1-015", -2.4 -> "negative-2-4" */
const slug = (n) => (n < 0 ? 'negative-' : '') + String(Math.abs(n)).replace('.', '-')

const fromList = (group, prefix, list, desc, unit = 'px') =>
  list.map((v) => ({ name: `${group}/${prefix}-${slug(v)}`, type: 'number', value: v, unit, description: desc }))

export const primitives = [
  // cores
  ...Object.entries(neutral).map(([k, v]) => ({ name: `color/${k}`, type: 'color', value: v, description: 'Escala neutra (cinzas do tema escuro)' })),
  ...Object.entries(brand).map(([k, v]) => ({ name: `color/${k}`, type: 'color', value: v, description: 'Cor de marca / categoria' })),
  ...Object.entries(alpha).map(([k, v]) => ({ name: `color/${k}`, type: 'color', value: v, description: 'Cor com transparência' })),

  // espaçamento (gaps, paddings, margens)
  ...fromList('space', 'space', spaceValues, 'Espaçamento positivo (gap, padding, margin)'),
  ...negativeSpaceValues.map((v) => ({
    name: `space/space-negative-${slug(v)}`,
    type: 'number',
    value: -v,
    unit: 'px',
    description: 'Espaçamento negativo (margens de sangria e sobreposição)',
  })),

  // raio
  ...fromList('radius', 'radius', radiusValues, 'Raio de borda'),
  { name: 'radius/radius-full', type: 'number', value: 9999, unit: 'px', description: 'Raio totalmente arredondado (pílula / círculo)' },

  // tipografia
  { name: 'font-family/font-family-satoshi', type: 'string', value: 'Satoshi', description: 'Família principal (UI e títulos)' },
  { name: 'font-family/font-family-inter', type: 'string', value: 'Inter', description: 'Família de apoio (fallback do Figma)' },
  { name: 'font-family/font-family-ibm-plex-mono', type: 'string', value: 'IBM Plex Mono', description: 'Família monoespaçada (kickers, rótulos)' },
  { name: 'font-weight/font-weight-regular', type: 'number', value: 400, unit: '', description: 'Peso regular' },
  { name: 'font-weight/font-weight-medium', type: 'number', value: 500, unit: '', description: 'Peso médio (mais usado)' },
  { name: 'font-weight/font-weight-semibold', type: 'number', value: 600, unit: '', description: 'Peso semibold' },
  { name: 'font-weight/font-weight-bold', type: 'number', value: 700, unit: '', description: 'Peso bold' },
  ...fromList('font-size', 'font-size', fontSizeValues, 'Tamanho de fonte'),
  ...fromList('line-height', 'line-height', lineHeightPx, 'Altura de linha fixa'),
  ...lineHeightRatio.map((v) => ({
    name: `line-height/line-height-ratio-${Math.round(v * 100)}`,
    type: 'number',
    value: v,
    unit: '',
    description: `Altura de linha relativa (${Math.round(v * 100)}% do tamanho da fonte)`,
  })),
  ...fromList('letter-spacing', 'letter-spacing', letterSpacingValues, 'Espaçamento entre letras (tracking)'),

  // traço / borda
  ...fromList('stroke', 'stroke', strokeValues, 'Espessura de traço (borda, ring, ícone)'),

  // dimensões
  ...fromList('size', 'size', sizeValues, 'Dimensão fixa (ícones, controles, alturas)'),

  // opacidade (0-100, como no Figma)
  ...fromList('opacity', 'opacity', opacityValues, 'Opacidade em %', '%'),

  // blur
  ...fromList('blur', 'blur', blurValues, 'Raio de desfoque (sombra / backdrop)'),

  // movimento
  ...fromList('duration', 'duration', durationValues, 'Duração de animação', 'ms'),
  { name: 'easing/easing-standard', type: 'string', value: 'cubic-bezier(0.2, 0.8, 0.2, 1)', description: 'Saída suave (padrão das entradas)' },
  { name: 'easing/easing-sheet', type: 'string', value: 'cubic-bezier(0.2, 0.9, 0.25, 1)', description: 'Subida do bottom sheet' },
  { name: 'easing/easing-message', type: 'string', value: 'cubic-bezier(0.2, 0.9, 0.3, 1.1)', description: 'Entrada de mensagens do assistente' },
  { name: 'easing/easing-spring', type: 'string', value: 'cubic-bezier(0.3, 1.4, 0.5, 1)', description: 'Mola (switch)' },
  { name: 'easing/easing-bounce', type: 'string', value: 'cubic-bezier(0.3, 1.3, 0.5, 1)', description: 'Quique (toast)' },
  { name: 'easing/easing-accelerate', type: 'string', value: 'cubic-bezier(0.4, 0, 1, 1)', description: 'Saída acelerada (fechar sheet)' },

  // breakpoints
  { name: 'breakpoint/breakpoint-800', type: 'number', value: 800, unit: 'px', description: 'Tablet / desktop pequeno' },
  { name: 'breakpoint/breakpoint-1100', type: 'number', value: 1100, unit: 'px', description: 'Desktop' },
  { name: 'breakpoint/breakpoint-1440', type: 'number', value: 1440, unit: 'px', description: 'Desktop largo' },
  { name: 'breakpoint/breakpoint-1920', type: 'number', value: 1920, unit: 'px', description: 'Full HD' },

  // camadas
  { name: 'z-index/z-index-40', type: 'number', value: 40, unit: '', description: 'Camada 40' },
  { name: 'z-index/z-index-50', type: 'number', value: 50, unit: '', description: 'Camada 50' },
]

/* ------------------------------------------------------------------ */
/* SEMÂNTICOS (sempre alias de um primitivo)                           */
/* ------------------------------------------------------------------ */

// scope: grupo de escopos do Figma (ver SCOPES no build)
const s = (name, ref, scope, description) => ({ name, ref, scope, description })

export const semantic = [
  // fundo
  s('color/background/bg-canvas', 'color/neutral-990', 'bg', 'Fundo raiz da página (html)'),
  s('color/background/bg-screen', 'color/neutral-950', 'bg', 'Fundo das telas internas'),
  s('color/background/bg-surface', 'color/neutral-920', 'bg', 'Painéis, listas e sheets'),
  s('color/background/bg-elevated', 'color/neutral-900', 'bg', 'Inputs, chips inativos, botão dark'),
  s('color/background/bg-elevated-hover', 'color/neutral-860', 'bg', 'Hover de superfícies elevadas'),
  s('color/background/bg-control', 'color/neutral-890', 'bg', 'Botões redondos (RoundButton)'),
  s('color/background/bg-control-hover', 'color/neutral-840', 'bg', 'Hover de botões redondos'),
  s('color/background/bg-tile', 'color/neutral-885', 'bg', 'Tiles de categoria e cartões'),
  s('color/background/bg-row-icon', 'color/neutral-820', 'bg', 'Quadro do ícone em linhas de lista'),
  s('color/background/bg-track', 'color/neutral-800', 'bg', 'Trilho do switch e handle do sheet'),
  s('color/background/bg-track-subtle', 'color/neutral-880', 'bg', 'Trilho da barra de progresso'),
  s('color/background/bg-track-inverse', 'color/ink-alpha-14', 'bg', 'Trilho sobre fundos claros (ring / progresso ink)'),
  s('color/background/bg-inverse', 'color/sand-100', 'bg', 'Superfície clara (toast)'),
  s('color/background/bg-overlay', 'color/black-alpha-70', 'bg', 'Véu atrás do sheet'),
  s('color/background/bg-hover-subtle', 'color/white-alpha-3', 'bg', 'Hover de linhas clicáveis'),
  s('color/background/bg-pressed-subtle', 'color/white-alpha-5', 'bg', 'Pressionado de linhas clicáveis'),
  s('color/background/bg-skeleton', 'color/neutral-880', 'bg', 'Base do skeleton'),
  s('color/background/bg-skeleton-highlight', 'color/neutral-750', 'bg', 'Brilho do skeleton'),
  s('color/background/bg-brand-primary', 'color/lime-200', 'bg', 'Ação primária (botão lime, chip ativo, switch on)'),
  s('color/background/bg-brand-primary-soft', 'color/lime-100', 'bg', 'Lime suave (ActionRow, progresso)'),
  s('color/background/bg-brand-secondary', 'color/lilac-100', 'bg', 'Lilás (avatar com iniciais)'),
  s('color/background/bg-brand-secondary-strong', 'color/lilac-400', 'bg', 'Lilás forte'),
  s('color/background/bg-ink', 'color/neutral-960', 'bg', 'Preenchimento escuro sobre fundos claros'),

  // texto
  s('color/text/text-primary', 'color/neutral-0', 'text', 'Texto principal'),
  s('color/text/text-secondary', 'color/neutral-50', 'text', 'Texto secundário de alto contraste'),
  s('color/text/text-muted', 'color/neutral-400', 'text', 'Rótulos e textos de apoio'),
  s('color/text/text-subtle', 'color/neutral-550', 'text', 'Subtítulos e placeholders'),
  s('color/text/text-inverse', 'color/neutral-960', 'text', 'Texto sobre fundos claros (ink)'),
  s('color/text/text-inverse-secondary', 'color/neutral-700', 'text', 'Texto secundário sobre fundos claros'),
  s('color/text/text-link', 'color/lime-100', 'text', 'Links (LinkButton)'),
  s('color/text/text-accent', 'color/lime-200', 'text', 'Destaque positivo'),
  s('color/text/text-error', 'color/lilac-100', 'text', 'Mensagens de erro e ação destrutiva'),

  // ícone
  s('color/icon/icon-primary', 'color/neutral-0', 'icon', 'Ícone sobre fundo escuro'),
  s('color/icon/icon-muted', 'color/neutral-400', 'icon', 'Ícone secundário'),
  s('color/icon/icon-inverse', 'color/neutral-960', 'icon', 'Ícone sobre fundo claro'),

  // borda
  s('color/border/border-default', 'color/neutral-880', 'border', 'Borda padrão'),
  s('color/border/border-strong', 'color/neutral-800', 'border', 'Ring de inputs, chips e estado vazio'),
  s('color/border/border-focus', 'color/lime-200', 'border', 'Foco (focus-visible, input focado)'),
  s('color/border/border-error', 'color/lilac-100', 'border', 'Ring de campo com erro'),

  // feedback
  s('color/feedback/feedback-success', 'color/lime-200', 'bg', 'Ícone de sucesso (toast)'),
  s('color/feedback/feedback-error', 'color/lilac-400', 'bg', 'Ícone de erro (toast)'),
  s('color/feedback/feedback-info', 'color/lilac-100', 'bg', 'Ícone de informação (toast)'),

  // categorias
  s('color/category/category-moradia', 'color/lilac-100', 'bg', 'Categoria Moradia'),
  s('color/category/category-alimentacao', 'color/lime-200', 'bg', 'Categoria Alimentação'),
  s('color/category/category-transporte', 'color/sand-100', 'bg', 'Categoria Transporte'),
  s('color/category/category-lazer', 'color/lilac-400', 'bg', 'Categoria Lazer'),
  s('color/category/category-assinaturas', 'color/mauve-200', 'bg', 'Categoria Assinaturas'),
  s('color/category/category-saude', 'color/sage-200', 'bg', 'Categoria Saúde'),
  s('color/category/category-outros', 'color/neutral-500', 'bg', 'Categoria Outros'),

  // gradientes (paradas)
  s('color/gradient/gradient-hero-start', 'color/lilac-400', 'bg', 'Gradiente hero — início'),
  s('color/gradient/gradient-hero-middle', 'color/lilac-100', 'bg', 'Gradiente hero — meio'),
  s('color/gradient/gradient-hero-end', 'color/lime-200', 'bg', 'Gradiente hero — fim'),
  s('color/gradient/gradient-feature-start', 'color/lilac-300', 'bg', 'Gradiente feature/insight — início'),
  s('color/gradient/gradient-feature-middle', 'color/lilac-150', 'bg', 'Gradiente feature/insight — meio'),
  s('color/gradient/gradient-feature-end', 'color/lime-100', 'bg', 'Gradiente feature/insight — fim'),

  // sombra
  s('color/shadow/shadow-elevated', 'color/black-alpha-50', 'effect', 'Sombra de elementos flutuantes (toast)'),
  s('color/shadow/shadow-bar', 'color/black-alpha-25', 'effect', 'Sombra da barra inferior'),
  s('color/shadow/shadow-glow-brand', 'color/lime-alpha-18', 'effect', 'Brilho do chip ativo'),
  s('color/shadow/shadow-glow-pulse', 'color/lime-alpha-12', 'effect', 'Pulso de brilho (animate-glow)'),

  // espaçamento — gaps
  s('spacing/gap/gap-3xs', 'space/space-2', 'gap', 'Gap mínimo (título ↔ subtítulo)'),
  s('spacing/gap/gap-2xs', 'space/space-4', 'gap', 'Gap 4'),
  s('spacing/gap/gap-xs', 'space/space-8', 'gap', 'Label ↔ controle, ícone ↔ texto'),
  s('spacing/gap/gap-sm', 'space/space-12', 'gap', 'Gap padrão entre itens (mais usado)'),
  s('spacing/gap/gap-md', 'space/space-16', 'gap', 'Gap entre grupos'),
  s('spacing/gap/gap-lg', 'space/space-20', 'gap', 'Gap 20'),
  s('spacing/gap/gap-xl', 'space/space-24', 'gap', 'Gap entre seções / colunas'),
  s('spacing/gap/gap-2xl', 'space/space-32', 'gap', 'Gap 32'),
  s('spacing/gap/gap-3xl', 'space/space-40', 'gap', 'Gap 40'),
  s('spacing/gap/gap-4xl', 'space/space-48', 'gap', 'Gap entre colunas no desktop'),
  s('spacing/gap/gap-action-row', 'space/space-10', 'gap', 'Gap do ActionRow'),

  // espaçamento — paddings
  s('spacing/inset/inset-control-x', 'space/space-16', 'padding', 'Padding horizontal de input e chip'),
  s('spacing/inset/inset-money-x', 'space/space-20', 'padding', 'Padding horizontal do MoneyInput'),
  s('spacing/inset/inset-card', 'space/space-24', 'padding', 'Padding de cards e sheet (mobile)'),
  s('spacing/inset/inset-card-lg', 'space/space-32', 'padding', 'Padding de cards e sheet (desktop)'),
  s('spacing/inset/inset-panel-x', 'space/space-14', 'padding', 'Padding horizontal do ListPanel'),
  s('spacing/inset/inset-panel-y', 'space/space-10', 'padding', 'Padding vertical do ListPanel'),
  s('spacing/inset/inset-toast-y', 'space/space-12', 'padding', 'Padding vertical do toast'),
  s('spacing/layout/page-gutter', 'space/space-26', 'padding', 'Margem lateral da página (mobile)'),
  s('spacing/layout/page-gutter-wide', 'space/space-32', 'padding', 'Margem lateral larga (mobile)'),
  s('spacing/layout/page-gutter-md', 'space/space-40', 'padding', 'Margem lateral a partir de 800px'),
  s('spacing/layout/page-gutter-lg', 'space/space-56', 'padding', 'Margem lateral a partir de 1100px'),
  s('spacing/layout/page-gutter-3xl', 'space/space-64', 'padding', 'Margem lateral a partir de 1920px'),
  s('spacing/layout/page-bottom', 'space/space-64', 'padding', 'Respiro inferior da página'),
  s('spacing/layout/header-top', 'space/space-20', 'padding', 'Topo do cabeçalho (mobile)'),
  s('spacing/layout/header-top-md', 'space/space-40', 'padding', 'Topo do cabeçalho (desktop)'),
  s('spacing/layout/section-gap', 'space/space-24', 'padding', 'Distância entre seções'),

  // espaçamento — negativos
  s('spacing/offset/offset-panel-bleed', 'space/space-negative-14', 'gap', 'Sangria lateral do ListPanel (-mx)'),
  s('spacing/offset/offset-hero-overlap', 'space/space-negative-180', 'gap', 'Sobreposição do hero (-mb)'),
  s('spacing/offset/offset-typing-lift', 'space/space-negative-4', 'gap', 'Pulo dos pontos de digitação'),

  // raio
  s('radius/radius-handle', 'radius/radius-3', 'radius', 'Handle do sheet'),
  s('radius/radius-progress', 'radius/radius-4', 'radius', 'Barra de progresso'),
  s('radius/radius-skeleton-sm', 'radius/radius-12', 'radius', 'Skeleton de texto'),
  s('radius/radius-input', 'radius/radius-18', 'radius', 'Inputs de texto'),
  s('radius/radius-control-sm', 'radius/radius-19', 'radius', 'Botão redondo pequeno (38px)'),
  s('radius/radius-chip', 'radius/radius-20', 'radius', 'Chips'),
  s('radius/radius-button', 'radius/radius-22', 'radius', 'Botões, MoneyInput, toast, RoundButton'),
  s('radius/radius-row', 'radius/radius-24', 'radius', 'Linhas de lista e ícone de linha'),
  s('radius/radius-tile', 'radius/radius-26', 'radius', 'ActionRow, estado vazio, skeleton'),
  s('radius/radius-panel', 'radius/radius-32', 'radius', 'Topo do ListPanel e sheet'),
  s('radius/radius-feature', 'radius/radius-34', 'radius', 'FeatureCard'),
  s('radius/radius-panel-bottom', 'radius/radius-40', 'radius', 'Base do ListPanel'),
  s('radius/radius-pill', 'radius/radius-full', 'radius', 'Pílula / círculo (avatar, switch)'),

  // traço
  s('border-width/border-width-default', 'stroke/stroke-1', 'stroke', 'Borda / ring padrão'),
  s('border-width/border-width-strong', 'stroke/stroke-2', 'stroke', 'Spinner e foco'),
  s('border-width/focus-ring-width', 'stroke/stroke-2', 'stroke', 'Outline de focus-visible'),
  s('border-width/icon-stroke-thin', 'stroke/stroke-1-6', 'stroke', 'Ícones de navegação (voltar)'),
  s('border-width/icon-stroke-regular', 'stroke/stroke-1-8', 'stroke', 'Ícones padrão'),
  s('border-width/icon-stroke-bold', 'stroke/stroke-2-4', 'stroke', 'Ícones de confirmação'),
  s('border-width/ring-stroke', 'stroke/stroke-11', 'stroke', 'Traço do anel de meta (Ring)'),

  // dimensões
  s('size/size-spinner', 'size/size-16', 'size', 'Spinner'),
  s('size/size-toast-icon', 'size/size-28', 'size', 'Ícone do toast'),
  s('size/size-control-sm', 'size/size-38', 'size', 'Botão redondo pequeno'),
  s('size/size-chip-height', 'size/size-40', 'size', 'Altura do chip'),
  s('size/size-control', 'size/size-44', 'size', 'Botão redondo / avatar padrão'),
  s('size/size-row-icon', 'size/size-48', 'size', 'Ícone de linha de lista'),
  s('size/size-input-height', 'size/size-52', 'size', 'Altura de input'),
  s('size/size-button-height', 'size/size-56', 'size', 'Altura do botão primário'),
  s('size/size-row-min-height', 'size/size-76', 'size', 'Altura mínima da linha de lista'),
  s('size/size-action-tile', 'size/size-84', 'size', 'Quadrado do ActionRow'),
  s('size/size-ring', 'size/size-104', 'size', 'Anel de meta'),
  s('size/size-feature-min-height', 'size/size-238', 'size', 'Altura mínima do FeatureCard'),
  s('size/switch-width', 'size/size-52', 'size', 'Largura do switch'),
  s('size/switch-height', 'size/size-30', 'size', 'Altura do switch'),
  s('size/switch-thumb', 'size/size-24', 'size', 'Bolinha do switch'),
  s('size/handle-width', 'size/size-44', 'size', 'Largura do handle do sheet'),
  s('size/handle-height', 'size/size-5', 'size', 'Altura do handle do sheet'),

  // tipografia
  s('typography/font-family-sans', 'font-family/font-family-satoshi', 'font-family', 'Família de UI'),
  s('typography/font-family-mono', 'font-family/font-family-ibm-plex-mono', 'font-family', 'Família monoespaçada'),
  s('typography/font-weight-regular', 'font-weight/font-weight-regular', 'font-weight', 'Texto corrido'),
  s('typography/font-weight-medium', 'font-weight/font-weight-medium', 'font-weight', 'Títulos, botões, rótulos'),
  s('typography/font-weight-bold', 'font-weight/font-weight-bold', 'font-weight', 'Números de destaque'),

  ...typeRole('display-money', 42, -1.7, 'medium', 'Valor grande do MoneyInput'),
  ...typeRole('heading-screen-xl', 42, -1.3, 'medium', 'Título de tela ≥1920px'),
  ...typeRole('heading-screen-lg', 36, -1.3, 'medium', 'Título de tela ≥800px'),
  ...typeRole('heading-screen', 29, -1.015, 'medium', 'Título de tela (ScreenHeader)'),
  ...typeRole('heading-sheet', 23, -0.6, 'medium', 'Título do sheet'),
  ...typeRole('heading-metric', 22, -0.66, 'bold', 'Percentual do anel de meta'),
  ...typeRole('heading-section', 21, -0.42, 'medium', 'Título de seção (SectionHeader)'),
  ...typeRole('body-lg', 17, 0, 'medium', 'ActionRow, título de estado vazio'),
  ...typeRole('body-md', 16, 0, 'medium', 'Linha de lista, botão, input'),
  ...typeRole('body-sm', 15, 0, 'medium', 'Toast'),
  ...typeRole('body-xs', 14, 0, 'medium', 'Link, chip, texto de estado vazio'),
  ...typeRole('caption', 13, 0, 'medium', 'Rótulo de campo, subtítulo de linha'),
  ...typeRole('caption-sm', 12, 0, 'regular', 'Nota de linha', 'line-height/line-height-ratio-135'),
  ...typeRole('kicker', 11, 1.1, 'medium', 'Kicker monoespaçado em caixa alta', null, 'mono'),

  // opacidade
  s('opacity/opacity-disabled', 'opacity/opacity-40', 'opacity', 'Botão desabilitado'),
  s('opacity/opacity-disabled-soft', 'opacity/opacity-50', 'opacity', 'ActionRow desabilitado'),
  s('opacity/opacity-muted', 'opacity/opacity-60', 'opacity', 'Ícone do date picker'),

  // efeitos
  s('effect/shadow-elevated-blur', 'blur/blur-40', 'effect-float', 'Blur da sombra do toast'),
  s('effect/shadow-elevated-y', 'space/space-12', 'effect-float', 'Deslocamento Y da sombra do toast'),
  s('effect/shadow-glow-blur', 'blur/blur-16', 'effect-float', 'Blur do brilho do chip ativo'),
  s('effect/shadow-glow-y', 'space/space-4', 'effect-float', 'Deslocamento Y do brilho do chip'),
  s('effect/backdrop-blur-overlay', 'blur/blur-2', 'effect-float', 'Desfoque do véu do sheet'),

  // movimento
  s('motion/duration-fast', 'duration/duration-200', 'none', 'Transições de hover / cor'),
  s('motion/duration-base', 'duration/duration-300', 'none', 'Switch'),
  s('motion/duration-enter', 'duration/duration-340', 'none', 'Entrada do sheet'),
  s('motion/duration-slow', 'duration/duration-700', 'none', 'Preenchimento de barras'),
  s('motion/duration-count-up', 'duration/duration-650', 'none', 'Contagem de valores'),
  s('motion/easing-standard', 'easing/easing-standard', 'none', 'Curva padrão'),
  s('motion/easing-enter', 'easing/easing-sheet', 'none', 'Curva de entrada de sheet'),
  s('motion/easing-exit', 'easing/easing-accelerate', 'none', 'Curva de saída'),
  s('motion/easing-spring', 'easing/easing-spring', 'none', 'Curva com mola'),

  // layout
  s('layout/breakpoint-md', 'breakpoint/breakpoint-800', 'none', 'Breakpoint md'),
  s('layout/breakpoint-lg', 'breakpoint/breakpoint-1100', 'none', 'Breakpoint lg'),
  s('layout/breakpoint-xl', 'breakpoint/breakpoint-1440', 'none', 'Breakpoint xl'),
  s('layout/breakpoint-3xl', 'breakpoint/breakpoint-1920', 'none', 'Breakpoint 3xl'),
  s('layout/z-index-sheet', 'z-index/z-index-40', 'none', 'Camada do sheet'),
  s('layout/z-index-toast', 'z-index/z-index-50', 'none', 'Camada do toast'),
]

function typeRole(role, size, tracking, weight, description, lineHeight, family = 'sans') {
  const out = [
    s(`typography/${role}/font-family`, family === 'mono' ? 'font-family/font-family-ibm-plex-mono' : 'font-family/font-family-satoshi', 'font-family', description),
    s(`typography/${role}/font-size`, `font-size/font-size-${slug(size)}`, 'font-size', description),
    s(`typography/${role}/font-weight`, `font-weight/font-weight-${weight}`, 'font-weight', description),
    s(`typography/${role}/letter-spacing`, `letter-spacing/letter-spacing-${slug(tracking)}`, 'letter-spacing', description),
  ]
  // line-height relativo (ratio) não pode ser ligado ao campo em px do Figma: escopo "none"
  if (lineHeight) out.push(s(`typography/${role}/line-height`, lineHeight, lineHeight.includes('ratio') ? 'none' : 'line-height', description))
  return out
}
