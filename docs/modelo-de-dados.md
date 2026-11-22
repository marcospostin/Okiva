# Okiva: modelo de dados e matriz de CRUD

Base para o banco de dados e para o backend. Os tipos do front estão em `src/types.ts`;
as rotas em [integracao-backend.md](integracao-backend.md).

> **Banco real criado no Supabase** (projeto `nbevtdkdzxuebmhvypan`): detalhes, RLS, RPCs e testes em
> [supabase.md](supabase.md). Diferenças do banco real em relação a este documento:
> - `users` chama-se **`profiles`** (1:1 com `auth.users`, id = `auth.users.id`); login e senha ficam no Supabase Auth.
> - ids são `uuid`; meses são `text` com check `yyyy-mm` (não `char(7)`); `method_type`, `source`, `color` e `icon` são enums.
> - `goals` tem também a coluna **`deposited`** (soma dos depósitos), como o tipo `Goal` do front.
> - `goal_deposits` tem `user_id` (RLS simples); `card_id`, `invoice_id`, `goal_id` e `featured_goal_id` são FKs compostas
>   com `user_id` (impede referenciar dado de outra pessoa).
> - `cards.position`: maior = frente (mesma regra de `cardOrder`).
> - Unique de `invoice_imports` trata `card_id` nulo como distinto; a idempotência sem cartão é feita pela RPC `import_invoice`.
> - Excluir a meta principal faz a primeira meta restante virar a principal (como o reducer).

Regra geral: **tudo que a pessoa cria, ela consegue ver, editar e excluir.** Toda tabela
abaixo (exceto `users`) tem `user_id` e o backend sempre filtra por ele (uma pessoa nunca
vê dados de outra).

## Tabelas

Convenções: ids `text`/`uuid` gerados pelo servidor · dinheiro `numeric(12,2)` em reais (gasto sempre positivo) ·
datas `date` (`yyyy-mm-dd`) · meses `char(7)` (`yyyy-mm`) · `created_at`/`updated_at` em todas.

### users
| Coluna | Tipo | Regra |
|---|---|---|
| id | uuid PK | |
| email | text **unique** | login; não muda pelo app |
| name | text not null | |
| avatar_url | text null | |
| starting_balance | numeric | saldo = starting_balance − soma dos gastos |
| stage | smallint | 1 = manual, 2 = Okiva Plus |
| hide_balance | boolean | |
| featured_goal_id | FK → goals null | só uma meta principal |
| budget_total | numeric default 0 | teto do mês (0 = sem teto) |

### transactions (gastos)
| Coluna | Tipo | Regra |
|---|---|---|
| id | PK | |
| user_id | FK → users | |
| name | text not null | |
| category | text not null | id fixo (`moradia`…`outros`) **ou** id de `categories` |
| method_type | text | `card` · `pix` · `cash` |
| card_id | FK → cards null | obrigatório quando `method_type = card` |
| date | date | não pode ser futura |
| amount | numeric > 0 | |
| source | text | `manual` · `fatura` |
| invoice_id | FK → invoice_imports null | lançamentos vindos de uma fatura |

Regra: gasto no cartão soma na fatura do cartão (editar/apagar desfaz).

### cards
| Coluna | Tipo | Regra |
|---|---|---|
| id | PK | |
| user_id | FK | |
| nickname | text not null | |
| last4 | char(4) | 4 dígitos |
| color | text | `gradient` · `lilac` · `offwhite` |
| invoice | numeric ≥ 0 | fatura atual (pode passar do limite) |
| limit | numeric > 0 | |
| due_day | smallint 1–31 | |
| position | int | ordem da carteira (maior = frente) |

Excluir cartão: gastos dele viram `cash`; faturas importadas ficam no histórico com `card_id = null`.

### goals (metas)
| Coluna | Tipo | Regra |
|---|---|---|
| id | PK | |
| user_id | FK | |
| name | text not null | |
| target | numeric > 0 | |
| saved | numeric ≥ 0 | = initial_saved + soma dos depósitos |
| initial_saved | numeric ≥ 0 | o que já tinha ao criar (fora da média) |
| deadline | char(7) null | não pode ser no passado |
| icon | text | `plane` · `shield` · `book` · `car` · `target` |
| started_at | char(7) | mês de criação; base da média mensal |

### goal_deposits (depósitos)
| Coluna | Tipo | Regra |
|---|---|---|
| id | PK | |
| goal_id | FK → goals **on delete cascade** | |
| amount | numeric > 0 | |
| date | date | não pode ser futura |

Criar/editar/excluir depósito atualiza `goals.saved` na mesma transação do banco.

### budget_caps (teto por categoria)
| Coluna | Tipo | Regra |
|---|---|---|
| user_id | FK | PK composta (user_id, category) |
| category | text | id fixo ou de `categories` |
| value | numeric > 0 | |

### categories (categorias criadas pela pessoa)
| Coluna | Tipo | Regra |
|---|---|---|
| id | PK | |
| user_id | FK | |
| label | text not null | **único por pessoa** sem diferenciar maiúsculas/acentos; também não pode repetir uma fixa |
| color | text | hex |

Excluir: gastos dela → `outros`; teto dela é removido. Categorias fixas não ficam no banco (constantes).

### invoice_imports (faturas importadas)
| Coluna | Tipo | Regra |
|---|---|---|
| id | PK | |
| user_id | FK | |
| card_id | FK → cards null | |
| file_name | text | |
| total | numeric | total impresso na fatura; vira `cards.invoice` |
| previous_invoice | numeric null | fatura do cartão antes da importação (para desfazer) |
| imported_at | date | |

Único por `(user_id, card_id, file_name, total)` → importação idempotente.
Excluir = desfazer: apaga os `transactions` com esse `invoice_id` e devolve `previous_invoice` ao cartão.

## Matriz de CRUD (tela ↔ rota)

| Entidade | Criar | Ver | Editar | Excluir |
|---|---|---|---|---|
| **Conta** | Criar conta → `POST /api/auth/signup` | Conta / Editar perfil → `GET /api/me/snapshot` | Nome, foto → `PATCH /api/me` · saldo → `PUT /api/me/balance` | Editar perfil → Excluir conta → `DELETE /api/me` · zerar dados → `DELETE /api/me/data` |
| **Gasto** | Adicionar → `POST /api/transactions` | Home (lista por mês) + Detalhe da compra | Detalhe → Editar → `PUT /api/transactions/:id` | Detalhe → Apagar → `DELETE /api/transactions/:id` |
| **Fatura importada** | Importar fatura → `POST /api/invoices/import` | Cartões → Faturas importadas → detalhe · `GET /api/invoices` | lançamentos dela pelo Detalhe da compra (e categoria antes de confirmar) | Desfazer importação → `DELETE /api/invoices/:id` |
| **Cartão** | Cartões → + → `POST /api/cards` | carteira + Próximas faturas | toque no cartão/linha → `PUT /api/cards/:id` · ordem → `PUT /api/cards/order` | Remover cartão → `DELETE /api/cards/:id` |
| **Meta** | Metas → + → `POST /api/goals` | Metas (principal + demais) | toque na meta → `PUT /api/goals/:id` (inclui tornar principal) | Excluir meta → `DELETE /api/goals/:id` |
| **Depósito** | Guardar valor → `POST /api/goals/:id/deposits` | Meta → Depósitos (histórico) | toque no depósito → `PUT …/deposits/:depositId` | Excluir depósito → `DELETE …/deposits/:depositId` |
| **Teto do mês** | card "Defina seu limite" → `PUT /api/budget` | card Este mês | toque no card → `PUT /api/budget` | Remover teto do mês → `DELETE /api/budget` |
| **Teto por categoria** | Teto por categoria → `PUT /api/budget/caps/:category` | cards de categoria | toque no card → `PUT /api/budget/caps/:category` | Remover teto da categoria → `DELETE /api/budget/caps/:category` |
| **Categoria** | Minhas categorias / Teto por categoria → `POST /api/categories` | Conta → Minhas categorias | renomear → `PUT /api/categories/:id` | Excluir categoria → `DELETE /api/categories/:id` |
| **Conversa do assistente** | enviar pergunta → `POST /api/assistant` | chat | — (mensagens não se editam) | Nova conversa (fica só no navegador) |

## Fora do CRUD (decisões)

- **Saldo** não é tabela: é calculado. "Ajustar saldo" altera `starting_balance`.
- **Categorias fixas** (Moradia, Alimentação, Transporte, Lazer, Assinaturas, Saúde, Outros) não se editam nem se excluem.
- **E-mail** não muda pelo app (é o login). Troca de e-mail/senha entra com a autenticação real.
- **Conversa do assistente** não é salva no servidor (privacidade); fica no `sessionStorage` da aba.
