/**
 * Gera os artefatos de design tokens a partir de tokens/tokens.source.mjs.
 *   node scripts/build-tokens.mjs   (ou: pnpm tokens)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { primitives, semantic } from '../tokens/tokens.source.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Escopos do Figma por grupo semântico. Primitivos ficam ocultos ([]). */
export const SCOPES = {
  bg: ['FRAME_FILL', 'SHAPE_FILL'],
  text: ['TEXT_FILL'],
  icon: ['SHAPE_FILL', 'STROKE_COLOR'],
  border: ['STROKE_COLOR'],
  effect: ['EFFECT_COLOR'],
  gap: ['GAP'],
  padding: ['GAP'],
  radius: ['CORNER_RADIUS'],
  stroke: ['STROKE_FLOAT'],
  size: ['WIDTH_HEIGHT'],
  'font-family': ['FONT_FAMILY'],
  'font-size': ['FONT_SIZE'],
  'font-weight': ['FONT_WEIGHT'],
  'letter-spacing': ['LETTER_SPACING'],
  'line-height': ['LINE_HEIGHT'],
  opacity: ['OPACITY'],
  'effect-float': ['EFFECT_FLOAT'],
  none: [],
}

/** Nome do token -> nome da CSS custom property (kebab, sem repetir o grupo). */
export function cssName(name) {
  let segs = name.split('/')
  if (segs.length === 3 && (segs[0] === 'color' || segs[0] === 'spacing')) segs = [segs[0], segs[2]]
  const [first, ...rest] = segs
  return '--' + [first, ...rest.map((s) => (s.startsWith(first + '-') ? s.slice(first.length + 1) : s))].join('-')
}

const byName = new Map(primitives.map((p) => [p.name, p]))

// validação
const errors = []
const seen = new Set()
for (const t of [...primitives, ...semantic]) {
  if (seen.has(t.name)) errors.push(`nome duplicado: ${t.name}`)
  seen.add(t.name)
  if (!/^[a-z0-9-]+(\/[a-z0-9-]+)*$/.test(t.name)) errors.push(`nome fora do kebab-case: ${t.name}`)
}
const cssSeen = new Map()
for (const t of [...primitives, ...semantic]) {
  const c = cssName(t.name)
  if (cssSeen.has(c)) errors.push(`CSS var duplicada ${c}: ${t.name} e ${cssSeen.get(c)}`)
  cssSeen.set(c, t.name)
}
for (const t of semantic) {
  if (!byName.has(t.ref)) errors.push(`alias inexistente: ${t.name} -> ${t.ref}`)
  if (!(t.scope in SCOPES)) errors.push(`escopo desconhecido: ${t.name} (${t.scope})`)
}
if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}

const hex2 = (n) => n.toString(16).padStart(2, '0')
const cssValue = (p) => {
  if (p.type === 'color') return Array.isArray(p.value) ? `rgba(${p.value.join(', ')})` : p.value
  if (p.type === 'string') return p.name.startsWith('font-family') ? `'${p.value}'` : p.value
  if (p.unit === 'px') return p.value === 0 ? '0' : `${p.value}px`
  if (p.unit === 'ms') return `${p.value}ms`
  if (p.unit === '%') return String(p.value / 100)
  return String(p.value)
}
const displayValue = (p) => {
  if (p.type === 'color') {
    if (!Array.isArray(p.value)) return p.value.toUpperCase()
    const [r, g, b, a] = p.value
    return `#${hex2(r)}${hex2(g)}${hex2(b)}`.toUpperCase() + ` @ ${Math.round(a * 100)}%`
  }
  if (p.type === 'string') return p.value
  return `${p.value}${p.unit ?? ''}`
}

/* ---------------------------------------------------------------- JSON */
const json = {
  collections: {
    primitives: { name: 'primitives', mode: 'value' },
    semantic: { name: 'semantic', mode: 'dark' },
  },
  primitives: primitives.map((p) => ({
    name: p.name,
    type: p.type,
    value: p.value,
    css: cssName(p.name),
    description: p.description,
  })),
  semantic: semantic.map((t) => ({
    name: t.name,
    alias: t.ref,
    type: byName.get(t.ref).type,
    scopes: SCOPES[t.scope],
    css: cssName(t.name),
    description: t.description,
  })),
}
fs.writeFileSync(path.join(root, 'tokens/tokens.json'), JSON.stringify(json, null, 2) + '\n')

/* ----------------------------------------------------------------- CSS */
const cssLines = [
  '/* Gerado por scripts/build-tokens.mjs — não edite à mão. */',
  ':root {',
  '  /* primitivos */',
  ...primitives.map((p) => `  ${cssName(p.name)}: ${cssValue(p)};`),
  '',
  '  /* semânticos (alias dos primitivos) */',
  ...semantic.map((t) => `  ${cssName(t.name)}: var(${cssName(t.ref)});`),
  '}',
  '',
]
fs.writeFileSync(path.join(root, 'tokens/tokens.css'), cssLines.join('\n'))

/* ------------------------------------------------------------ Markdown */
const group = (list) => {
  const m = new Map()
  for (const t of list) {
    const segs = t.name.split('/')
    const key = segs.length > 2 ? segs.slice(0, 2).join('/') : segs[0]
    if (!m.has(key)) m.set(key, [])
    m.get(key).push(t)
  }
  return m
}
const esc = (s) => String(s).replace(/\|/g, '\\|')

const TITLES = {
  color: 'Cor',
  space: 'Espaçamento (inclui negativos)',
  radius: 'Raio',
  'font-family': 'Família tipográfica',
  'font-weight': 'Peso tipográfico',
  'font-size': 'Tamanho de fonte',
  'line-height': 'Altura de linha',
  'letter-spacing': 'Espaçamento entre letras',
  stroke: 'Traço (stroke)',
  size: 'Dimensão',
  opacity: 'Opacidade',
  blur: 'Desfoque',
  duration: 'Duração',
  easing: 'Curva de animação',
  breakpoint: 'Breakpoint',
  'z-index': 'Camada (z-index)',
}

const md = []
md.push('# Design tokens — Okiva')
md.push('')
md.push('> Gerado por `scripts/build-tokens.mjs` a partir de `tokens/tokens.source.mjs`. Não edite este arquivo à mão: altere a fonte e rode `pnpm tokens`.')
md.push('')
md.push('## Estrutura')
md.push('')
md.push('| Coleção (Figma) | Modo | Papel |')
md.push('| --- | --- | --- |')
md.push(`| \`primitives\` | \`value\` | Valores crus (${primitives.length} tokens). Ocultos nos seletores do Figma: use sempre um semântico. |`)
md.push(`| \`semantic\` | \`dark\` | Intenção de uso (${semantic.length} tokens). Todo semântico é **alias** de um primitivo. |`)
md.push('')
md.push('**Nomenclatura:** kebab-case. No Figma o `/` cria pastas (`color/background/bg-surface`); no código o token vira uma CSS custom property (`--color-bg-surface`). Os nomes em CSS estão em `tokens/tokens.css` e no *code syntax* (WEB) de cada variável no Figma.')
md.push('')
md.push('**Regra de uso:** componentes consomem apenas tokens semânticos. Se nenhum semântico serve, crie um novo semântico apontando para um primitivo — nunca use o primitivo direto no componente.')
md.push('')
md.push('## Sumário')
md.push('')
md.push('- [Tokens primitivos](#tokens-primitivos)')
for (const k of group(primitives).keys()) md.push(`  - [${TITLES[k] ?? k}](#primitivo-${k})`)
md.push('- [Tokens semânticos](#tokens-semânticos)')
for (const k of group(semantic).keys()) md.push(`  - [${k}](#semantico-${k.replace('/', '-')})`)
md.push('- [Mapeamento com o código atual](#mapeamento-com-o-código-atual)')
md.push('')

md.push('## Tokens primitivos')
md.push('')
for (const [k, list] of group(primitives)) {
  md.push(`<a id="primitivo-${k}"></a>`)
  md.push('')
  md.push(`### ${TITLES[k] ?? k}`)
  md.push('')
  md.push('| Token (Figma) | Valor | CSS | Descrição |')
  md.push('| --- | --- | --- | --- |')
  for (const p of list) md.push(`| \`${p.name}\` | \`${esc(displayValue(p))}\` | \`${cssName(p.name)}\` | ${esc(p.description)} |`)
  md.push('')
}

md.push('## Tokens semânticos')
md.push('')
for (const [k, list] of group(semantic)) {
  md.push(`<a id="semantico-${k.replace('/', '-')}"></a>`)
  md.push('')
  md.push(`### ${k}`)
  md.push('')
  md.push('| Token (Figma) | Alias → primitivo | Valor resolvido | CSS | Uso |')
  md.push('| --- | --- | --- | --- | --- |')
  for (const t of list) {
    const p = byName.get(t.ref)
    md.push(`| \`${t.name}\` | \`${t.ref}\` | \`${esc(displayValue(p))}\` | \`${cssName(t.name)}\` | ${esc(t.description)} |`)
  }
  md.push('')
}

md.push('## Mapeamento com o código atual')
md.push('')
md.push('O app hoje usa as utilities do Tailwind geradas em `src/index.css` (`--color-esk-*`). Equivalência com os semânticos:')
md.push('')
md.push('| Tailwind atual | Token semântico |')
md.push('| --- | --- |')
const legacy = [
  ['esk-bg (#030303)', 'color/background/bg-canvas'],
  ['esk-bg-2 (#0a0a0c)', 'color/background/bg-screen'],
  ['esk-surface (#151518)', 'color/background/bg-surface'],
  ['esk-elevated (#18181b)', 'color/background/bg-elevated'],
  ['esk-tile (#1c1c1c)', 'color/background/bg-tile'],
  ['esk-control (#1a1a1d)', 'color/background/bg-control'],
  ['esk-row (#242428)', 'color/background/bg-row-icon'],
  ['esk-border (#1c1c1f)', 'color/border/border-default'],
  ['esk-track (#26262a)', 'color/border/border-strong · color/background/bg-track'],
  ['esk-text (#ffffff)', 'color/text/text-primary'],
  ['esk-text-2 (#f2f2f2)', 'color/text/text-secondary'],
  ['esk-muted (#9a9a9a)', 'color/text/text-muted'],
  ['esk-subtle (#85858a)', 'color/text/text-subtle'],
  ['esk-lime (#e5ffb5)', 'color/background/bg-brand-primary'],
  ['esk-lime-soft (#eafebd)', 'color/background/bg-brand-primary-soft · color/text/text-link'],
  ['esk-lilac (#d8ccfa)', 'color/background/bg-brand-secondary · color/text/text-error'],
  ['esk-lilac-strong (#bfa9fe)', 'color/background/bg-brand-secondary-strong'],
  ['esk-lilac-card (#bbaaf8)', 'color/gradient/gradient-feature-start'],
  ['esk-offwhite (#f1f1ee)', 'color/background/bg-inverse'],
  ['esk-ink (#0a0a0a)', 'color/text/text-inverse'],
  ['esk-ink-2 (#333333)', 'color/text/text-inverse-secondary'],
  ['hover #1f1f23', 'color/background/bg-elevated-hover'],
  ['hover #232327', 'color/background/bg-control-hover'],
]
for (const [a, b] of legacy) md.push(`| \`${a}\` | ${b.split(' · ').map((x) => `\`${x}\``).join(' · ')} |`)
md.push('')
md.push('### Gradientes')
md.push('')
md.push('| CSS atual | Paradas (semânticos) |')
md.push('| --- | --- |')
md.push('| `--esk-gradient-hero` (146.88°) | `gradient-hero-start` 14% → `gradient-hero-middle` 41% → `gradient-hero-end` 86% |')
md.push('| `--esk-gradient-feature` / `--esk-gradient-insight` | `gradient-feature-start` 5% → `gradient-feature-middle` 39% → `gradient-feature-end` 95% |')
md.push('| `--esk-gradient-wallet` (143.19°) | `gradient-feature-middle` 5% → `gradient-feature-end` 61% |')
md.push('')
md.push('### Sombras')
md.push('')
md.push('| Uso | Composição |')
md.push('| --- | --- |')
md.push('| Toast | `0 effect/shadow-elevated-y effect/shadow-elevated-blur color/shadow/shadow-elevated` |')
md.push('| Chip ativo | `0 effect/shadow-glow-y effect/shadow-glow-blur color/shadow/shadow-glow-brand` |')
md.push('| Barra inferior | `0 -8px 24px color/shadow/shadow-bar` |')
md.push('')
md.push('## Limitações conhecidas')
md.push('')
md.push('- A fonte **Satoshi** não está instalada no ambiente do Figma usado para gerar as variáveis, por isso não foram criados *text styles*; a tipografia está documentada como variáveis por papel (`typography/<papel>/font-size`, `font-weight`, `letter-spacing`, `font-family`).')
md.push('- `line-height-ratio-*` são multiplicadores (ex.: 1.35). O Figma interpreta variáveis de altura de linha em px, então esses tokens ficam sem escopo de binding.')
md.push('- Curvas de animação, durações, breakpoints e z-index existem como variáveis apenas para documentação / code syntax (sem escopo no Figma).')
md.push('')
fs.writeFileSync(path.join(root, 'docs/design-tokens.md'), md.join('\n'))

console.log(`ok: ${primitives.length} primitivos, ${semantic.length} semânticos`)
