# Okiva

Seu assistente financeiro para gastos e conquistas.

App de finanças pessoais, mobile-first e com a mesma home no desktop, só mais larga. A pessoa registra o próprio dinheiro à mão (estágio 1). No **Okiva Plus** (estágio 2), a IA lê a fatura e responde no chat.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4 (tokens em `src/index.css`, `@theme`)
- Estado: React Context + `useReducer`, persistido em `localStorage`
- Ícones: SVGs do Figma em `public/assets` e `lucide-react` como complemento

```bash
pnpm install
pnpm dev     # desenvolvimento
pnpm build   # build de produção
```

## Estrutura

```
src/
  App.tsx                 shell: login → views + sheets + toast (com lazy/code splitting)
  index.css               tokens --color-esk-*, gradientes --esk-gradient-*, fontes, breakpoints
  types.ts                Transaction, Card, Goal, Budget, AppState
  data/mock.ts            dados de referência (Lucas, R$ 14.500, cartões, metas) + TODAY
  data/categories.ts      categorias e cores
  state/store.tsx         reducer, persistência e seletores (saldo, mês, vencimentos)
  state/ui.tsx            pilha de views + sheet aberta + toast (integra com o botão voltar)
  services/ai.ts          ESTÁGIO 2: mock com o mesmo contrato do backend OpenAI
  components/ui.tsx       Page, ScreenHeader, Sheet, ListPanel, FeatureCard, Ring, forms…
  components/icons.tsx    ícones de categoria/meta
  screens/                Home, Cards, Goals, Invoice*, Assistant*, Login
  sheets/SheetHost.tsx    Adicionar/editar gasto, detalhe, cartão, meta, guardar, teto, conta
```

`*` só aparece com o Okiva Plus ligado (folha Conta → “Okiva Plus”).

## Navegação

São poucas telas cheias e o resto abre como folha (sheet). Não há tab bar nem sidebar.

- Estágio 1: **Home**, **Cartões**, **Metas**. Folhas: Adicionar, Detalhe, Cartão, Meta, Guardar, Teto, Conta.
- Estágio 2: + **Fatura** (atalho na home) e **Assistente** (card lilás em Metas ou botão no hero).

## Breakpoints

| Faixa     | Largura          | Layout                                        |
|-----------|------------------|-----------------------------------------------|
| Mobile    | < 800px          | uma coluna (protótipo do Figma)               |
| `md`      | ≥ 800px          | duas colunas (saldo e atalhos fixos à esquerda)|
| `lg`      | ≥ 1100px         | números maiores, mais respiro                 |
| `3xl`     | ≥ 1920px (FHD)   | container de 1680px; mês e transações lado a lado |
| QHD / 4K  | ≥ 2560 / 3840px  | `zoom` 1.33 / 2 sobre o layout Full HD        |

## Estágio 2: ligar a OpenAI

`src/services/ai.ts` simula as respostas. Para produção, troque o corpo de cada função por um `fetch` para rotas no servidor (Next.js route handlers, Edge Functions etc.). **A chave da OpenAI nunca vai para o client.**

- `POST /api/invoice` (multipart) → `InvoiceResult`. Usa visão para foto e input de arquivo para PDF.
- `POST /api/assistant` `{ question, context }` → `AssistantReply`, com streaming quando possível.
- `POST /api/insight` `{ context }` → `Insight`.

O `context` é o `AppState` (gastos, cartões, metas), então as respostas usam o dinheiro da pessoa.

## Próximos passos

- Persistência real (auth, transações, cartões, metas, mídia) no lugar do `localStorage`
- Backend OpenAI para os três endpoints acima
- `TODAY` (em `data/mock.ts`) já usa a data local atual; a constante existe para manter os cálculos de data consistentes.
