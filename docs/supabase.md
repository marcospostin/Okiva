# Okiva: banco de dados no Supabase

Projeto Supabase `nbevtdkdzxuebmhvypan` (Postgres 17) ·
[dashboard](https://supabase.com/dashboard/project/nbevtdkdzxuebmhvypan).
Especificação de negócio: [modelo-de-dados.md](modelo-de-dados.md) · contrato das rotas: [integracao-backend.md](integracao-backend.md).

> **Estado (2026-11-24):** banco e front ligados. Etapas 6–8 (contas, recorrências, parcelas, categorias editáveis,
> gasto sem categoria, regras aprendidas) aplicadas e testadas: ver [financas-contas-categorias.md](financas-contas-categorias.md).
> As tabelas e regras abaixo descrevem a base (etapas 1–5); as mudanças posteriores estão naquele documento.

## Arquivos

| Arquivo | O que é |
|---|---|
| `supabase/migrations/20261122171747_okiva_schema.sql` | tabelas, enums, constraints, índices |
| `supabase/migrations/20261122172017_okiva_rules_functions.sql` | triggers de regra de negócio e RPCs |
| `supabase/migrations/20261122172101_okiva_rls_grants.sql` | RLS, políticas, grants |
| `supabase/migrations/20261122172120_okiva_storage.sql` | buckets `avatars` e `invoices` + políticas |
| `supabase/migrations/20261122172624_okiva_cascade_guards.sql` | correção: exclusão da conta direto em `auth.users` |
| `supabase/migrations/20261122174638_okiva_admin_role.sql` | papel de administrador (temporário) |
| `supabase/migrations/20261122191358_okiva_demo_accounts.sql` | demonstração por visitante (contas anônimas) |
| `supabase/migrations/20261122193349_okiva_signup_metadata.sql` | saldo inicial enviado no cadastro |
| `supabase/migrations/20261123120000_okiva_contas_recorrencias_parcelas.sql` | receitas, contas, recorrências, parcelas, pagamento de fatura, aviso de teto |
| `supabase/migrations/20261123180000_okiva_categorias_editaveis.sql` | categorias do app viram sugestões editáveis |
| `supabase/migrations/20261124120000_okiva_sem_categoria_regras.sql` | gasto sem categoria e regras aprendidas |
| `supabase/migrations/20261125120000_okiva_hardening.sql` | sem admin, limites de tamanho/datas/quantidade por usuário, limite de mensagens de suporte |
| `supabase/migrations/20261126120000_okiva_destacar_parceladas.sql` | criou `profiles.highlight_installments` (interruptor do bloco "Compras parceladas"); removida na etapa 12 |
| `supabase/migrations/20261126150000_okiva_parceladas_sempre.sql` | remove a coluna: o bloco "Compras parceladas" aparece sempre que há parcela no mês |
| `supabase/migrations/20261126180000_okiva_fatura_inicial_parcelas_andamento.sql` | `cards.opening_invoice` (fatura quando começou) e `started_on`; `transactions.already_in_invoice` (parcela que já está no valor informado/importado, não soma de novo); `save_ongoing_installments` (compra parcelada de antes do Okiva, da parcela atual em diante) |
| `supabase/migrations/20261127120000_okiva_tipos_transferencia_ajuste.sql` | novos tipos de lançamento: `transfer` (mover dinheiro) e `adjustment` (ajuste da conferência) |
| `supabase/migrations/20261127120100_okiva_subcontas_conferencia.sql` | subcontas (`accounts.parent_id`, um nível), `transactions.transfer_account_id`, ajuste com sinal (na conta mexe no saldo, no cartão na fatura), data da última conferência em contas e cartões; excluir subconta devolve tudo para a conta mãe |
| `supabase/migrations/20261128120000_okiva_icone_casa.sql` | ícone `home` para metas |
| `supabase/migrations/20261128120100_okiva_demo_completa.sql` | conta de demonstração completa (renda R$ 7.000, subcontas, 3 cartões, recorrências, parceladas, transferências, rendimento, fatura lida pela IA, metas com "Imóvel próprio") |
| `supabase/migrations/20261129120000_okiva_banco_apelido.sql` | `accounts.nickname` (apelido; o nome é o banco) e `cards.bank` (banco do cartão; nickname vira apelido) |
| `supabase/migrations/20261124180000_okiva_conta_suporte_seguranca.sql` | preferências de notificação, mensagens de suporte e confirmação por e-mail para apagar dados |
| `supabase/templates/*.html` | e-mails em português (cadastro, código de confirmação, redefinir senha, trocar e-mail): colar no dashboard |
| `supabase/seed.sql` | **seed temporário** da conta demo (mocks) |
| `supabase/cleanup_demo.sql` | remove a conta demo e tudo dela |
| `prisma/schema.prisma` | espelho do schema em Prisma (só documentação) |
| `src/services/database.types.ts` | tipos TypeScript gerados do banco |

Os nomes dos arquivos de migration usam as mesmas versões registradas no projeto remoto
(`supabase_migrations.schema_migrations`), então `supabase db push/pull` não vê divergência.

## Variáveis de ambiente (front)

```env
VITE_SUPABASE_URL=https://nbevtdkdzxuebmhvypan.supabase.co
# chave publishable (sb_publishable_...) ou a anon legada (JWT):
# Supabase → Project Settings → API Keys. Fica só no .env.local (fora do git) e nas variáveis da Vercel.
VITE_SUPABASE_ANON_KEY=
```

A chave publishable/anon é pública por definição (vai no bundle do navegador); a proteção é a RLS.
**Nunca** coloque a `service_role` key no front nem em arquivo versionado.
Para Prisma/psql (só servidor): `DATABASE_URL` (pooler) e `DIRECT_URL` (conexão direta), em `.env` fora do git.

## Front ligado ao banco

Com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` definidos (`.env.local` no PC, Environment Variables na Vercel) o app:

| Parte | Como funciona | Arquivo |
|---|---|---|
| Login | `auth.signInWithPassword`; "Lembrar de mim" guarda a sessão no localStorage, senão só na aba | `src/services/auth.ts`, `src/services/supabase.ts` |
| Cadastro | `auth.signUp` com o nome no metadata (o trigger cria o profile); saldo inicial via `set_balance`; foto no bucket `avatars`. Se o projeto exigir confirmação de e-mail, mostra "Confirme seu e-mail" | `src/screens/Login.tsx` |
| Abrir o app | restaura a sessão e carrega perfil + 8 tabelas em paralelo (`loadAccount`) | `src/App.tsx`, `src/services/supabaseApi.ts` |
| Cada operação | as telas chamam os mesmos serviços de `finance.ts`; com Supabase eles usam `supabaseApi.ts` (insert/update/delete/RPC) | `src/services/finance.ts` |
| Plus / Ocultar saldo | salvos em `profiles.stage` / `hide_balance` quando mudam | `src/state/store.tsx` |
| Foto de perfil | upload em `avatars/<uid>/`, URL assinada por 7 dias | `src/services/supabaseApi.ts` |
| Excluir conta | `delete_my_account` (apaga fotos, conta e dados) | idem |

Sem as variáveis (ou com `VITE_USE_MOCK=true`) o app volta ao protótipo local. A IA (leitura de fatura e assistente) continua simulada no front até existir um backend de IA (`VITE_API_URL`).

### Entrar com a conta demo

A conta `lucas@okiva.app` foi criada **sem senha**. Para usá-la, defina você mesmo uma senha no **SQL Editor** do Supabase (troque `SUA_SENHA`):

```sql
update auth.users
   set encrypted_password = extensions.crypt('SUA_SENHA', extensions.gen_salt('bf'))
 where email = 'lucas@okiva.app';
```

### Cadastro: senha e confirmação de e-mail

**Regras de senha (no app):** ao digitar, o cadastro mostra a barra de força e a lista de requisitos.
Obrigatórios: 8+ caracteres, maiúscula, minúscula e número. Símbolo é recomendado (necessário para "Forte").
Senhas com sequências óbvias (123456, abcdef, "senha", caractere repetido) ficam sempre como "Fraca".

Para o servidor exigir o mesmo (recomendado), em **Authentication → Sign In / Providers → Email**:
- *Minimum password length*: **8**
- *Password requirements*: **Lowercase, uppercase letters and digits**
- (opcional) ligar **Leaked password protection**

**Confirmação de e-mail:**
1. **Authentication → Sign In / Providers → Email**: ligue **Confirm email**.
2. **Authentication → Emails → Templates → Confirm signup**:
   - *Subject*: `Confirme seu e-mail no Okiva`
   - *Message body*: cole o conteúdo de `supabase/templates/confirmacao-cadastro.html`
3. **Authentication → URL Configuration**: Site URL e Redirect URLs com o domínio da Vercel (já feito).

Fluxo no app: depois do cadastro aparece "Confirme seu e-mail"; o link do e-mail volta para o site já logado,
com o aviso "E-mail confirmado". Nome e saldo inicial vão no metadata do cadastro e o banco cria o perfil com eles
(migration `20261122193349_okiva_signup_metadata.sql`); a foto espera no navegador e é enviada no primeiro login.

> O envio padrão do Supabase tem limite baixo (poucos e-mails por hora) e é só para testes.
> Para uso real, configure um SMTP próprio (ex.: Resend, Brevo) em **Authentication → Emails → SMTP Settings**.

### Demonstração para visitantes (portfólio)

Botão **"Ver demonstração"** no login: cada visitante recebe uma conta **anônima e temporária só dele**, já com os dados de exemplo do Lucas.

| Peça | Como funciona |
|---|---|
| Entrada | `auth.signInAnonymously()` + RPC `seed_demo_account()` (copia cartões, gastos, metas, depósitos e tetos para a conta do visitante). Requer **Anonymous Sign-ins** ligado em Authentication → Sign In / Providers |
| Isolamento | RLS normal: cada visitante só vê e altera a própria cópia; o admin e outros usuários não são afetados |
| Sessão | Só na aba (sessionStorage) |
| Sair | Faixa "Demonstração" no topo (Sair / Criar minha conta) ou Conta → "Sair da demonstração": chama `delete_my_account()` e a conta some com os dados na hora |
| Quem só fecha a aba | `pg_cron` (job `okiva-cleanup-demo-accounts`, minuto 17 de cada hora) apaga contas anônimas com mais de 24 h (`private.cleanup_demo_accounts`) |
| Foto | Na demo a troca de foto funciona, mas a imagem fica **só na aba** (sessionStorage), nunca vai ao Storage nem ao banco; some ao sair. Proteção extra: a política restritiva `okiva_storage_no_demo_uploads` bloqueia qualquer envio de conta demo ao Storage |
| Abuso | Sem captcha por enquanto; o Supabase limita criação de contas anônimas por IP (Authentication → Rate Limits). Turnstile pode ser ligado depois (o app precisa enviar `captchaToken` antes de ativar no Supabase) |

Migration: `supabase/migrations/20261122191358_okiva_demo_accounts.sql`. O advisor passa a listar "Anonymous Access Policies" nas tabelas: esperado, os visitantes anônimos acessam **só as próprias linhas**.

A conta fixa `lucas@okiva.app` continua existindo (sem senha) e não é usada pela demonstração.

### Administrador

Removido na etapa 10 (`20261125120000_okiva_hardening.sql`): as políticas de acesso total foram apagadas,
`is_admin()` sempre devolve `false` e o papel saiu do `app_metadata`. Cada pessoa, inclusive o dono do projeto,
só acessa os próprios dados. Para inspecionar o banco, use o SQL Editor do Supabase (papel de serviço).

### Antes de publicar na Vercel

1. Vercel → Settings → Environment Variables: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (a mesma chave publishable acima). Faça um novo deploy depois de salvar.
2. Supabase → Authentication → URL Configuration: em **Site URL** coloque o domínio da Vercel e adicione-o em **Redirect URLs** (o link de confirmação de cadastro volta para lá).
3. Authentication → Providers → Email: decida se o cadastro exige confirmação de e-mail. O e-mail padrão do Supabase tem limite baixo de envios por hora; para produção, configure um SMTP próprio.
4. Ligue **Leaked Password Protection** (Authentication → Policies/Passwords).

## Tabelas (schema `public`)

Todas: `id uuid default gen_random_uuid()` (exceto `profiles` e `budget_caps`), `user_id uuid not null default auth.uid()`
→ `profiles(id) on delete cascade`, `created_at`/`updated_at timestamptz` (trigger `set_updated_at`). Dinheiro `numeric(12,2)`, datas `date`, meses `text` `yyyy-mm`.

| Tabela | Colunas principais | Constraints |
|---|---|---|
| `profiles` | id (= auth.users.id), name, email, avatar_url, starting_balance, stage, hide_balance, featured_goal_id, budget_total | stage ∈ {1,2}; budget_total ≥ 0; FK composta (featured_goal_id, id) → goals(id, user_id) |
| `cards` | nickname, last4, color (`card_color`), invoice, limit, due_day, position | last4 `^\d{4}$`, limit > 0, invoice ≥ 0, due_day 1–31; unique (id, user_id) |
| `transactions` | name, category, method_type (`payment_method`), card_id, date, amount, source (`tx_source`), invoice_id | amount > 0; `card_id` obrigatório sse método = card; FKs compostas para cards e invoice_imports |
| `goals` | name, target, saved, initial_saved, deposited, deadline, icon (`goal_icon`), started_at | target > 0, saved/initial/deposited ≥ 0, meses validados por regex |
| `goal_deposits` | goal_id, amount, date | amount > 0; FK composta (goal_id, user_id) → goals, on delete cascade |
| `budget_caps` | PK (user_id, category), value | value > 0 |
| `categories` | label, color | cor `#RRGGBB`; único por (user_id, normalize_label(label)) |
| `invoice_imports` | card_id, file_name, total, previous_invoice, imported_at | unique (user_id, card_id, file_name, total); FK composta (card_id, user_id) → cards on delete set null (card_id) |

Enums: `payment_method` (card, pix, cash) · `tx_source` (manual, fatura) · `card_color` (gradient, lilac, offwhite) · `goal_icon` (plane, shield, book, car, target).

**FKs compostas com `user_id`**: uma FK simples ignora a RLS (o Postgres checa a FK sem política), então
`card_id`, `invoice_id`, `goal_id` e `featured_goal_id` apontam para `(id, user_id)` do pai. Assim ninguém consegue
referenciar o cartão/meta/fatura de outra pessoa mesmo sabendo o uuid (testado).

Índices: `transactions (user_id, date desc)`, `(card_id, user_id)`, `(invoice_id, user_id)`, `(user_id, category)`;
`cards (user_id, position)`; `goals (user_id, created_at)`; `goal_deposits (goal_id, user_id)`, `(user_id, date desc)`;
`invoice_imports (card_id, user_id)`, `(user_id, imported_at desc)`; `profiles (featured_goal_id, id)`.

### Mapeamento front (camelCase) ↔ banco (snake_case)

| Front (`src/types.ts`) | Banco |
|---|---|
| `Transaction.method = {type:'card', cardId}` | `method_type = 'card'`, `card_id` |
| `Transaction.invoiceId` | `invoice_id` |
| `Card.dueDay` / `cardOrder` | `due_day` / ordenar por `position` asc (último = frente) |
| `Goal.initialSaved`, `startedAt` | `initial_saved`, `started_at` |
| `AppState.startingBalance`, `featuredGoalId`, `hideBalance`, `stage` | colunas de `profiles` |
| `Budget.total` / `Budget.caps` | `profiles.budget_total` / linhas de `budget_caps` |
| `User.avatar` (data URL no protótipo) | `profiles.avatar_url` (caminho no bucket `avatars`) |
| `InvoiceImport.previousInvoice`, `importedAt` | `previous_invoice`, `imported_at` |
| ids `t1`, `principal`, `japao`… do mock | uuids gerados pelo banco |

## Regras de negócio no banco (triggers)

| Regra | Onde |
|---|---|
| Gasto no cartão soma em `cards.invoice`; editar/apagar desfaz (piso 0) | `sync_card_invoice` (AFTER em transactions) |
| Lançamento criado **por importação** (`invoice_id` preenchido) **não** soma: o total da fatura substitui o `invoice` do cartão | `sync_card_invoice` + `import_invoice` |
| Editar ou apagar um lançamento importado ajusta a fatura (igual ao reducer `updateTx`/`deleteTx`) | `sync_card_invoice` |
| Excluir cartão: gastos viram `cash`, `card_id` null; faturas importadas ficam com `card_id`/`previous_invoice` null | `handle_card_delete` (BEFORE DELETE em cards) |
| Excluir fatura importada = desfazer: apaga os lançamentos dela e devolve `previous_invoice` ao cartão | `undo_invoice_import` (BEFORE DELETE em invoice_imports) |
| Depósito criado/editado/excluído aplica a diferença em `goals.saved` e `goals.deposited` | `sync_goal_deposit` |
| Criar meta: `initial_saved = saved`, `deposited = 0`; editar "já guardado" muda só `initial_saved`; `deposited`/`started_at` não são editáveis pelo app | `goals_guard` |
| Prazo da meta não pode estar no passado (checado quando muda) | `goals_guard` |
| Excluir a meta principal: a primeira meta restante (mais antiga) vira principal | `refeature_after_goal_delete` |
| Excluir categoria: gastos dela → `outros`; teto dela removido | `handle_category_delete` |
| `category` de gasto/teto = uma das 7 fixas ou id de categoria **da mesma pessoa** | `check_category` |
| Data de gasto/depósito não pode ser futura (checada quando muda; usa `current_date` do servidor, UTC) | `check_not_future_date` |
| Nome de categoria único sem maiúsculas/acentos/espaços extras, e não pode repetir uma fixa (erro `23505` → 409) | índice `categories_user_label_key` + `check_category_label` |
| Novo cartão vai para a frente da carteira (`position` = max + 1) | `cards_set_position` |
| Novo usuário em `auth.users` cria o profile (nome do metadata `name`/`full_name` ou parte do e-mail); troca de e-mail no Auth atualiza `profiles.email` | `on_auth_user_created`, `on_auth_user_email_changed` |
| Conta excluída direto em `auth.users`: os triggers acima não agem durante a cascata | `profile_exists()` nos triggers de exclusão |

Coordenação entre triggers usa flags de transação (`set_config(..., true)`): `okiva.skip_invoice_sync` e `okiva.goal_sync`.
Elas não são acessíveis pela API REST (PostgREST não executa SQL livre).

## RPCs (`supabase.rpc(...)`)

| Função | Rota equivalente | Segurança | Retorno |
|---|---|---|---|
| `import_invoice(p_card_id uuid, p_file_name text, p_total numeric, p_items jsonb)` | `POST /api/invoices/import` | INVOKER | `{ invoice, transactions[], card, duplicate }` (snake_case). Atômica e idempotente por (cartão, arquivo, total). `p_items`: `[{name, category, amount, date, method?:{type, cardId}}]`; sem método → `card` se houver cartão, senão `cash` |
| `recategorize_transactions(p_ids uuid[], p_category text)` | `POST /api/transactions/recategorize` | INVOKER | nº de linhas |
| `reorder_cards(p_order uuid[])` | `PUT /api/cards/order` | INVOKER | — (`position` = índice, último = frente) |
| `set_balance(p_balance numeric)` | `PUT /api/me/balance` | INVOKER | saldo; `starting_balance = saldo + soma dos gastos` |
| `clear_my_data()` | `DELETE /api/me/data` | INVOKER | — apaga tudo menos o profile; zera saldo inicial e teto; mantém stage/hide_balance |
| `delete_my_account()` | `DELETE /api/me` | **DEFINER**, `search_path=''`, só `auth.uid()` | — apaga os dados e o próprio usuário em `auth.users` |

O resto do CRUD é direto nas tabelas via supabase-js (`from('transactions').insert(...)` etc.), já protegido pela RLS.
`user_id` tem default `auth.uid()`, então o front não precisa enviá-lo.
Funções auxiliares (`normalize_label`, `is_builtin_category`, `is_valid_category`, `profile_exists`) têm EXECUTE para `authenticated`
porque os triggers rodam com o papel de quem chama. Nenhuma função é executável por `anon`.

## Segurança: matriz RLS

RLS habilitado em todas as tabelas. Políticas `to authenticated` com `(select auth.uid()) = user_id` (ou `= id` em profiles).
`anon` não tem grant em nenhuma tabela nem função.

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| profiles | próprio | — (trigger do Auth) | próprio, só colunas name, avatar_url, starting_balance, stage, hide_balance, featured_goal_id, budget_total | — (via `delete_my_account`) |
| cards | próprio | próprio | próprio | próprio |
| transactions | próprio | próprio | próprio | próprio |
| goals | próprio | próprio | próprio | próprio |
| goal_deposits | próprio | próprio | próprio | próprio |
| budget_caps | próprio | próprio | próprio | próprio |
| categories | próprio | próprio | próprio | próprio |
| invoice_imports | próprio | próprio (o fluxo normal é a RPC) | próprio | próprio (= desfazer) |

`email` e `id` de profiles não são editáveis pela API (grant por coluna); o e-mail muda só pelo Auth.

## Storage

| Bucket | Público | Limite | MIME | Caminho |
|---|---|---|---|---|
| `avatars` | não | 5 MB | image/jpeg, image/png, image/webp, image/heic | `<auth.uid()>/<arquivo>` |
| `invoices` | não | 20 MB | application/pdf, image/jpeg, image/png, image/heic | `<auth.uid()>/<arquivo>` |

Políticas em `storage.objects` (`okiva_files_select_own`, `_insert_own`, `_update_own`, `_delete_own`): só `authenticated`, só
nesses dois buckets e só quando a primeira pasta do caminho é o próprio `auth.uid()`. Leitura pelo front com `createSignedUrl`.
Guarde em `profiles.avatar_url` o caminho do objeto (não uma URL pública).

## Conta demo (seed TEMPORÁRIO)

`supabase/seed.sql` cria `lucas@okiva.app` (Lucas) **sem senha** e com e-mail confirmado, e os dados de `src/data/mock.ts`:
3 cartões (ordem da carteira Viagem → Salário → Principal, faturas 98 / 640 / 1284), 11 gastos com datas relativas a hoje,
4 metas (Japão principal), 49 depósitos mensais, teto do mês 3200 + 4 tetos por categoria, stage 2, saldo R$ 14.500.
As faturas dos cartões são os valores "digitados" do mock: os gastos de exemplo foram inseridos sem somar de novo.

- Para entrar com o demo: Dashboard → Authentication → Users → `lucas@okiva.app` → enviar link mágico / recuperação de senha.
- **Remover quando houver dados reais**: rode `supabase/cleanup_demo.sql` no SQL Editor (exclui o usuário em `auth.users`;
  o resto sai em cascata). Arquivos de Storage, se houver, removem-se pelo dashboard/API (o seed não cria nenhum).

## Decisões e riscos

- **Fatura do cartão segue o reducer** (`src/state/store.tsx`). Diferença mínima: num UPDATE no mesmo cartão o banco aplica
  a diferença em um passo (`invoice + novo − antigo`, piso 0) em vez de "−antigo com piso 0, depois +novo"; só muda o resultado
  quando a fatura estava abaixo do valor do gasto. Mudança só de nome/categoria/data não mexe na fatura.
- `invoice_imports` sem cartão não conflitam pelo unique (NULLs distintos); a RPC garante a idempotência nesse caso.
  Assim, excluir um cartão nunca falha por colisão de faturas antigas.
- `goals.deposited` é protegido por trigger, não por grant (os triggers rodam com o papel do usuário). Um cliente mal-intencionado
  só conseguiria bagunçar os próprios números.
- "Data não futura" usa a data UTC do servidor; para usuários no Brasil (UTC−3) isso nunca bloqueia o "hoje" local.
- `delete_my_account` é SECURITY DEFINER (necessário para apagar em `auth.users`), com `search_path=''` e restrita a `auth.uid()`.
  O advisor de segurança aponta isso como aviso; é intencional.
- Auth: o advisor recomenda ligar **Leaked Password Protection** (Dashboard → Authentication → Passwords). Não foi alterado.

## Resultados dos testes (2026-11-22)

Todos rodados com `role authenticated` + `request.jwt.claims` do demo (ou de um segundo usuário criado só para o teste),
dentro de um bloco que termina em exceção, ou seja, **tudo em rollback** (o banco ficou só com o seed).

| Entidade | C | R | U | D | Observações |
|---|---|---|---|---|---|
| profiles | ok (trigger do Auth; insert direto negado) | ok (só o próprio) | ok (nome, hide, teto; e-mail negado) | ok (`delete_my_account`; delete direto negado) | `set_balance` ok; troca de e-mail no Auth reflete no profile |
| cards | ok (posição = frente) | ok | ok | ok | last4/limit/due_day inválidos recusados; `reorder_cards` ok |
| transactions | ok | ok | ok | ok | fatura: +100, +30, card→pix −, pix→card +, só nome/categoria = sem efeito, delete −; data futura, categoria inválida, card sem card_id e amount 0 recusados; `recategorize_transactions` ok |
| invoice_imports (RPC) | ok (fatura = total, lançamentos `fatura`, sem soma dupla) | ok | ok (metadados; lançamento importado editado ajusta fatura) | ok (desfaz: lançamentos somem, fatura anterior volta) | idempotente com e sem cartão; sem cartão → `cash` |
| goals | ok (initial = saved, deposited = 0) | ok | ok (já guardado → initial; deposited protegido) | ok (depósitos em cascata; principal → 1ª meta) | prazo no passado e target 0 recusados |
| goal_deposits | ok (saved/deposited +) | ok | ok (aplica diferença) | ok (sai da meta) | data futura recusada |
| budget (profiles.budget_total) | ok | ok | ok | ok (= 0) | |
| budget_caps | ok | ok | ok | ok | categoria inválida e valor 0 recusados; aceita categoria criada |
| categories | ok | ok | ok (renomear) | ok (gastos → outros, teto removido) | nome repetido (acento/maiúscula/espaço) e nome de fixa → 23505; cor inválida recusada |

Excluir cartão: gasto vira `cash`, import fica com `card_id`/`previous_invoice` null, lançamentos da fatura viram `cash`,
desfazer import de cartão excluído funciona; faturas dos cartões do demo intactas.

Isolamento (segundo usuário): vê só o próprio profile (0 linhas do demo nas outras 7 tabelas); UPDATE/DELETE em dados do demo
afetam 0 linhas; INSERT com `user_id` do demo → violação de RLS; usar cartão/meta do demo em gasto, depósito ou meta principal →
violação de FK composta; `import_invoice` em cartão do demo → "Cartão não encontrado"; `recategorize`/`reorder`/`clear_my_data`
não tocam no demo. `anon`: permission denied em tabelas e RPCs, 0 objetos no Storage.

Storage: upload na própria pasta ok (avatars e invoices); pasta alheia ou raiz → RLS; update/select só nos próprios; outro usuário
não vê nem altera. DELETE via SQL é bloqueado pelo próprio Supabase (`storage.protect_delete`), então o DELETE da política
não pôde ser exercitado por SQL: precisa ser testado pela Storage API.

`clear_my_data`: 0 linhas nas 7 tabelas, profile mantido (stage 2, saldo inicial 0, teto 0). `delete_my_account`: usuário,
profile e dados removidos. Exclusão direta em `auth.users` (o que o `cleanup_demo.sql` faz): 0 linhas restantes.

**Falhas encontradas e corrigidas:**
1. Exclusão direta em `auth.users` falhava (FK `transactions_user_id_fkey`) porque o trigger de exclusão de cartão rodava
   durante a cascata. Corrigido na migration `okiva_cascade_guards`; bateria repetida (22/22 ok) e cascata ok.
2. "Principal → 1ª meta" escolhia uma meta aleatória no seed (as 4 metas tinham o mesmo `created_at`). Seed corrigido com
   `created_at` escalonado na ordem do mock (e as linhas existentes atualizadas).
