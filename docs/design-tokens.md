# Design tokens — Okiva

> Gerado por `scripts/build-tokens.mjs` a partir de `tokens/tokens.source.mjs`. Não edite este arquivo à mão: altere a fonte e rode `pnpm tokens`.

## Estrutura

| Coleção (Figma) | Modo | Papel |
| --- | --- | --- |
| `primitives` | `value` | Valores crus (257 tokens). Ocultos nos seletores do Figma: use sempre um semântico. |
| `semantic` | `dark` | Intenção de uso (211 tokens). Todo semântico é **alias** de um primitivo. |

**Nomenclatura:** kebab-case. No Figma o `/` cria pastas (`color/background/bg-surface`); no código o token vira uma CSS custom property (`--color-bg-surface`). Os nomes em CSS estão em `tokens/tokens.css` e no *code syntax* (WEB) de cada variável no Figma.

**Regra de uso:** componentes consomem apenas tokens semânticos. Se nenhum semântico serve, crie um novo semântico apontando para um primitivo — nunca use o primitivo direto no componente.

## Sumário

- [Tokens primitivos](#tokens-primitivos)
  - [Cor](#primitivo-color)
  - [Espaçamento (inclui negativos)](#primitivo-space)
  - [Raio](#primitivo-radius)
  - [Família tipográfica](#primitivo-font-family)
  - [Peso tipográfico](#primitivo-font-weight)
  - [Tamanho de fonte](#primitivo-font-size)
  - [Altura de linha](#primitivo-line-height)
  - [Espaçamento entre letras](#primitivo-letter-spacing)
  - [Traço (stroke)](#primitivo-stroke)
  - [Dimensão](#primitivo-size)
  - [Opacidade](#primitivo-opacity)
  - [Desfoque](#primitivo-blur)
  - [Duração](#primitivo-duration)
  - [Curva de animação](#primitivo-easing)
  - [Breakpoint](#primitivo-breakpoint)
  - [Camada (z-index)](#primitivo-z-index)
- [Tokens semânticos](#tokens-semânticos)
  - [color/background](#semantico-color-background)
  - [color/text](#semantico-color-text)
  - [color/icon](#semantico-color-icon)
  - [color/border](#semantico-color-border)
  - [color/feedback](#semantico-color-feedback)
  - [color/category](#semantico-color-category)
  - [color/gradient](#semantico-color-gradient)
  - [color/shadow](#semantico-color-shadow)
  - [spacing/gap](#semantico-spacing-gap)
  - [spacing/inset](#semantico-spacing-inset)
  - [spacing/layout](#semantico-spacing-layout)
  - [spacing/offset](#semantico-spacing-offset)
  - [radius](#semantico-radius)
  - [border-width](#semantico-border-width)
  - [size](#semantico-size)
  - [typography](#semantico-typography)
  - [typography/display-money](#semantico-typography-display-money)
  - [typography/heading-screen-xl](#semantico-typography-heading-screen-xl)
  - [typography/heading-screen-lg](#semantico-typography-heading-screen-lg)
  - [typography/heading-screen](#semantico-typography-heading-screen)
  - [typography/heading-sheet](#semantico-typography-heading-sheet)
  - [typography/heading-metric](#semantico-typography-heading-metric)
  - [typography/heading-section](#semantico-typography-heading-section)
  - [typography/body-lg](#semantico-typography-body-lg)
  - [typography/body-md](#semantico-typography-body-md)
  - [typography/body-sm](#semantico-typography-body-sm)
  - [typography/body-xs](#semantico-typography-body-xs)
  - [typography/caption](#semantico-typography-caption)
  - [typography/caption-sm](#semantico-typography-caption-sm)
  - [typography/kicker](#semantico-typography-kicker)
  - [opacity](#semantico-opacity)
  - [effect](#semantico-effect)
  - [motion](#semantico-motion)
  - [layout](#semantico-layout)
- [Mapeamento com o código atual](#mapeamento-com-o-código-atual)

## Tokens primitivos

<a id="primitivo-color"></a>

### Cor

| Token (Figma) | Valor | CSS | Descrição |
| --- | --- | --- | --- |
| `color/neutral-0` | `#FFFFFF` | `--color-neutral-0` | Escala neutra (cinzas do tema escuro) |
| `color/neutral-50` | `#F2F2F2` | `--color-neutral-50` | Escala neutra (cinzas do tema escuro) |
| `color/neutral-400` | `#9A9A9A` | `--color-neutral-400` | Escala neutra (cinzas do tema escuro) |
| `color/neutral-500` | `#8F8F96` | `--color-neutral-500` | Escala neutra (cinzas do tema escuro) |
| `color/neutral-550` | `#85858A` | `--color-neutral-550` | Escala neutra (cinzas do tema escuro) |
| `color/neutral-700` | `#333333` | `--color-neutral-700` | Escala neutra (cinzas do tema escuro) |
| `color/neutral-750` | `#2A2A2F` | `--color-neutral-750` | Escala neutra (cinzas do tema escuro) |
| `color/neutral-800` | `#26262A` | `--color-neutral-800` | Escala neutra (cinzas do tema escuro) |
| `color/neutral-820` | `#242428` | `--color-neutral-820` | Escala neutra (cinzas do tema escuro) |
| `color/neutral-840` | `#232327` | `--color-neutral-840` | Escala neutra (cinzas do tema escuro) |
| `color/neutral-860` | `#1F1F23` | `--color-neutral-860` | Escala neutra (cinzas do tema escuro) |
| `color/neutral-880` | `#1C1C1F` | `--color-neutral-880` | Escala neutra (cinzas do tema escuro) |
| `color/neutral-885` | `#1C1C1C` | `--color-neutral-885` | Escala neutra (cinzas do tema escuro) |
| `color/neutral-890` | `#1A1A1D` | `--color-neutral-890` | Escala neutra (cinzas do tema escuro) |
| `color/neutral-900` | `#18181B` | `--color-neutral-900` | Escala neutra (cinzas do tema escuro) |
| `color/neutral-920` | `#151518` | `--color-neutral-920` | Escala neutra (cinzas do tema escuro) |
| `color/neutral-950` | `#0A0A0C` | `--color-neutral-950` | Escala neutra (cinzas do tema escuro) |
| `color/neutral-960` | `#0A0A0A` | `--color-neutral-960` | Escala neutra (cinzas do tema escuro) |
| `color/neutral-990` | `#030303` | `--color-neutral-990` | Escala neutra (cinzas do tema escuro) |
| `color/neutral-1000` | `#000000` | `--color-neutral-1000` | Escala neutra (cinzas do tema escuro) |
| `color/sand-100` | `#F1F1EE` | `--color-sand-100` | Cor de marca / categoria |
| `color/lime-100` | `#EAFEBD` | `--color-lime-100` | Cor de marca / categoria |
| `color/lime-200` | `#E5FFB5` | `--color-lime-200` | Cor de marca / categoria |
| `color/lilac-100` | `#D8CCFA` | `--color-lilac-100` | Cor de marca / categoria |
| `color/lilac-150` | `#D6CCF7` | `--color-lilac-150` | Cor de marca / categoria |
| `color/lilac-300` | `#BBAAF8` | `--color-lilac-300` | Cor de marca / categoria |
| `color/lilac-400` | `#BFA9FE` | `--color-lilac-400` | Cor de marca / categoria |
| `color/mauve-200` | `#C9C3DC` | `--color-mauve-200` | Cor de marca / categoria |
| `color/sage-200` | `#D6E6C4` | `--color-sage-200` | Cor de marca / categoria |
| `color/white-alpha-3` | `#FFFFFF @ 3%` | `--color-white-alpha-3` | Cor com transparência |
| `color/white-alpha-5` | `#FFFFFF @ 5%` | `--color-white-alpha-5` | Cor com transparência |
| `color/black-alpha-5` | `#000000 @ 5%` | `--color-black-alpha-5` | Cor com transparência |
| `color/black-alpha-25` | `#000000 @ 25%` | `--color-black-alpha-25` | Cor com transparência |
| `color/black-alpha-50` | `#000000 @ 50%` | `--color-black-alpha-50` | Cor com transparência |
| `color/black-alpha-70` | `#000000 @ 70%` | `--color-black-alpha-70` | Cor com transparência |
| `color/ink-alpha-14` | `#0A0A0A @ 14%` | `--color-ink-alpha-14` | Cor com transparência |
| `color/lime-alpha-12` | `#E5FFB5 @ 12%` | `--color-lime-alpha-12` | Cor com transparência |
| `color/lime-alpha-18` | `#E5FFB5 @ 18%` | `--color-lime-alpha-18` | Cor com transparência |

<a id="primitivo-space"></a>

### Espaçamento (inclui negativos)

| Token (Figma) | Valor | CSS | Descrição |
| --- | --- | --- | --- |
| `space/space-0` | `0px` | `--space-0` | Espaçamento positivo (gap, padding, margin) |
| `space/space-1` | `1px` | `--space-1` | Espaçamento positivo (gap, padding, margin) |
| `space/space-2` | `2px` | `--space-2` | Espaçamento positivo (gap, padding, margin) |
| `space/space-3` | `3px` | `--space-3` | Espaçamento positivo (gap, padding, margin) |
| `space/space-4` | `4px` | `--space-4` | Espaçamento positivo (gap, padding, margin) |
| `space/space-5` | `5px` | `--space-5` | Espaçamento positivo (gap, padding, margin) |
| `space/space-6` | `6px` | `--space-6` | Espaçamento positivo (gap, padding, margin) |
| `space/space-7` | `7px` | `--space-7` | Espaçamento positivo (gap, padding, margin) |
| `space/space-8` | `8px` | `--space-8` | Espaçamento positivo (gap, padding, margin) |
| `space/space-9` | `9px` | `--space-9` | Espaçamento positivo (gap, padding, margin) |
| `space/space-10` | `10px` | `--space-10` | Espaçamento positivo (gap, padding, margin) |
| `space/space-12` | `12px` | `--space-12` | Espaçamento positivo (gap, padding, margin) |
| `space/space-13` | `13px` | `--space-13` | Espaçamento positivo (gap, padding, margin) |
| `space/space-14` | `14px` | `--space-14` | Espaçamento positivo (gap, padding, margin) |
| `space/space-15` | `15px` | `--space-15` | Espaçamento positivo (gap, padding, margin) |
| `space/space-16` | `16px` | `--space-16` | Espaçamento positivo (gap, padding, margin) |
| `space/space-18` | `18px` | `--space-18` | Espaçamento positivo (gap, padding, margin) |
| `space/space-19` | `19px` | `--space-19` | Espaçamento positivo (gap, padding, margin) |
| `space/space-20` | `20px` | `--space-20` | Espaçamento positivo (gap, padding, margin) |
| `space/space-22` | `22px` | `--space-22` | Espaçamento positivo (gap, padding, margin) |
| `space/space-24` | `24px` | `--space-24` | Espaçamento positivo (gap, padding, margin) |
| `space/space-26` | `26px` | `--space-26` | Espaçamento positivo (gap, padding, margin) |
| `space/space-28` | `28px` | `--space-28` | Espaçamento positivo (gap, padding, margin) |
| `space/space-32` | `32px` | `--space-32` | Espaçamento positivo (gap, padding, margin) |
| `space/space-40` | `40px` | `--space-40` | Espaçamento positivo (gap, padding, margin) |
| `space/space-42` | `42px` | `--space-42` | Espaçamento positivo (gap, padding, margin) |
| `space/space-48` | `48px` | `--space-48` | Espaçamento positivo (gap, padding, margin) |
| `space/space-56` | `56px` | `--space-56` | Espaçamento positivo (gap, padding, margin) |
| `space/space-64` | `64px` | `--space-64` | Espaçamento positivo (gap, padding, margin) |
| `space/space-70` | `70px` | `--space-70` | Espaçamento positivo (gap, padding, margin) |
| `space/space-96` | `96px` | `--space-96` | Espaçamento positivo (gap, padding, margin) |
| `space/space-negative-1` | `-1px` | `--space-negative-1` | Espaçamento negativo (margens de sangria e sobreposição) |
| `space/space-negative-2` | `-2px` | `--space-negative-2` | Espaçamento negativo (margens de sangria e sobreposição) |
| `space/space-negative-4` | `-4px` | `--space-negative-4` | Espaçamento negativo (margens de sangria e sobreposição) |
| `space/space-negative-6` | `-6px` | `--space-negative-6` | Espaçamento negativo (margens de sangria e sobreposição) |
| `space/space-negative-8` | `-8px` | `--space-negative-8` | Espaçamento negativo (margens de sangria e sobreposição) |
| `space/space-negative-12` | `-12px` | `--space-negative-12` | Espaçamento negativo (margens de sangria e sobreposição) |
| `space/space-negative-14` | `-14px` | `--space-negative-14` | Espaçamento negativo (margens de sangria e sobreposição) |
| `space/space-negative-16` | `-16px` | `--space-negative-16` | Espaçamento negativo (margens de sangria e sobreposição) |
| `space/space-negative-18` | `-18px` | `--space-negative-18` | Espaçamento negativo (margens de sangria e sobreposição) |
| `space/space-negative-24` | `-24px` | `--space-negative-24` | Espaçamento negativo (margens de sangria e sobreposição) |
| `space/space-negative-32` | `-32px` | `--space-negative-32` | Espaçamento negativo (margens de sangria e sobreposição) |
| `space/space-negative-180` | `-180px` | `--space-negative-180` | Espaçamento negativo (margens de sangria e sobreposição) |

<a id="primitivo-radius"></a>

### Raio

| Token (Figma) | Valor | CSS | Descrição |
| --- | --- | --- | --- |
| `radius/radius-0` | `0px` | `--radius-0` | Raio de borda |
| `radius/radius-2` | `2px` | `--radius-2` | Raio de borda |
| `radius/radius-3` | `3px` | `--radius-3` | Raio de borda |
| `radius/radius-4` | `4px` | `--radius-4` | Raio de borda |
| `radius/radius-5` | `5px` | `--radius-5` | Raio de borda |
| `radius/radius-6` | `6px` | `--radius-6` | Raio de borda |
| `radius/radius-7` | `7px` | `--radius-7` | Raio de borda |
| `radius/radius-8` | `8px` | `--radius-8` | Raio de borda |
| `radius/radius-10` | `10px` | `--radius-10` | Raio de borda |
| `radius/radius-12` | `12px` | `--radius-12` | Raio de borda |
| `radius/radius-16` | `16px` | `--radius-16` | Raio de borda |
| `radius/radius-18` | `18px` | `--radius-18` | Raio de borda |
| `radius/radius-19` | `19px` | `--radius-19` | Raio de borda |
| `radius/radius-20` | `20px` | `--radius-20` | Raio de borda |
| `radius/radius-22` | `22px` | `--radius-22` | Raio de borda |
| `radius/radius-24` | `24px` | `--radius-24` | Raio de borda |
| `radius/radius-26` | `26px` | `--radius-26` | Raio de borda |
| `radius/radius-30` | `30px` | `--radius-30` | Raio de borda |
| `radius/radius-32` | `32px` | `--radius-32` | Raio de borda |
| `radius/radius-33` | `33px` | `--radius-33` | Raio de borda |
| `radius/radius-34` | `34px` | `--radius-34` | Raio de borda |
| `radius/radius-40` | `40px` | `--radius-40` | Raio de borda |
| `radius/radius-full` | `9999px` | `--radius-full` | Raio totalmente arredondado (pílula / círculo) |

<a id="primitivo-font-family"></a>

### Família tipográfica

| Token (Figma) | Valor | CSS | Descrição |
| --- | --- | --- | --- |
| `font-family/font-family-satoshi` | `Satoshi` | `--font-family-satoshi` | Família principal (UI e títulos) |
| `font-family/font-family-inter` | `Inter` | `--font-family-inter` | Família de apoio (fallback do Figma) |
| `font-family/font-family-ibm-plex-mono` | `IBM Plex Mono` | `--font-family-ibm-plex-mono` | Família monoespaçada (kickers, rótulos) |

<a id="primitivo-font-weight"></a>

### Peso tipográfico

| Token (Figma) | Valor | CSS | Descrição |
| --- | --- | --- | --- |
| `font-weight/font-weight-regular` | `400` | `--font-weight-regular` | Peso regular |
| `font-weight/font-weight-medium` | `500` | `--font-weight-medium` | Peso médio (mais usado) |
| `font-weight/font-weight-semibold` | `600` | `--font-weight-semibold` | Peso semibold |
| `font-weight/font-weight-bold` | `700` | `--font-weight-bold` | Peso bold |

<a id="primitivo-font-size"></a>

### Tamanho de fonte

| Token (Figma) | Valor | CSS | Descrição |
| --- | --- | --- | --- |
| `font-size/font-size-8` | `8px` | `--font-size-8` | Tamanho de fonte |
| `font-size/font-size-9` | `9px` | `--font-size-9` | Tamanho de fonte |
| `font-size/font-size-10` | `10px` | `--font-size-10` | Tamanho de fonte |
| `font-size/font-size-11` | `11px` | `--font-size-11` | Tamanho de fonte |
| `font-size/font-size-12` | `12px` | `--font-size-12` | Tamanho de fonte |
| `font-size/font-size-13` | `13px` | `--font-size-13` | Tamanho de fonte |
| `font-size/font-size-14` | `14px` | `--font-size-14` | Tamanho de fonte |
| `font-size/font-size-15` | `15px` | `--font-size-15` | Tamanho de fonte |
| `font-size/font-size-16` | `16px` | `--font-size-16` | Tamanho de fonte |
| `font-size/font-size-17` | `17px` | `--font-size-17` | Tamanho de fonte |
| `font-size/font-size-18` | `18px` | `--font-size-18` | Tamanho de fonte |
| `font-size/font-size-19` | `19px` | `--font-size-19` | Tamanho de fonte |
| `font-size/font-size-20` | `20px` | `--font-size-20` | Tamanho de fonte |
| `font-size/font-size-21` | `21px` | `--font-size-21` | Tamanho de fonte |
| `font-size/font-size-22` | `22px` | `--font-size-22` | Tamanho de fonte |
| `font-size/font-size-23` | `23px` | `--font-size-23` | Tamanho de fonte |
| `font-size/font-size-26` | `26px` | `--font-size-26` | Tamanho de fonte |
| `font-size/font-size-28` | `28px` | `--font-size-28` | Tamanho de fonte |
| `font-size/font-size-29` | `29px` | `--font-size-29` | Tamanho de fonte |
| `font-size/font-size-34` | `34px` | `--font-size-34` | Tamanho de fonte |
| `font-size/font-size-36` | `36px` | `--font-size-36` | Tamanho de fonte |
| `font-size/font-size-38` | `38px` | `--font-size-38` | Tamanho de fonte |
| `font-size/font-size-40` | `40px` | `--font-size-40` | Tamanho de fonte |
| `font-size/font-size-42` | `42px` | `--font-size-42` | Tamanho de fonte |
| `font-size/font-size-43` | `43px` | `--font-size-43` | Tamanho de fonte |
| `font-size/font-size-44` | `44px` | `--font-size-44` | Tamanho de fonte |
| `font-size/font-size-46` | `46px` | `--font-size-46` | Tamanho de fonte |
| `font-size/font-size-56` | `56px` | `--font-size-56` | Tamanho de fonte |
| `font-size/font-size-66` | `66px` | `--font-size-66` | Tamanho de fonte |

<a id="primitivo-line-height"></a>

### Altura de linha

| Token (Figma) | Valor | CSS | Descrição |
| --- | --- | --- | --- |
| `line-height/line-height-21` | `21px` | `--line-height-21` | Altura de linha fixa |
| `line-height/line-height-22-1` | `22.1px` | `--line-height-22-1` | Altura de linha fixa |
| `line-height/line-height-34` | `34px` | `--line-height-34` | Altura de linha fixa |
| `line-height/line-height-36` | `36px` | `--line-height-36` | Altura de linha fixa |
| `line-height/line-height-38` | `38px` | `--line-height-38` | Altura de linha fixa |
| `line-height/line-height-40` | `40px` | `--line-height-40` | Altura de linha fixa |
| `line-height/line-height-46` | `46px` | `--line-height-46` | Altura de linha fixa |
| `line-height/line-height-ratio-100` | `1` | `--line-height-ratio-100` | Altura de linha relativa (100% do tamanho da fonte) |
| `line-height/line-height-ratio-105` | `1.05` | `--line-height-ratio-105` | Altura de linha relativa (105% do tamanho da fonte) |
| `line-height/line-height-ratio-110` | `1.1` | `--line-height-ratio-110` | Altura de linha relativa (110% do tamanho da fonte) |
| `line-height/line-height-ratio-115` | `1.15` | `--line-height-ratio-115` | Altura de linha relativa (115% do tamanho da fonte) |
| `line-height/line-height-ratio-120` | `1.2` | `--line-height-ratio-120` | Altura de linha relativa (120% do tamanho da fonte) |
| `line-height/line-height-ratio-125` | `1.25` | `--line-height-ratio-125` | Altura de linha relativa (125% do tamanho da fonte) |
| `line-height/line-height-ratio-130` | `1.3` | `--line-height-ratio-130` | Altura de linha relativa (130% do tamanho da fonte) |
| `line-height/line-height-ratio-135` | `1.35` | `--line-height-ratio-135` | Altura de linha relativa (135% do tamanho da fonte) |
| `line-height/line-height-ratio-140` | `1.4` | `--line-height-ratio-140` | Altura de linha relativa (140% do tamanho da fonte) |

<a id="primitivo-letter-spacing"></a>

### Espaçamento entre letras

| Token (Figma) | Valor | CSS | Descrição |
| --- | --- | --- | --- |
| `letter-spacing/letter-spacing-negative-3` | `-3px` | `--letter-spacing-negative-3` | Espaçamento entre letras (tracking) |
| `letter-spacing/letter-spacing-negative-2-4` | `-2.4px` | `--letter-spacing-negative-2-4` | Espaçamento entre letras (tracking) |
| `letter-spacing/letter-spacing-negative-2-07` | `-2.07px` | `--letter-spacing-negative-2-07` | Espaçamento entre letras (tracking) |
| `letter-spacing/letter-spacing-negative-1-9` | `-1.9px` | `--letter-spacing-negative-1-9` | Espaçamento entre letras (tracking) |
| `letter-spacing/letter-spacing-negative-1-8` | `-1.8px` | `--letter-spacing-negative-1-8` | Espaçamento entre letras (tracking) |
| `letter-spacing/letter-spacing-negative-1-72` | `-1.72px` | `--letter-spacing-negative-1-72` | Espaçamento entre letras (tracking) |
| `letter-spacing/letter-spacing-negative-1-71` | `-1.71px` | `--letter-spacing-negative-1-71` | Espaçamento entre letras (tracking) |
| `letter-spacing/letter-spacing-negative-1-7` | `-1.7px` | `--letter-spacing-negative-1-7` | Espaçamento entre letras (tracking) |
| `letter-spacing/letter-spacing-negative-1-6` | `-1.6px` | `--letter-spacing-negative-1-6` | Espaçamento entre letras (tracking) |
| `letter-spacing/letter-spacing-negative-1-44` | `-1.44px` | `--letter-spacing-negative-1-44` | Espaçamento entre letras (tracking) |
| `letter-spacing/letter-spacing-negative-1-4` | `-1.4px` | `--letter-spacing-negative-1-4` | Espaçamento entre letras (tracking) |
| `letter-spacing/letter-spacing-negative-1-36` | `-1.36px` | `--letter-spacing-negative-1-36` | Espaçamento entre letras (tracking) |
| `letter-spacing/letter-spacing-negative-1-3` | `-1.3px` | `--letter-spacing-negative-1-3` | Espaçamento entre letras (tracking) |
| `letter-spacing/letter-spacing-negative-1-015` | `-1.015px` | `--letter-spacing-negative-1-015` | Espaçamento entre letras (tracking) |
| `letter-spacing/letter-spacing-negative-1` | `-1px` | `--letter-spacing-negative-1` | Espaçamento entre letras (tracking) |
| `letter-spacing/letter-spacing-negative-0-8` | `-0.8px` | `--letter-spacing-negative-0-8` | Espaçamento entre letras (tracking) |
| `letter-spacing/letter-spacing-negative-0-66` | `-0.66px` | `--letter-spacing-negative-0-66` | Espaçamento entre letras (tracking) |
| `letter-spacing/letter-spacing-negative-0-6` | `-0.6px` | `--letter-spacing-negative-0-6` | Espaçamento entre letras (tracking) |
| `letter-spacing/letter-spacing-negative-0-54` | `-0.54px` | `--letter-spacing-negative-0-54` | Espaçamento entre letras (tracking) |
| `letter-spacing/letter-spacing-negative-0-5` | `-0.5px` | `--letter-spacing-negative-0-5` | Espaçamento entre letras (tracking) |
| `letter-spacing/letter-spacing-negative-0-42` | `-0.42px` | `--letter-spacing-negative-0-42` | Espaçamento entre letras (tracking) |
| `letter-spacing/letter-spacing-negative-0-24` | `-0.24px` | `--letter-spacing-negative-0-24` | Espaçamento entre letras (tracking) |
| `letter-spacing/letter-spacing-negative-0-2` | `-0.2px` | `--letter-spacing-negative-0-2` | Espaçamento entre letras (tracking) |
| `letter-spacing/letter-spacing-0` | `0px` | `--letter-spacing-0` | Espaçamento entre letras (tracking) |
| `letter-spacing/letter-spacing-0-6` | `0.6px` | `--letter-spacing-0-6` | Espaçamento entre letras (tracking) |
| `letter-spacing/letter-spacing-0-8` | `0.8px` | `--letter-spacing-0-8` | Espaçamento entre letras (tracking) |
| `letter-spacing/letter-spacing-1-1` | `1.1px` | `--letter-spacing-1-1` | Espaçamento entre letras (tracking) |

<a id="primitivo-stroke"></a>

### Traço (stroke)

| Token (Figma) | Valor | CSS | Descrição |
| --- | --- | --- | --- |
| `stroke/stroke-0` | `0px` | `--stroke-0` | Espessura de traço (borda, ring, ícone) |
| `stroke/stroke-1` | `1px` | `--stroke-1` | Espessura de traço (borda, ring, ícone) |
| `stroke/stroke-1-5` | `1.5px` | `--stroke-1-5` | Espessura de traço (borda, ring, ícone) |
| `stroke/stroke-1-6` | `1.6px` | `--stroke-1-6` | Espessura de traço (borda, ring, ícone) |
| `stroke/stroke-1-7` | `1.7px` | `--stroke-1-7` | Espessura de traço (borda, ring, ícone) |
| `stroke/stroke-1-8` | `1.8px` | `--stroke-1-8` | Espessura de traço (borda, ring, ícone) |
| `stroke/stroke-2` | `2px` | `--stroke-2` | Espessura de traço (borda, ring, ícone) |
| `stroke/stroke-2-2` | `2.2px` | `--stroke-2-2` | Espessura de traço (borda, ring, ícone) |
| `stroke/stroke-2-4` | `2.4px` | `--stroke-2-4` | Espessura de traço (borda, ring, ícone) |
| `stroke/stroke-11` | `11px` | `--stroke-11` | Espessura de traço (borda, ring, ícone) |

<a id="primitivo-size"></a>

### Dimensão

| Token (Figma) | Valor | CSS | Descrição |
| --- | --- | --- | --- |
| `size/size-5` | `5px` | `--size-5` | Dimensão fixa (ícones, controles, alturas) |
| `size/size-7` | `7px` | `--size-7` | Dimensão fixa (ícones, controles, alturas) |
| `size/size-10` | `10px` | `--size-10` | Dimensão fixa (ícones, controles, alturas) |
| `size/size-16` | `16px` | `--size-16` | Dimensão fixa (ícones, controles, alturas) |
| `size/size-22` | `22px` | `--size-22` | Dimensão fixa (ícones, controles, alturas) |
| `size/size-24` | `24px` | `--size-24` | Dimensão fixa (ícones, controles, alturas) |
| `size/size-26` | `26px` | `--size-26` | Dimensão fixa (ícones, controles, alturas) |
| `size/size-28` | `28px` | `--size-28` | Dimensão fixa (ícones, controles, alturas) |
| `size/size-30` | `30px` | `--size-30` | Dimensão fixa (ícones, controles, alturas) |
| `size/size-32` | `32px` | `--size-32` | Dimensão fixa (ícones, controles, alturas) |
| `size/size-36` | `36px` | `--size-36` | Dimensão fixa (ícones, controles, alturas) |
| `size/size-38` | `38px` | `--size-38` | Dimensão fixa (ícones, controles, alturas) |
| `size/size-40` | `40px` | `--size-40` | Dimensão fixa (ícones, controles, alturas) |
| `size/size-44` | `44px` | `--size-44` | Dimensão fixa (ícones, controles, alturas) |
| `size/size-48` | `48px` | `--size-48` | Dimensão fixa (ícones, controles, alturas) |
| `size/size-52` | `52px` | `--size-52` | Dimensão fixa (ícones, controles, alturas) |
| `size/size-56` | `56px` | `--size-56` | Dimensão fixa (ícones, controles, alturas) |
| `size/size-76` | `76px` | `--size-76` | Dimensão fixa (ícones, controles, alturas) |
| `size/size-84` | `84px` | `--size-84` | Dimensão fixa (ícones, controles, alturas) |
| `size/size-104` | `104px` | `--size-104` | Dimensão fixa (ícones, controles, alturas) |
| `size/size-238` | `238px` | `--size-238` | Dimensão fixa (ícones, controles, alturas) |

<a id="primitivo-opacity"></a>

### Opacidade

| Token (Figma) | Valor | CSS | Descrição |
| --- | --- | --- | --- |
| `opacity/opacity-0` | `0%` | `--opacity-0` | Opacidade em % |
| `opacity/opacity-3` | `3%` | `--opacity-3` | Opacidade em % |
| `opacity/opacity-5` | `5%` | `--opacity-5` | Opacidade em % |
| `opacity/opacity-14` | `14%` | `--opacity-14` | Opacidade em % |
| `opacity/opacity-35` | `35%` | `--opacity-35` | Opacidade em % |
| `opacity/opacity-40` | `40%` | `--opacity-40` | Opacidade em % |
| `opacity/opacity-50` | `50%` | `--opacity-50` | Opacidade em % |
| `opacity/opacity-60` | `60%` | `--opacity-60` | Opacidade em % |
| `opacity/opacity-100` | `100%` | `--opacity-100` | Opacidade em % |

<a id="primitivo-blur"></a>

### Desfoque

| Token (Figma) | Valor | CSS | Descrição |
| --- | --- | --- | --- |
| `blur/blur-0` | `0px` | `--blur-0` | Raio de desfoque (sombra / backdrop) |
| `blur/blur-2` | `2px` | `--blur-2` | Raio de desfoque (sombra / backdrop) |
| `blur/blur-16` | `16px` | `--blur-16` | Raio de desfoque (sombra / backdrop) |
| `blur/blur-24` | `24px` | `--blur-24` | Raio de desfoque (sombra / backdrop) |
| `blur/blur-40` | `40px` | `--blur-40` | Raio de desfoque (sombra / backdrop) |

<a id="primitivo-duration"></a>

### Duração

| Token (Figma) | Valor | CSS | Descrição |
| --- | --- | --- | --- |
| `duration/duration-180` | `180ms` | `--duration-180` | Duração de animação |
| `duration/duration-200` | `200ms` | `--duration-200` | Duração de animação |
| `duration/duration-220` | `220ms` | `--duration-220` | Duração de animação |
| `duration/duration-260` | `260ms` | `--duration-260` | Duração de animação |
| `duration/duration-300` | `300ms` | `--duration-300` | Duração de animação |
| `duration/duration-340` | `340ms` | `--duration-340` | Duração de animação |
| `duration/duration-360` | `360ms` | `--duration-360` | Duração de animação |
| `duration/duration-380` | `380ms` | `--duration-380` | Duração de animação |
| `duration/duration-420` | `420ms` | `--duration-420` | Duração de animação |
| `duration/duration-560` | `560ms` | `--duration-560` | Duração de animação |
| `duration/duration-650` | `650ms` | `--duration-650` | Duração de animação |
| `duration/duration-700` | `700ms` | `--duration-700` | Duração de animação |
| `duration/duration-900` | `900ms` | `--duration-900` | Duração de animação |
| `duration/duration-1000` | `1000ms` | `--duration-1000` | Duração de animação |
| `duration/duration-1200` | `1200ms` | `--duration-1200` | Duração de animação |
| `duration/duration-1400` | `1400ms` | `--duration-1400` | Duração de animação |
| `duration/duration-2400` | `2400ms` | `--duration-2400` | Duração de animação |

<a id="primitivo-easing"></a>

### Curva de animação

| Token (Figma) | Valor | CSS | Descrição |
| --- | --- | --- | --- |
| `easing/easing-standard` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | `--easing-standard` | Saída suave (padrão das entradas) |
| `easing/easing-sheet` | `cubic-bezier(0.2, 0.9, 0.25, 1)` | `--easing-sheet` | Subida do bottom sheet |
| `easing/easing-message` | `cubic-bezier(0.2, 0.9, 0.3, 1.1)` | `--easing-message` | Entrada de mensagens do assistente |
| `easing/easing-spring` | `cubic-bezier(0.3, 1.4, 0.5, 1)` | `--easing-spring` | Mola (switch) |
| `easing/easing-bounce` | `cubic-bezier(0.3, 1.3, 0.5, 1)` | `--easing-bounce` | Quique (toast) |
| `easing/easing-accelerate` | `cubic-bezier(0.4, 0, 1, 1)` | `--easing-accelerate` | Saída acelerada (fechar sheet) |

<a id="primitivo-breakpoint"></a>

### Breakpoint

| Token (Figma) | Valor | CSS | Descrição |
| --- | --- | --- | --- |
| `breakpoint/breakpoint-800` | `800px` | `--breakpoint-800` | Tablet / desktop pequeno |
| `breakpoint/breakpoint-1100` | `1100px` | `--breakpoint-1100` | Desktop |
| `breakpoint/breakpoint-1440` | `1440px` | `--breakpoint-1440` | Desktop largo |
| `breakpoint/breakpoint-1920` | `1920px` | `--breakpoint-1920` | Full HD |

<a id="primitivo-z-index"></a>

### Camada (z-index)

| Token (Figma) | Valor | CSS | Descrição |
| --- | --- | --- | --- |
| `z-index/z-index-40` | `40` | `--z-index-40` | Camada 40 |
| `z-index/z-index-50` | `50` | `--z-index-50` | Camada 50 |

## Tokens semânticos

<a id="semantico-color-background"></a>

### color/background

| Token (Figma) | Alias → primitivo | Valor resolvido | CSS | Uso |
| --- | --- | --- | --- | --- |
| `color/background/bg-canvas` | `color/neutral-990` | `#030303` | `--color-bg-canvas` | Fundo raiz da página (html) |
| `color/background/bg-screen` | `color/neutral-950` | `#0A0A0C` | `--color-bg-screen` | Fundo das telas internas |
| `color/background/bg-surface` | `color/neutral-920` | `#151518` | `--color-bg-surface` | Painéis, listas e sheets |
| `color/background/bg-elevated` | `color/neutral-900` | `#18181B` | `--color-bg-elevated` | Inputs, chips inativos, botão dark |
| `color/background/bg-elevated-hover` | `color/neutral-860` | `#1F1F23` | `--color-bg-elevated-hover` | Hover de superfícies elevadas |
| `color/background/bg-control` | `color/neutral-890` | `#1A1A1D` | `--color-bg-control` | Botões redondos (RoundButton) |
| `color/background/bg-control-hover` | `color/neutral-840` | `#232327` | `--color-bg-control-hover` | Hover de botões redondos |
| `color/background/bg-tile` | `color/neutral-885` | `#1C1C1C` | `--color-bg-tile` | Tiles de categoria e cartões |
| `color/background/bg-row-icon` | `color/neutral-820` | `#242428` | `--color-bg-row-icon` | Quadro do ícone em linhas de lista |
| `color/background/bg-track` | `color/neutral-800` | `#26262A` | `--color-bg-track` | Trilho do switch e handle do sheet |
| `color/background/bg-track-subtle` | `color/neutral-880` | `#1C1C1F` | `--color-bg-track-subtle` | Trilho da barra de progresso |
| `color/background/bg-track-inverse` | `color/ink-alpha-14` | `#0A0A0A @ 14%` | `--color-bg-track-inverse` | Trilho sobre fundos claros (ring / progresso ink) |
| `color/background/bg-inverse` | `color/sand-100` | `#F1F1EE` | `--color-bg-inverse` | Superfície clara (toast) |
| `color/background/bg-overlay` | `color/black-alpha-70` | `#000000 @ 70%` | `--color-bg-overlay` | Véu atrás do sheet |
| `color/background/bg-hover-subtle` | `color/white-alpha-3` | `#FFFFFF @ 3%` | `--color-bg-hover-subtle` | Hover de linhas clicáveis |
| `color/background/bg-pressed-subtle` | `color/white-alpha-5` | `#FFFFFF @ 5%` | `--color-bg-pressed-subtle` | Pressionado de linhas clicáveis |
| `color/background/bg-skeleton` | `color/neutral-880` | `#1C1C1F` | `--color-bg-skeleton` | Base do skeleton |
| `color/background/bg-skeleton-highlight` | `color/neutral-750` | `#2A2A2F` | `--color-bg-skeleton-highlight` | Brilho do skeleton |
| `color/background/bg-brand-primary` | `color/lime-200` | `#E5FFB5` | `--color-bg-brand-primary` | Ação primária (botão lime, chip ativo, switch on) |
| `color/background/bg-brand-primary-soft` | `color/lime-100` | `#EAFEBD` | `--color-bg-brand-primary-soft` | Lime suave (ActionRow, progresso) |
| `color/background/bg-brand-secondary` | `color/lilac-100` | `#D8CCFA` | `--color-bg-brand-secondary` | Lilás (avatar com iniciais) |
| `color/background/bg-brand-secondary-strong` | `color/lilac-400` | `#BFA9FE` | `--color-bg-brand-secondary-strong` | Lilás forte |
| `color/background/bg-ink` | `color/neutral-960` | `#0A0A0A` | `--color-bg-ink` | Preenchimento escuro sobre fundos claros |

<a id="semantico-color-text"></a>

### color/text

| Token (Figma) | Alias → primitivo | Valor resolvido | CSS | Uso |
| --- | --- | --- | --- | --- |
| `color/text/text-primary` | `color/neutral-0` | `#FFFFFF` | `--color-text-primary` | Texto principal |
| `color/text/text-secondary` | `color/neutral-50` | `#F2F2F2` | `--color-text-secondary` | Texto secundário de alto contraste |
| `color/text/text-muted` | `color/neutral-400` | `#9A9A9A` | `--color-text-muted` | Rótulos e textos de apoio |
| `color/text/text-subtle` | `color/neutral-550` | `#85858A` | `--color-text-subtle` | Subtítulos e placeholders |
| `color/text/text-inverse` | `color/neutral-960` | `#0A0A0A` | `--color-text-inverse` | Texto sobre fundos claros (ink) |
| `color/text/text-inverse-secondary` | `color/neutral-700` | `#333333` | `--color-text-inverse-secondary` | Texto secundário sobre fundos claros |
| `color/text/text-link` | `color/lime-100` | `#EAFEBD` | `--color-text-link` | Links (LinkButton) |
| `color/text/text-accent` | `color/lime-200` | `#E5FFB5` | `--color-text-accent` | Destaque positivo |
| `color/text/text-error` | `color/lilac-100` | `#D8CCFA` | `--color-text-error` | Mensagens de erro e ação destrutiva |

<a id="semantico-color-icon"></a>

### color/icon

| Token (Figma) | Alias → primitivo | Valor resolvido | CSS | Uso |
| --- | --- | --- | --- | --- |
| `color/icon/icon-primary` | `color/neutral-0` | `#FFFFFF` | `--color-icon-primary` | Ícone sobre fundo escuro |
| `color/icon/icon-muted` | `color/neutral-400` | `#9A9A9A` | `--color-icon-muted` | Ícone secundário |
| `color/icon/icon-inverse` | `color/neutral-960` | `#0A0A0A` | `--color-icon-inverse` | Ícone sobre fundo claro |

<a id="semantico-color-border"></a>

### color/border

| Token (Figma) | Alias → primitivo | Valor resolvido | CSS | Uso |
| --- | --- | --- | --- | --- |
| `color/border/border-default` | `color/neutral-880` | `#1C1C1F` | `--color-border-default` | Borda padrão |
| `color/border/border-strong` | `color/neutral-800` | `#26262A` | `--color-border-strong` | Ring de inputs, chips e estado vazio |
| `color/border/border-focus` | `color/lime-200` | `#E5FFB5` | `--color-border-focus` | Foco (focus-visible, input focado) |
| `color/border/border-error` | `color/lilac-100` | `#D8CCFA` | `--color-border-error` | Ring de campo com erro |

<a id="semantico-color-feedback"></a>

### color/feedback

| Token (Figma) | Alias → primitivo | Valor resolvido | CSS | Uso |
| --- | --- | --- | --- | --- |
| `color/feedback/feedback-success` | `color/lime-200` | `#E5FFB5` | `--color-feedback-success` | Ícone de sucesso (toast) |
| `color/feedback/feedback-error` | `color/lilac-400` | `#BFA9FE` | `--color-feedback-error` | Ícone de erro (toast) |
| `color/feedback/feedback-info` | `color/lilac-100` | `#D8CCFA` | `--color-feedback-info` | Ícone de informação (toast) |

<a id="semantico-color-category"></a>

### color/category

| Token (Figma) | Alias → primitivo | Valor resolvido | CSS | Uso |
| --- | --- | --- | --- | --- |
| `color/category/category-moradia` | `color/lilac-100` | `#D8CCFA` | `--color-category-moradia` | Categoria Moradia |
| `color/category/category-alimentacao` | `color/lime-200` | `#E5FFB5` | `--color-category-alimentacao` | Categoria Alimentação |
| `color/category/category-transporte` | `color/sand-100` | `#F1F1EE` | `--color-category-transporte` | Categoria Transporte |
| `color/category/category-lazer` | `color/lilac-400` | `#BFA9FE` | `--color-category-lazer` | Categoria Lazer |
| `color/category/category-assinaturas` | `color/mauve-200` | `#C9C3DC` | `--color-category-assinaturas` | Categoria Assinaturas |
| `color/category/category-saude` | `color/sage-200` | `#D6E6C4` | `--color-category-saude` | Categoria Saúde |
| `color/category/category-outros` | `color/neutral-500` | `#8F8F96` | `--color-category-outros` | Categoria Outros |

<a id="semantico-color-gradient"></a>

### color/gradient

| Token (Figma) | Alias → primitivo | Valor resolvido | CSS | Uso |
| --- | --- | --- | --- | --- |
| `color/gradient/gradient-hero-start` | `color/lilac-400` | `#BFA9FE` | `--color-gradient-hero-start` | Gradiente hero — início |
| `color/gradient/gradient-hero-middle` | `color/lilac-100` | `#D8CCFA` | `--color-gradient-hero-middle` | Gradiente hero — meio |
| `color/gradient/gradient-hero-end` | `color/lime-200` | `#E5FFB5` | `--color-gradient-hero-end` | Gradiente hero — fim |
| `color/gradient/gradient-feature-start` | `color/lilac-300` | `#BBAAF8` | `--color-gradient-feature-start` | Gradiente feature/insight — início |
| `color/gradient/gradient-feature-middle` | `color/lilac-150` | `#D6CCF7` | `--color-gradient-feature-middle` | Gradiente feature/insight — meio |
| `color/gradient/gradient-feature-end` | `color/lime-100` | `#EAFEBD` | `--color-gradient-feature-end` | Gradiente feature/insight — fim |

<a id="semantico-color-shadow"></a>

### color/shadow

| Token (Figma) | Alias → primitivo | Valor resolvido | CSS | Uso |
| --- | --- | --- | --- | --- |
| `color/shadow/shadow-elevated` | `color/black-alpha-50` | `#000000 @ 50%` | `--color-shadow-elevated` | Sombra de elementos flutuantes (toast) |
| `color/shadow/shadow-bar` | `color/black-alpha-25` | `#000000 @ 25%` | `--color-shadow-bar` | Sombra da barra inferior |
| `color/shadow/shadow-glow-brand` | `color/lime-alpha-18` | `#E5FFB5 @ 18%` | `--color-shadow-glow-brand` | Brilho do chip ativo |
| `color/shadow/shadow-glow-pulse` | `color/lime-alpha-12` | `#E5FFB5 @ 12%` | `--color-shadow-glow-pulse` | Pulso de brilho (animate-glow) |

<a id="semantico-spacing-gap"></a>

### spacing/gap

| Token (Figma) | Alias → primitivo | Valor resolvido | CSS | Uso |
| --- | --- | --- | --- | --- |
| `spacing/gap/gap-3xs` | `space/space-2` | `2px` | `--spacing-gap-3xs` | Gap mínimo (título ↔ subtítulo) |
| `spacing/gap/gap-2xs` | `space/space-4` | `4px` | `--spacing-gap-2xs` | Gap 4 |
| `spacing/gap/gap-xs` | `space/space-8` | `8px` | `--spacing-gap-xs` | Label ↔ controle, ícone ↔ texto |
| `spacing/gap/gap-sm` | `space/space-12` | `12px` | `--spacing-gap-sm` | Gap padrão entre itens (mais usado) |
| `spacing/gap/gap-md` | `space/space-16` | `16px` | `--spacing-gap-md` | Gap entre grupos |
| `spacing/gap/gap-lg` | `space/space-20` | `20px` | `--spacing-gap-lg` | Gap 20 |
| `spacing/gap/gap-xl` | `space/space-24` | `24px` | `--spacing-gap-xl` | Gap entre seções / colunas |
| `spacing/gap/gap-2xl` | `space/space-32` | `32px` | `--spacing-gap-2xl` | Gap 32 |
| `spacing/gap/gap-3xl` | `space/space-40` | `40px` | `--spacing-gap-3xl` | Gap 40 |
| `spacing/gap/gap-4xl` | `space/space-48` | `48px` | `--spacing-gap-4xl` | Gap entre colunas no desktop |
| `spacing/gap/gap-action-row` | `space/space-10` | `10px` | `--spacing-gap-action-row` | Gap do ActionRow |

<a id="semantico-spacing-inset"></a>

### spacing/inset

| Token (Figma) | Alias → primitivo | Valor resolvido | CSS | Uso |
| --- | --- | --- | --- | --- |
| `spacing/inset/inset-control-x` | `space/space-16` | `16px` | `--spacing-inset-control-x` | Padding horizontal de input e chip |
| `spacing/inset/inset-money-x` | `space/space-20` | `20px` | `--spacing-inset-money-x` | Padding horizontal do MoneyInput |
| `spacing/inset/inset-card` | `space/space-24` | `24px` | `--spacing-inset-card` | Padding de cards e sheet (mobile) |
| `spacing/inset/inset-card-lg` | `space/space-32` | `32px` | `--spacing-inset-card-lg` | Padding de cards e sheet (desktop) |
| `spacing/inset/inset-panel-x` | `space/space-14` | `14px` | `--spacing-inset-panel-x` | Padding horizontal do ListPanel |
| `spacing/inset/inset-panel-y` | `space/space-10` | `10px` | `--spacing-inset-panel-y` | Padding vertical do ListPanel |
| `spacing/inset/inset-toast-y` | `space/space-12` | `12px` | `--spacing-inset-toast-y` | Padding vertical do toast |

<a id="semantico-spacing-layout"></a>

### spacing/layout

| Token (Figma) | Alias → primitivo | Valor resolvido | CSS | Uso |
| --- | --- | --- | --- | --- |
| `spacing/layout/page-gutter` | `space/space-26` | `26px` | `--spacing-page-gutter` | Margem lateral da página (mobile) |
| `spacing/layout/page-gutter-wide` | `space/space-32` | `32px` | `--spacing-page-gutter-wide` | Margem lateral larga (mobile) |
| `spacing/layout/page-gutter-md` | `space/space-40` | `40px` | `--spacing-page-gutter-md` | Margem lateral a partir de 800px |
| `spacing/layout/page-gutter-lg` | `space/space-56` | `56px` | `--spacing-page-gutter-lg` | Margem lateral a partir de 1100px |
| `spacing/layout/page-gutter-3xl` | `space/space-64` | `64px` | `--spacing-page-gutter-3xl` | Margem lateral a partir de 1920px |
| `spacing/layout/page-bottom` | `space/space-64` | `64px` | `--spacing-page-bottom` | Respiro inferior da página |
| `spacing/layout/header-top` | `space/space-20` | `20px` | `--spacing-header-top` | Topo do cabeçalho (mobile) |
| `spacing/layout/header-top-md` | `space/space-40` | `40px` | `--spacing-header-top-md` | Topo do cabeçalho (desktop) |
| `spacing/layout/section-gap` | `space/space-24` | `24px` | `--spacing-section-gap` | Distância entre seções |

<a id="semantico-spacing-offset"></a>

### spacing/offset

| Token (Figma) | Alias → primitivo | Valor resolvido | CSS | Uso |
| --- | --- | --- | --- | --- |
| `spacing/offset/offset-panel-bleed` | `space/space-negative-14` | `-14px` | `--spacing-offset-panel-bleed` | Sangria lateral do ListPanel (-mx) |
| `spacing/offset/offset-hero-overlap` | `space/space-negative-180` | `-180px` | `--spacing-offset-hero-overlap` | Sobreposição do hero (-mb) |
| `spacing/offset/offset-typing-lift` | `space/space-negative-4` | `-4px` | `--spacing-offset-typing-lift` | Pulo dos pontos de digitação |

<a id="semantico-radius"></a>

### radius

| Token (Figma) | Alias → primitivo | Valor resolvido | CSS | Uso |
| --- | --- | --- | --- | --- |
| `radius/radius-handle` | `radius/radius-3` | `3px` | `--radius-handle` | Handle do sheet |
| `radius/radius-progress` | `radius/radius-4` | `4px` | `--radius-progress` | Barra de progresso |
| `radius/radius-skeleton-sm` | `radius/radius-12` | `12px` | `--radius-skeleton-sm` | Skeleton de texto |
| `radius/radius-input` | `radius/radius-18` | `18px` | `--radius-input` | Inputs de texto |
| `radius/radius-control-sm` | `radius/radius-19` | `19px` | `--radius-control-sm` | Botão redondo pequeno (38px) |
| `radius/radius-chip` | `radius/radius-20` | `20px` | `--radius-chip` | Chips |
| `radius/radius-button` | `radius/radius-22` | `22px` | `--radius-button` | Botões, MoneyInput, toast, RoundButton |
| `radius/radius-row` | `radius/radius-24` | `24px` | `--radius-row` | Linhas de lista e ícone de linha |
| `radius/radius-tile` | `radius/radius-26` | `26px` | `--radius-tile` | ActionRow, estado vazio, skeleton |
| `radius/radius-panel` | `radius/radius-32` | `32px` | `--radius-panel` | Topo do ListPanel e sheet |
| `radius/radius-feature` | `radius/radius-34` | `34px` | `--radius-feature` | FeatureCard |
| `radius/radius-panel-bottom` | `radius/radius-40` | `40px` | `--radius-panel-bottom` | Base do ListPanel |
| `radius/radius-pill` | `radius/radius-full` | `9999px` | `--radius-pill` | Pílula / círculo (avatar, switch) |

<a id="semantico-border-width"></a>

### border-width

| Token (Figma) | Alias → primitivo | Valor resolvido | CSS | Uso |
| --- | --- | --- | --- | --- |
| `border-width/border-width-default` | `stroke/stroke-1` | `1px` | `--border-width-default` | Borda / ring padrão |
| `border-width/border-width-strong` | `stroke/stroke-2` | `2px` | `--border-width-strong` | Spinner e foco |
| `border-width/focus-ring-width` | `stroke/stroke-2` | `2px` | `--border-width-focus-ring-width` | Outline de focus-visible |
| `border-width/icon-stroke-thin` | `stroke/stroke-1-6` | `1.6px` | `--border-width-icon-stroke-thin` | Ícones de navegação (voltar) |
| `border-width/icon-stroke-regular` | `stroke/stroke-1-8` | `1.8px` | `--border-width-icon-stroke-regular` | Ícones padrão |
| `border-width/icon-stroke-bold` | `stroke/stroke-2-4` | `2.4px` | `--border-width-icon-stroke-bold` | Ícones de confirmação |
| `border-width/ring-stroke` | `stroke/stroke-11` | `11px` | `--border-width-ring-stroke` | Traço do anel de meta (Ring) |

<a id="semantico-size"></a>

### size

| Token (Figma) | Alias → primitivo | Valor resolvido | CSS | Uso |
| --- | --- | --- | --- | --- |
| `size/size-spinner` | `size/size-16` | `16px` | `--size-spinner` | Spinner |
| `size/size-toast-icon` | `size/size-28` | `28px` | `--size-toast-icon` | Ícone do toast |
| `size/size-control-sm` | `size/size-38` | `38px` | `--size-control-sm` | Botão redondo pequeno |
| `size/size-chip-height` | `size/size-40` | `40px` | `--size-chip-height` | Altura do chip |
| `size/size-control` | `size/size-44` | `44px` | `--size-control` | Botão redondo / avatar padrão |
| `size/size-row-icon` | `size/size-48` | `48px` | `--size-row-icon` | Ícone de linha de lista |
| `size/size-input-height` | `size/size-52` | `52px` | `--size-input-height` | Altura de input |
| `size/size-button-height` | `size/size-56` | `56px` | `--size-button-height` | Altura do botão primário |
| `size/size-row-min-height` | `size/size-76` | `76px` | `--size-row-min-height` | Altura mínima da linha de lista |
| `size/size-action-tile` | `size/size-84` | `84px` | `--size-action-tile` | Quadrado do ActionRow |
| `size/size-ring` | `size/size-104` | `104px` | `--size-ring` | Anel de meta |
| `size/size-feature-min-height` | `size/size-238` | `238px` | `--size-feature-min-height` | Altura mínima do FeatureCard |
| `size/switch-width` | `size/size-52` | `52px` | `--size-switch-width` | Largura do switch |
| `size/switch-height` | `size/size-30` | `30px` | `--size-switch-height` | Altura do switch |
| `size/switch-thumb` | `size/size-24` | `24px` | `--size-switch-thumb` | Bolinha do switch |
| `size/handle-width` | `size/size-44` | `44px` | `--size-handle-width` | Largura do handle do sheet |
| `size/handle-height` | `size/size-5` | `5px` | `--size-handle-height` | Altura do handle do sheet |

<a id="semantico-typography"></a>

### typography

| Token (Figma) | Alias → primitivo | Valor resolvido | CSS | Uso |
| --- | --- | --- | --- | --- |
| `typography/font-family-sans` | `font-family/font-family-satoshi` | `Satoshi` | `--typography-font-family-sans` | Família de UI |
| `typography/font-family-mono` | `font-family/font-family-ibm-plex-mono` | `IBM Plex Mono` | `--typography-font-family-mono` | Família monoespaçada |
| `typography/font-weight-regular` | `font-weight/font-weight-regular` | `400` | `--typography-font-weight-regular` | Texto corrido |
| `typography/font-weight-medium` | `font-weight/font-weight-medium` | `500` | `--typography-font-weight-medium` | Títulos, botões, rótulos |
| `typography/font-weight-bold` | `font-weight/font-weight-bold` | `700` | `--typography-font-weight-bold` | Números de destaque |

<a id="semantico-typography-display-money"></a>

### typography/display-money

| Token (Figma) | Alias → primitivo | Valor resolvido | CSS | Uso |
| --- | --- | --- | --- | --- |
| `typography/display-money/font-family` | `font-family/font-family-satoshi` | `Satoshi` | `--typography-display-money-font-family` | Valor grande do MoneyInput |
| `typography/display-money/font-size` | `font-size/font-size-42` | `42px` | `--typography-display-money-font-size` | Valor grande do MoneyInput |
| `typography/display-money/font-weight` | `font-weight/font-weight-medium` | `500` | `--typography-display-money-font-weight` | Valor grande do MoneyInput |
| `typography/display-money/letter-spacing` | `letter-spacing/letter-spacing-negative-1-7` | `-1.7px` | `--typography-display-money-letter-spacing` | Valor grande do MoneyInput |

<a id="semantico-typography-heading-screen-xl"></a>

### typography/heading-screen-xl

| Token (Figma) | Alias → primitivo | Valor resolvido | CSS | Uso |
| --- | --- | --- | --- | --- |
| `typography/heading-screen-xl/font-family` | `font-family/font-family-satoshi` | `Satoshi` | `--typography-heading-screen-xl-font-family` | Título de tela ≥1920px |
| `typography/heading-screen-xl/font-size` | `font-size/font-size-42` | `42px` | `--typography-heading-screen-xl-font-size` | Título de tela ≥1920px |
| `typography/heading-screen-xl/font-weight` | `font-weight/font-weight-medium` | `500` | `--typography-heading-screen-xl-font-weight` | Título de tela ≥1920px |
| `typography/heading-screen-xl/letter-spacing` | `letter-spacing/letter-spacing-negative-1-3` | `-1.3px` | `--typography-heading-screen-xl-letter-spacing` | Título de tela ≥1920px |

<a id="semantico-typography-heading-screen-lg"></a>

### typography/heading-screen-lg

| Token (Figma) | Alias → primitivo | Valor resolvido | CSS | Uso |
| --- | --- | --- | --- | --- |
| `typography/heading-screen-lg/font-family` | `font-family/font-family-satoshi` | `Satoshi` | `--typography-heading-screen-lg-font-family` | Título de tela ≥800px |
| `typography/heading-screen-lg/font-size` | `font-size/font-size-36` | `36px` | `--typography-heading-screen-lg-font-size` | Título de tela ≥800px |
| `typography/heading-screen-lg/font-weight` | `font-weight/font-weight-medium` | `500` | `--typography-heading-screen-lg-font-weight` | Título de tela ≥800px |
| `typography/heading-screen-lg/letter-spacing` | `letter-spacing/letter-spacing-negative-1-3` | `-1.3px` | `--typography-heading-screen-lg-letter-spacing` | Título de tela ≥800px |

<a id="semantico-typography-heading-screen"></a>

### typography/heading-screen

| Token (Figma) | Alias → primitivo | Valor resolvido | CSS | Uso |
| --- | --- | --- | --- | --- |
| `typography/heading-screen/font-family` | `font-family/font-family-satoshi` | `Satoshi` | `--typography-heading-screen-font-family` | Título de tela (ScreenHeader) |
| `typography/heading-screen/font-size` | `font-size/font-size-29` | `29px` | `--typography-heading-screen-font-size` | Título de tela (ScreenHeader) |
| `typography/heading-screen/font-weight` | `font-weight/font-weight-medium` | `500` | `--typography-heading-screen-font-weight` | Título de tela (ScreenHeader) |
| `typography/heading-screen/letter-spacing` | `letter-spacing/letter-spacing-negative-1-015` | `-1.015px` | `--typography-heading-screen-letter-spacing` | Título de tela (ScreenHeader) |

<a id="semantico-typography-heading-sheet"></a>

### typography/heading-sheet

| Token (Figma) | Alias → primitivo | Valor resolvido | CSS | Uso |
| --- | --- | --- | --- | --- |
| `typography/heading-sheet/font-family` | `font-family/font-family-satoshi` | `Satoshi` | `--typography-heading-sheet-font-family` | Título do sheet |
| `typography/heading-sheet/font-size` | `font-size/font-size-23` | `23px` | `--typography-heading-sheet-font-size` | Título do sheet |
| `typography/heading-sheet/font-weight` | `font-weight/font-weight-medium` | `500` | `--typography-heading-sheet-font-weight` | Título do sheet |
| `typography/heading-sheet/letter-spacing` | `letter-spacing/letter-spacing-negative-0-6` | `-0.6px` | `--typography-heading-sheet-letter-spacing` | Título do sheet |

<a id="semantico-typography-heading-metric"></a>

### typography/heading-metric

| Token (Figma) | Alias → primitivo | Valor resolvido | CSS | Uso |
| --- | --- | --- | --- | --- |
| `typography/heading-metric/font-family` | `font-family/font-family-satoshi` | `Satoshi` | `--typography-heading-metric-font-family` | Percentual do anel de meta |
| `typography/heading-metric/font-size` | `font-size/font-size-22` | `22px` | `--typography-heading-metric-font-size` | Percentual do anel de meta |
| `typography/heading-metric/font-weight` | `font-weight/font-weight-bold` | `700` | `--typography-heading-metric-font-weight` | Percentual do anel de meta |
| `typography/heading-metric/letter-spacing` | `letter-spacing/letter-spacing-negative-0-66` | `-0.66px` | `--typography-heading-metric-letter-spacing` | Percentual do anel de meta |

<a id="semantico-typography-heading-section"></a>

### typography/heading-section

| Token (Figma) | Alias → primitivo | Valor resolvido | CSS | Uso |
| --- | --- | --- | --- | --- |
| `typography/heading-section/font-family` | `font-family/font-family-satoshi` | `Satoshi` | `--typography-heading-section-font-family` | Título de seção (SectionHeader) |
| `typography/heading-section/font-size` | `font-size/font-size-21` | `21px` | `--typography-heading-section-font-size` | Título de seção (SectionHeader) |
| `typography/heading-section/font-weight` | `font-weight/font-weight-medium` | `500` | `--typography-heading-section-font-weight` | Título de seção (SectionHeader) |
| `typography/heading-section/letter-spacing` | `letter-spacing/letter-spacing-negative-0-42` | `-0.42px` | `--typography-heading-section-letter-spacing` | Título de seção (SectionHeader) |

<a id="semantico-typography-body-lg"></a>

### typography/body-lg

| Token (Figma) | Alias → primitivo | Valor resolvido | CSS | Uso |
| --- | --- | --- | --- | --- |
| `typography/body-lg/font-family` | `font-family/font-family-satoshi` | `Satoshi` | `--typography-body-lg-font-family` | ActionRow, título de estado vazio |
| `typography/body-lg/font-size` | `font-size/font-size-17` | `17px` | `--typography-body-lg-font-size` | ActionRow, título de estado vazio |
| `typography/body-lg/font-weight` | `font-weight/font-weight-medium` | `500` | `--typography-body-lg-font-weight` | ActionRow, título de estado vazio |
| `typography/body-lg/letter-spacing` | `letter-spacing/letter-spacing-0` | `0px` | `--typography-body-lg-letter-spacing` | ActionRow, título de estado vazio |

<a id="semantico-typography-body-md"></a>

### typography/body-md

| Token (Figma) | Alias → primitivo | Valor resolvido | CSS | Uso |
| --- | --- | --- | --- | --- |
| `typography/body-md/font-family` | `font-family/font-family-satoshi` | `Satoshi` | `--typography-body-md-font-family` | Linha de lista, botão, input |
| `typography/body-md/font-size` | `font-size/font-size-16` | `16px` | `--typography-body-md-font-size` | Linha de lista, botão, input |
| `typography/body-md/font-weight` | `font-weight/font-weight-medium` | `500` | `--typography-body-md-font-weight` | Linha de lista, botão, input |
| `typography/body-md/letter-spacing` | `letter-spacing/letter-spacing-0` | `0px` | `--typography-body-md-letter-spacing` | Linha de lista, botão, input |

<a id="semantico-typography-body-sm"></a>

### typography/body-sm

| Token (Figma) | Alias → primitivo | Valor resolvido | CSS | Uso |
| --- | --- | --- | --- | --- |
| `typography/body-sm/font-family` | `font-family/font-family-satoshi` | `Satoshi` | `--typography-body-sm-font-family` | Toast |
| `typography/body-sm/font-size` | `font-size/font-size-15` | `15px` | `--typography-body-sm-font-size` | Toast |
| `typography/body-sm/font-weight` | `font-weight/font-weight-medium` | `500` | `--typography-body-sm-font-weight` | Toast |
| `typography/body-sm/letter-spacing` | `letter-spacing/letter-spacing-0` | `0px` | `--typography-body-sm-letter-spacing` | Toast |

<a id="semantico-typography-body-xs"></a>

### typography/body-xs

| Token (Figma) | Alias → primitivo | Valor resolvido | CSS | Uso |
| --- | --- | --- | --- | --- |
| `typography/body-xs/font-family` | `font-family/font-family-satoshi` | `Satoshi` | `--typography-body-xs-font-family` | Link, chip, texto de estado vazio |
| `typography/body-xs/font-size` | `font-size/font-size-14` | `14px` | `--typography-body-xs-font-size` | Link, chip, texto de estado vazio |
| `typography/body-xs/font-weight` | `font-weight/font-weight-medium` | `500` | `--typography-body-xs-font-weight` | Link, chip, texto de estado vazio |
| `typography/body-xs/letter-spacing` | `letter-spacing/letter-spacing-0` | `0px` | `--typography-body-xs-letter-spacing` | Link, chip, texto de estado vazio |

<a id="semantico-typography-caption"></a>

### typography/caption

| Token (Figma) | Alias → primitivo | Valor resolvido | CSS | Uso |
| --- | --- | --- | --- | --- |
| `typography/caption/font-family` | `font-family/font-family-satoshi` | `Satoshi` | `--typography-caption-font-family` | Rótulo de campo, subtítulo de linha |
| `typography/caption/font-size` | `font-size/font-size-13` | `13px` | `--typography-caption-font-size` | Rótulo de campo, subtítulo de linha |
| `typography/caption/font-weight` | `font-weight/font-weight-medium` | `500` | `--typography-caption-font-weight` | Rótulo de campo, subtítulo de linha |
| `typography/caption/letter-spacing` | `letter-spacing/letter-spacing-0` | `0px` | `--typography-caption-letter-spacing` | Rótulo de campo, subtítulo de linha |

<a id="semantico-typography-caption-sm"></a>

### typography/caption-sm

| Token (Figma) | Alias → primitivo | Valor resolvido | CSS | Uso |
| --- | --- | --- | --- | --- |
| `typography/caption-sm/font-family` | `font-family/font-family-satoshi` | `Satoshi` | `--typography-caption-sm-font-family` | Nota de linha |
| `typography/caption-sm/font-size` | `font-size/font-size-12` | `12px` | `--typography-caption-sm-font-size` | Nota de linha |
| `typography/caption-sm/font-weight` | `font-weight/font-weight-regular` | `400` | `--typography-caption-sm-font-weight` | Nota de linha |
| `typography/caption-sm/letter-spacing` | `letter-spacing/letter-spacing-0` | `0px` | `--typography-caption-sm-letter-spacing` | Nota de linha |
| `typography/caption-sm/line-height` | `line-height/line-height-ratio-135` | `1.35` | `--typography-caption-sm-line-height` | Nota de linha |

<a id="semantico-typography-kicker"></a>

### typography/kicker

| Token (Figma) | Alias → primitivo | Valor resolvido | CSS | Uso |
| --- | --- | --- | --- | --- |
| `typography/kicker/font-family` | `font-family/font-family-ibm-plex-mono` | `IBM Plex Mono` | `--typography-kicker-font-family` | Kicker monoespaçado em caixa alta |
| `typography/kicker/font-size` | `font-size/font-size-11` | `11px` | `--typography-kicker-font-size` | Kicker monoespaçado em caixa alta |
| `typography/kicker/font-weight` | `font-weight/font-weight-medium` | `500` | `--typography-kicker-font-weight` | Kicker monoespaçado em caixa alta |
| `typography/kicker/letter-spacing` | `letter-spacing/letter-spacing-1-1` | `1.1px` | `--typography-kicker-letter-spacing` | Kicker monoespaçado em caixa alta |

<a id="semantico-opacity"></a>

### opacity

| Token (Figma) | Alias → primitivo | Valor resolvido | CSS | Uso |
| --- | --- | --- | --- | --- |
| `opacity/opacity-disabled` | `opacity/opacity-40` | `40%` | `--opacity-disabled` | Botão desabilitado |
| `opacity/opacity-disabled-soft` | `opacity/opacity-50` | `50%` | `--opacity-disabled-soft` | ActionRow desabilitado |
| `opacity/opacity-muted` | `opacity/opacity-60` | `60%` | `--opacity-muted` | Ícone do date picker |

<a id="semantico-effect"></a>

### effect

| Token (Figma) | Alias → primitivo | Valor resolvido | CSS | Uso |
| --- | --- | --- | --- | --- |
| `effect/shadow-elevated-blur` | `blur/blur-40` | `40px` | `--effect-shadow-elevated-blur` | Blur da sombra do toast |
| `effect/shadow-elevated-y` | `space/space-12` | `12px` | `--effect-shadow-elevated-y` | Deslocamento Y da sombra do toast |
| `effect/shadow-glow-blur` | `blur/blur-16` | `16px` | `--effect-shadow-glow-blur` | Blur do brilho do chip ativo |
| `effect/shadow-glow-y` | `space/space-4` | `4px` | `--effect-shadow-glow-y` | Deslocamento Y do brilho do chip |
| `effect/backdrop-blur-overlay` | `blur/blur-2` | `2px` | `--effect-backdrop-blur-overlay` | Desfoque do véu do sheet |

<a id="semantico-motion"></a>

### motion

| Token (Figma) | Alias → primitivo | Valor resolvido | CSS | Uso |
| --- | --- | --- | --- | --- |
| `motion/duration-fast` | `duration/duration-200` | `200ms` | `--motion-duration-fast` | Transições de hover / cor |
| `motion/duration-base` | `duration/duration-300` | `300ms` | `--motion-duration-base` | Switch |
| `motion/duration-enter` | `duration/duration-340` | `340ms` | `--motion-duration-enter` | Entrada do sheet |
| `motion/duration-slow` | `duration/duration-700` | `700ms` | `--motion-duration-slow` | Preenchimento de barras |
| `motion/duration-count-up` | `duration/duration-650` | `650ms` | `--motion-duration-count-up` | Contagem de valores |
| `motion/easing-standard` | `easing/easing-standard` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | `--motion-easing-standard` | Curva padrão |
| `motion/easing-enter` | `easing/easing-sheet` | `cubic-bezier(0.2, 0.9, 0.25, 1)` | `--motion-easing-enter` | Curva de entrada de sheet |
| `motion/easing-exit` | `easing/easing-accelerate` | `cubic-bezier(0.4, 0, 1, 1)` | `--motion-easing-exit` | Curva de saída |
| `motion/easing-spring` | `easing/easing-spring` | `cubic-bezier(0.3, 1.4, 0.5, 1)` | `--motion-easing-spring` | Curva com mola |

<a id="semantico-layout"></a>

### layout

| Token (Figma) | Alias → primitivo | Valor resolvido | CSS | Uso |
| --- | --- | --- | --- | --- |
| `layout/breakpoint-md` | `breakpoint/breakpoint-800` | `800px` | `--layout-breakpoint-md` | Breakpoint md |
| `layout/breakpoint-lg` | `breakpoint/breakpoint-1100` | `1100px` | `--layout-breakpoint-lg` | Breakpoint lg |
| `layout/breakpoint-xl` | `breakpoint/breakpoint-1440` | `1440px` | `--layout-breakpoint-xl` | Breakpoint xl |
| `layout/breakpoint-3xl` | `breakpoint/breakpoint-1920` | `1920px` | `--layout-breakpoint-3xl` | Breakpoint 3xl |
| `layout/z-index-sheet` | `z-index/z-index-40` | `40` | `--layout-z-index-sheet` | Camada do sheet |
| `layout/z-index-toast` | `z-index/z-index-50` | `50` | `--layout-z-index-toast` | Camada do toast |

## Mapeamento com o código atual

O app hoje usa as utilities do Tailwind geradas em `src/index.css` (`--color-esk-*`). Equivalência com os semânticos:

| Tailwind atual | Token semântico |
| --- | --- |
| `esk-bg (#030303)` | `color/background/bg-canvas` |
| `esk-bg-2 (#0a0a0c)` | `color/background/bg-screen` |
| `esk-surface (#151518)` | `color/background/bg-surface` |
| `esk-elevated (#18181b)` | `color/background/bg-elevated` |
| `esk-tile (#1c1c1c)` | `color/background/bg-tile` |
| `esk-control (#1a1a1d)` | `color/background/bg-control` |
| `esk-row (#242428)` | `color/background/bg-row-icon` |
| `esk-border (#1c1c1f)` | `color/border/border-default` |
| `esk-track (#26262a)` | `color/border/border-strong` · `color/background/bg-track` |
| `esk-text (#ffffff)` | `color/text/text-primary` |
| `esk-text-2 (#f2f2f2)` | `color/text/text-secondary` |
| `esk-muted (#9a9a9a)` | `color/text/text-muted` |
| `esk-subtle (#85858a)` | `color/text/text-subtle` |
| `esk-lime (#e5ffb5)` | `color/background/bg-brand-primary` |
| `esk-lime-soft (#eafebd)` | `color/background/bg-brand-primary-soft` · `color/text/text-link` |
| `esk-lilac (#d8ccfa)` | `color/background/bg-brand-secondary` · `color/text/text-error` |
| `esk-lilac-strong (#bfa9fe)` | `color/background/bg-brand-secondary-strong` |
| `esk-lilac-card (#bbaaf8)` | `color/gradient/gradient-feature-start` |
| `esk-offwhite (#f1f1ee)` | `color/background/bg-inverse` |
| `esk-ink (#0a0a0a)` | `color/text/text-inverse` |
| `esk-ink-2 (#333333)` | `color/text/text-inverse-secondary` |
| `hover #1f1f23` | `color/background/bg-elevated-hover` |
| `hover #232327` | `color/background/bg-control-hover` |

### Gradientes

| CSS atual | Paradas (semânticos) |
| --- | --- |
| `--esk-gradient-hero` (146.88°) | `gradient-hero-start` 14% → `gradient-hero-middle` 41% → `gradient-hero-end` 86% |
| `--esk-gradient-feature` / `--esk-gradient-insight` | `gradient-feature-start` 5% → `gradient-feature-middle` 39% → `gradient-feature-end` 95% |
| `--esk-gradient-wallet` (143.19°) | `gradient-feature-middle` 5% → `gradient-feature-end` 61% |

### Sombras

| Uso | Composição |
| --- | --- |
| Toast | `0 effect/shadow-elevated-y effect/shadow-elevated-blur color/shadow/shadow-elevated` |
| Chip ativo | `0 effect/shadow-glow-y effect/shadow-glow-blur color/shadow/shadow-glow-brand` |
| Barra inferior | `0 -8px 24px color/shadow/shadow-bar` |

## Limitações conhecidas

- A fonte **Satoshi** não está instalada no ambiente do Figma usado para gerar as variáveis, por isso não foram criados *text styles*; a tipografia está documentada como variáveis por papel (`typography/<papel>/font-size`, `font-weight`, `letter-spacing`, `font-family`).
- `line-height-ratio-*` são multiplicadores (ex.: 1.35). O Figma interpreta variáveis de altura de linha em px, então esses tokens ficam sem escopo de binding.
- Curvas de animação, durações, breakpoints e z-index existem como variáveis apenas para documentação / code syntax (sem escopo no Figma).
