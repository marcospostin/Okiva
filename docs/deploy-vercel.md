# Okiva: variáveis de ambiente na Vercel

O Okiva é um app **Vite (front estático)**: tudo roda no navegador e fala direto com o Supabase.
A segurança dos dados é feita pela **RLS** no banco, não por chaves escondidas.
Por isso a Vercel só precisa de **duas** variáveis.

## Resumo

| Variável | Precisa na Vercel? | Valor | Onde achar no Supabase |
|---|---|---|---|
| `VITE_SUPABASE_URL` | **Sim** | `https://nbevtdkdzxuebmhvypan.supabase.co` | Project Settings → **Data API** → Project URL (ou botão **Connect**) |
| `VITE_SUPABASE_ANON_KEY` | **Sim** | chave **publishable** (`sb_publishable_...`) **ou** a **anon** legada (`eyJ...`) | Project Settings → **API Keys** |
| `VITE_USE_MOCK` | Não (deixe sem criar) | — | — (só `true` força os dados simulados) |
| `VITE_API_URL` | Não, por enquanto | — | — (só quando existir um backend de IA próprio) |
| `DATABASE_URL` | **Não** | — | Database → Connection string (só para Prisma/servidor) |
| `DIRECT_URL` | **Não** | — | idem |
| `SUPABASE_SERVICE_ROLE_KEY` | **NÃO. Nunca no front.** | — | API Keys → Secret keys (só para servidor) |

> Os nomes "Vite Feature" e "Vite API Base" não existem neste projeto. Tutoriais e templates usam nomes diferentes (`VITE_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `VITE_API_BASE`...). **Vale o nome que o código lê**: aqui são exatamente `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (ver `src/services/http.ts` e `.env.example`).

## Passo a passo

### 1. Pegar os valores no Supabase

1. Abra o projeto: https://supabase.com/dashboard/project/nbevtdkdzxuebmhvypan
2. Clique em **Connect** (topo) ou vá em **Project Settings** (engrenagem) → **Data API**.
   Copie a **Project URL** → é o `VITE_SUPABASE_URL`.
3. Vá em **Project Settings → API Keys**.
   - Aba **Publishable and secret API keys**: copie a **Publishable key** (`sb_publishable_...`), ou
   - aba **Legacy API keys**: copie a **anon public** (`eyJ...`).
   Qualquer uma das duas serve como `VITE_SUPABASE_ANON_KEY` (a publishable é a recomendada).
   **Não copie** a *secret key* nem a *service_role*.

### 2. Cadastrar na Vercel

1. Vercel → seu projeto → **Settings → Environment Variables**.
2. Adicione:
   - Key `VITE_SUPABASE_URL` → Value: a Project URL
   - Key `VITE_SUPABASE_ANON_KEY` → Value: a publishable (ou anon)
3. Marque os ambientes **Production**, **Preview** e **Development**. Salve.
4. Vá em **Deployments** → no último deploy, **⋯ → Redeploy**.
   As variáveis `VITE_` entram no código **na hora do build**: sem novo deploy o app continua sem elas.

### 3. Configurações do projeto na Vercel

- Framework Preset: **Vite**
- Install Command: `pnpm install` · Build Command: `pnpm build` (ou `vite build`) · Output Directory: `dist`
- Não precisa de rewrites: o app não usa rotas por URL.

### 4. Avisar o Supabase sobre o domínio da Vercel

Supabase → **Authentication → URL Configuration**:
- **Site URL**: `https://<seu-projeto>.vercel.app`
- **Redirect URLs**: adicione **só** o mesmo domínio (ex.: `https://okiva.vercel.app`) e, para testar no computador, `http://localhost:8443`.
  **Nunca use curinga em `*.vercel.app`**: qualquer pessoa pode criar um subdomínio `vercel.app` e receber os links de
  recuperação de senha / código das vítimas (roubo de conta). Para previews, use um domínio próprio ou outro projeto Supabase.
Sem isso, o link de confirmação de cadastro volta para `localhost`.

### 4b. Cabeçalhos de segurança

`vercel.json` define CSP (só scripts do próprio site, fontes Fontshare/Google/Figma, imagens e API do Supabase),
`frame-ancestors 'none'` / `X-Frame-Options: DENY` (o app não pode ser embutido), HSTS, `nosniff`, `Referrer-Policy`
e `Permissions-Policy`. Ao adicionar um serviço externo novo (fonte, analytics, outro domínio de API), inclua o domínio
na CSP, senão o navegador bloqueia. Conferir: `curl -I https://okiva.vercel.app`.

### 5. Conferir

Abra a URL da Vercel: deve aparecer o login com "Entre com seu e-mail e senha.".
Se aparecer "Toque em Entrar para abrir a conta de demonstração", as variáveis não entraram no build → confira os nomes e faça **Redeploy**.

## Por que a service_role NÃO vai na Vercel

- A **service_role / secret key** ignora toda a RLS: quem tiver ela lê, altera e apaga os dados de **todos** os usuários.
- Tudo que começa com `VITE_` é **embutido no JavaScript público** do site. Uma `VITE_SUPABASE_SERVICE_ROLE_KEY` ficaria visível para qualquer visitante.
- O Okiva não tem servidor (API routes / funções) que precise dela. Se um dia tiver (ex.: backend de IA, Edge Function, Prisma), ela vai **só no servidor**, sem prefixo `VITE_`, e nunca no front.
- A publishable/anon é pública por definição: ela só faz o que a RLS permite (cada usuário só os próprios dados).

## E DATABASE_URL / DIRECT_URL?

São strings de conexão direta ao Postgres (com usuário e **senha do banco**). Servem para **Prisma, migrations e ferramentas de servidor**. O app não usa Prisma nem conexão direta ao Postgres, então **não cadastre** na Vercel. Se um dia precisar delas localmente, coloque em um `.env` fora do git:
- Supabase → **Connect → ORMs → Prisma**: copie `DATABASE_URL` (pooler, porta 6543, `?pgbouncer=true`) e `DIRECT_URL` (conexão direta, porta 5432), trocando `[YOUR-PASSWORD]` pela senha do banco (Database → Settings → Reset database password, se não souber).
