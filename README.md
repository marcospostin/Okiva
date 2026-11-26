# Okiva

Veja com clareza suas contas e cartões e leve seu dinheiro mais longe.

App de finanças pessoais: contas e subcontas, cartões e faturas (com crédito e adiantamento de parcelas),
compras parceladas, tetos por categoria, metas e relatórios. No **Okiva Plus** (estágio 2), a IA lê a fatura
e responde no chat. Publicado em [okiva.vercel.app](https://okiva.vercel.app).

## Stack

- React 19 + TypeScript + Vite 8, Tailwind CSS v4 (tokens em `src/index.css`, `@theme`)
- Supabase: Auth (e-mail/senha e demonstração anônima), Postgres com RLS, triggers e funções (as regras de
  saldo e fatura rodam no banco), Storage para fotos
- Estado no app: React Context + `useReducer` (`src/state/store.tsx`), carregado do Supabase ao entrar
- Deploy na Vercel a partir do GitHub (`main`), com CSP e cabeçalhos em `vercel.json`

```bash
pnpm install
pnpm dev         # desenvolvimento
pnpm build       # checa os tipos e gera o build de produção
pnpm typecheck   # só os tipos
pnpm lint        # oxlint (regras em .oxlintrc.json)
pnpm test        # testes das regras de dinheiro (vitest)
```

Sem `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, o app roda com dados de exemplo locais.

## Estrutura

```
src/
  App.tsx              login → telas + sheets + toast; barra lateral (≥ 800px) ou barra de baixo (celular)
  index.css            tokens, cores, breakpoints e a variante `wide` (colunas)
  types.ts             Transaction, Card, Account, Goal, AppState…
  lib/ledger.ts        regras de dinheiro (saldo, fatura, crédito, parcelas, adiantar) — as mesmas do banco
  lib/format.ts        datas e dinheiro (pt-BR); validação de data
  state/store.tsx      reducer e seletores (saldo, mês, vencimentos)
  state/ui.tsx         navegação, sheet aberta, toast
  services/            Supabase (supabaseApi.ts), auth, IA (ai.ts), erros e tempo limite (http.ts, supabase.ts)
  screens/             Home, Contas, Cartões, Metas, Relatórios, Fatura*, Assistente*, Ajustes, Login
  sheets/              formulários (lançamento, pagar fatura, adiantar parcelas, conferir, conta, cartão, meta…)
supabase/
  migrations/          schema, RLS, triggers e funções, em ordem (ver docs/supabase.md)
  tests/regras_banco.sql   teste das regras do banco (rode no SQL Editor; termina com erro de propósito)
docs/                  Supabase, deploy na Vercel, tokens de design
```

`*` só aparece com o Okiva Plus.

## Layout

| Tela | Navegação | Conteúdo |
|------|-----------|----------|
| Celular (< 800px) | barra de baixo | uma coluna |
| Tablet em pé (≥ 800px, retrato) | barra lateral | uma coluna, como no celular |
| Tablet deitado (≥ 800px, paisagem) e computador (≥ 1100px) | barra lateral | duas colunas |
| Full HD (≥ 1920px) | barra lateral | container de 1680px |

## Regras importantes

- **Saldo** = saldos iniciais + receitas − gastos fora do cartão − pagamentos de fatura + ajustes.
  Transferência não muda o total. Saldo pode ser negativo (cheque especial).
- **Fatura** = fatura inicial + compras no cartão − pagamentos. Negativa = crédito (pagou a mais): libera
  limite e vira desconto na próxima fatura.
- **Cartão removido**: as compras ficam no histórico e fora do saldo; os pagamentos continuam pagamentos.
- Operações em várias etapas (à vista ↔ parcelado, importar fatura com parcelas, adiantar) são uma
  transação só no banco.

## IA (Okiva Plus)

`src/services/ai.ts` simula as respostas na demonstração. Para produção, as chamadas vão para um backend
(`VITE_API_URL`) com a chave da IA **só no servidor**, nunca no app.
