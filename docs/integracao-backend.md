# Okiva: contrato front ↔ backend

Toda escrita das telas segue o mesmo ciclo:

```
Tela → useMutation (botão "Salvando…") → serviço (mock ou HTTP) → dispatch no store → toast
                                              ↘ erro: estado intacto, sheet aberto, toast de erro
```

- Serviços: `src/services/finance.ts` (dados), `src/services/ai.ts` (IA), `src/services/auth.ts` (login).
- Cliente HTTP: `src/services/http.ts` (timeout, token `Bearer`, mensagens de erro amigáveis).
- Liga o backend: `.env.local` com `VITE_USE_MOCK=false` e `VITE_API_URL=https://...`.
- Os mocks já devolvem o **mesmo formato** esperado do servidor; trocar para HTTP não muda nenhuma tela.

## Convenções

| Item | Regra |
|------|-------|
| Formato | JSON, `camelCase` |
| Datas | `yyyy-mm-dd` (dia) e `yyyy-mm` (mês) |
| Dinheiro | número em reais com 2 casas (`1284.5`). Gasto é sempre positivo |
| Ids | string gerada pelo servidor; o front usa o id devolvido |
| Auth | `Authorization: Bearer <token>`; 401 → front mostra "Sua sessão expirou" |
| Erro | status HTTP + `{ "message": "texto para o usuário", "code": "opcional" }`. `message` aparece no toast |
| Sucesso sem corpo | `204` |

## Rotas

### Conta

| Método | Rota | Corpo | Resposta | Tela |
|--------|------|-------|----------|------|
| GET | `/api/me/snapshot` | — | `AccountSnapshot` | Home, Cartões, Metas (abertura) |
| PATCH | `/api/me` | `{ name?, avatar? }` | `Partial<User>` | Conta → foto |
| PUT | `/api/me/balance` | `{ balance }` | `{ balance }` | Conta → Ajustar saldo |
| DELETE | `/api/me/data` | — | `204` | Conta → Começar do zero (a conta continua) |
| DELETE | `/api/me` | — | `204` | Editar perfil → Excluir conta (conta e todos os dados) |

`AccountSnapshot = { startingBalance, transactions[], cards[], cardOrder[], goals[], featuredGoalId, budget, customCategories[], deposits[], invoices[] }`

Modelo de tabelas e matriz completa de CRUD: [modelo-de-dados.md](modelo-de-dados.md).

### Gastos

| Método | Rota | Corpo | Resposta | Tela |
|--------|------|-------|----------|------|
| POST | `/api/transactions` | `TransactionInput` | `Transaction` | Adicionar gasto |
| PUT | `/api/transactions/:id` | `Transaction` | `Transaction` | Editar gasto |
| DELETE | `/api/transactions/:id` | — | `204` | Detalhe → Apagar |

`Transaction = { id, name, category, method, date, amount, source: 'manual' | 'fatura', invoiceId? }`
`method = { type: 'card', cardId } | { type: 'pix' } | { type: 'cash' }`
`category = moradia | alimentacao | transporte | lazer | assinaturas | saude | outros`

Regra de negócio: gasto no cartão soma na fatura do cartão (editar/apagar desfaz). O servidor deve aplicar a mesma regra.

### Fatura (Plus)

| Método | Rota | Corpo | Resposta | Tela |
|--------|------|-------|----------|------|
| POST | `/api/invoice` | `multipart/form-data` (`file`: PDF ou imagem, até 20 MB) | `InvoiceResult` | Importar fatura → leitura |
| POST | `/api/invoices/import` | `ImportInvoiceInput` | `{ invoice, transactions[], card }` | Importar fatura → Confirmar |
| GET | `/api/invoices` | — | `InvoiceImport[]` | Cartões → Faturas importadas (também vem no snapshot) |
| DELETE | `/api/invoices/:id` | — | `204` | Fatura importada → Desfazer importação |

`InvoiceResult = { fileName, kind: 'pdf' | 'photo', total, dueInDays, items: [{ name, category, amount, date, subscription }] }`
`ImportInvoiceInput = { cardId | null, total, fileName, items: TransactionInput[] }`
`InvoiceImport = { id, cardId | null, fileName, total, importedAt, previousInvoice | null }`

- Cada lançamento criado pela importação volta com `invoiceId`.
- `DELETE /api/invoices/:id` apaga os lançamentos com esse `invoiceId` e devolve `previousInvoice` ao cartão.

- `/api/invoice` pode levar até 60 s (timeout do front). Leitura com IA de visão no servidor.
- `/api/invoices/import` deve ser **idempotente** por `(cardId, fileName, total)`: o front já avisa duplicata, mas o servidor é a garantia.
- O `total` lido substitui a fatura atual do cartão.

### Cartões

| Método | Rota | Corpo | Resposta |
|--------|------|-------|----------|
| POST | `/api/cards` | `{ nickname, last4, limit, invoice, dueDay }` | `Card` |
| PUT | `/api/cards/:id` | `Card` | `Card` |
| DELETE | `/api/cards/:id` | — | `204` (gastos do cartão passam para `cash`) |
| PUT | `/api/cards/order` | `{ order: string[] }` | `204` (último = frente; chamado em segundo plano) |

Validação esperada: `last4` = 4 dígitos, `limit > 0`, `dueDay` 1–31. Fatura acima do limite é permitida.

### Metas

| Método | Rota | Corpo | Resposta |
|--------|------|-------|----------|
| POST | `/api/goals` | `{ name, target, saved, deadline?, icon, featured? }` | `Goal` |
| PUT | `/api/goals/:id` | `Goal & { featured? }` | `Goal` |
| DELETE | `/api/goals/:id` | — | `204` |
| POST | `/api/goals/:id/deposits` | `{ amount, date }` | `GoalDeposit` |
| GET | `/api/goals/:id/deposits` | — | `GoalDeposit[]` (também vem no snapshot) |
| PUT | `/api/goals/:id/deposits/:depositId` | `GoalDeposit` | `GoalDeposit` |
| DELETE | `/api/goals/:id/deposits/:depositId` | — | `204` |

`Goal = { id, name, target, saved, deadline?, icon, startedAt, initialSaved, deposited }`
`GoalDeposit = { id, goalId, amount, date }`

Criar, editar ou excluir depósito aplica a diferença em `saved` e `deposited` da meta. Excluir a meta exclui os depósitos dela.
Na criação, `saved` vira `initialSaved` e `deposited = 0` (a média mensal só conta depósitos). Só existe uma meta principal: `featured: true` troca a anterior.

### Orçamento

| Método | Rota | Corpo | Resposta |
|--------|------|-------|----------|
| PUT | `/api/budget` | `{ total }` | `{ total }` |
| DELETE | `/api/budget` | — | `204` (teto do mês volta a 0; tetos por categoria continuam) |
| PUT | `/api/budget/caps/:category` | `{ value }` | `{ category, value }` |
| DELETE | `/api/budget/caps/:category` | — | `204` |

### Categorias

| Método | Rota | Corpo | Resposta |
|--------|------|-------|----------|
| POST | `/api/categories` | `{ label, color }` | `CustomCategory` |
| PUT | `/api/categories/:id` | `CustomCategory` | `CustomCategory` |
| DELETE | `/api/categories/:id` | — | `204` (gastos dela ficam sem categoria ou vão para `?moveTo=`; teto e regras dela removidos) |
| POST | `/api/transactions/recategorize` | `{ ids: string[], category }` | `204` |

`CustomCategory = { id, label, color }`. `category` em gastos e tetos passa a aceitar os ids fixos **ou** o id de uma categoria criada.
`AccountSnapshot` ganha `customCategories[]`.

- Nome único por conta, sem diferenciar maiúsculas e acentos ("Manutencao" = "Manutenção") → `409` se repetir.
- Criar o teto de uma categoria nova chama, nesta ordem: `POST /api/categories` → (se veio de sugestão) `recategorize` → `PUT /api/budget/caps/:id`.
- As **sugestões** são calculadas no front (`src/lib/categorySuggestions.ts`) a partir do nome dos lançamentos dos últimos 90 dias. Se o servidor quiser sugerir melhor (IA), pode expor `GET /api/categories/suggestions` com o mesmo formato `CategorySuggestion`.

### Contas, recorrências, parcelas e regras (etapas 6–8)

Com Supabase estas operações já existem (tabelas + RPCs, ver [financas-contas-categorias.md](financas-contas-categorias.md)).
Para uma API HTTP própria, o front chama:

| Método | Rota | Corpo | Resposta |
|--------|------|-------|----------|
| POST | `/api/accounts` | `{ name, kind, startingBalance }` | `Account` |
| PUT | `/api/accounts/:id` | `Account` | `Account` |
| DELETE | `/api/accounts/:id` | — | `204` (lançamentos e saldo inicial vão para a conta mais antiga) |
| POST | `/api/recurrences` | `RecurrenceInput` | `AccountSnapshot` (já com o que venceu) |
| PUT | `/api/recurrences/:id` | `Recurrence` | `AccountSnapshot` |
| DELETE | `/api/recurrences/:id` | — | `204` (lançamentos feitos continuam) |
| PUT | `/api/installments` | `{ group?, name, category, cardId, total, count, firstDate }` | `AccountSnapshot` |
| DELETE | `/api/installments/:group` | — | `204` (todas as parcelas) |
| PUT | `/api/category-rules` | `{ pattern, category }` | `CategoryRule` |
| DELETE | `/api/category-rules/:id` | — | `204` |
| PUT | `/api/budget/caps/:category/alert` | `{ enabled, percent }` | `{ category, alert }` |

- `Transaction` ganha `kind` (`expense` · `income` · `invoice_payment`), `accountId`, `installment`, `recurrenceId`, `posted`;
  `category` pode ser `null` em gasto (sem categoria).
- `DELETE /api/categories/:id?moveTo=` — sem `moveTo`, os gastos ficam sem categoria.
- `POST /api/transactions/recategorize` aceita `category: null`.
- `AccountSnapshot` ganha `accounts[]`, `recurrences[]`, `categoryRules[]` e `budget.alerts`.

### Assistente (Plus)

| Método | Rota | Corpo | Resposta |
|--------|------|-------|----------|
| POST | `/api/assistant` | `{ question, history, context }` | `AssistantReply` |
| POST | `/api/insight` | `{ context }` | `Insight` |

- `history`: até 10 turnos `{ role: 'user' | 'assistant', text }`.
- `context`: `AssistantContext` montado por `buildContext()` em `src/services/ai.ts`. Só números agregados, sem e-mail nem foto.
- `AssistantReply = { kind: 'text', parts: [{ text, bold? }] } | { kind: 'insight', lead, value, consequence }`.
- Timeout do front: 30 s. O botão **Parar** cancela a requisição (`AbortController`).
- Erro → bolha de erro no chat com **Tentar de novo** (a pergunta não se perde).
- A chave do provedor de IA fica só no servidor.

### Autenticação (próximo passo)

Hoje `src/services/auth.ts` é livre (protótipo). Para produção:

| Método | Rota | Corpo | Resposta |
|--------|------|-------|----------|
| POST | `/api/auth/login` | `{ email, password, remember }` | `{ token, user }` |
| POST | `/api/auth/signup` | `{ name, email, password, avatar?, balance }` | `{ token, user }` |
| POST | `/api/auth/logout` | — | `204` |

Depois do login: `setToken(token)` (já existe em `http.ts`) e `accountApi.snapshot()` para hidratar o store.

## Testes sem backend

- Escreva `#erro` em qualquer pergunta do assistente para ver o estado de erro e o **Tentar de novo**.
- Os mocks têm latência de ~300 ms (fatura: leitura ~4 s, confirmação ~500 ms) para os estados de carregamento ficarem visíveis.
