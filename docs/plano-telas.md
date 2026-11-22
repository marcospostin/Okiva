# Okiva: plano de telas e checklist do briefing

Protótipo front-end (localhost). Dados no `localStorage` do navegador, separados por conta.
IA do Plus é simulada em `src/services/ai.ts` (mesmo contrato do backend futuro).

## Plano executado

| # | Frente | O que foi feito |
|---|--------|-----------------|
| 1 | Autenticação livre | Login e Cadastro sem campos obrigatórios (protótipo front-end). Entrar vazio abre a conta demo; um e-mail abre ou cria aquela conta. Cadastro com foto. "Lembrar de mim" mantém a sessão após fechar o navegador. Sem login social. `src/services/auth.ts` |
| 2 | Dados por conta | Cada conta tem seus próprios dados. Conta demo (`lucas@okiva.app`) abre com exemplos; conta nova abre vazia para validar os estados vazios. |
| 3 | Conta | Foto de perfil (trocar/remover), iniciais quando não há foto, Ajustar saldo, Ocultar saldo, Okiva Plus, Carregar dados de exemplo, Começar do zero, Sair com confirmação. |
| 4 | Fatura | Cancelar leitura, corrigir a categoria de cada compra antes de confirmar, aviso quando não há cartão, "Ver mais (X)". |
| 5 | Cartões | Vencimento no cartão da frente, atalho "Editar <cartão>", confirmação ao remover, cores intercaladas por posição. |
| 6 | Metas | Estado vazio sem metas, CTA quando não há limite do mês, bloco "Teto por categoria" (criar/remover), excluir meta com confirmação. |
| 7 | Feedback | Skeleton de carregamento nas telas carregadas sob demanda; toasts em todas as ações. |

## Como validar (roteiro)

1. Toque em Entrar sem preencher nada → Home da conta demo com exemplos.
2. Conta → Trocar foto → a foto aparece na Home e na Conta.
3. Conta → Sair → Criar conta com foto e saldo inicial → Home vazia com o saldo digitado.
3b. Entre sem "Lembrar de mim", feche o navegador e reabra → volta para o login.
4. Na conta nova: Adicionar gasto, criar cartão, definir limite do mês, criar primeira meta, guardar valor.
5. Ative Okiva Plus (Conta) → Fatura: envie um PDF, cancele, envie de novo, ajuste uma categoria, confirme.
6. Metas → card lilás → Assistente: pergunte sobre delivery, viagem, assinaturas.
7. Ocultar saldo e conferir que todos os valores somem.
8. Redimensione: mobile, 800px, 1100px, 1920px.

## Checklist do briefing

### Estágio 1: 3 telas

- [x] Home (saldo + este mês + transações + atalhos)
- [x] Folha Adicionar gasto (valor, categoria, cartão/pix/dinheiro, data)
- [x] Folha Detalhe da compra (editar / apagar)
- [x] Cartões (pilha, limite usado, próximas faturas, toque troca o da frente)
- [x] Folha Novo / editar cartão (apelido, final, limite, fatura, vencimento)
- [x] Metas (mês + o que está guardando, meta principal e secundárias)
- [x] Folha Teto do mês / teto por categoria
- [x] Folha Guardar valor / Nova meta
- [x] Folha Conta / Sair ("Deseja sair?")
- [x] Toast / empty / loading
- [x] Login simples (livre no protótipo) + Lembrar de mim
- [x] Cadastro com foto

### Estágio 2: +2 telas

- [x] Fatura (PDF ou foto → lendo → encontramos → confirmar)
- [x] Assistente (chat com dados do usuário)
- [x] Card de insight em Metas
- [ ] OpenAI no servidor (simulado; depende de backend)

### Requisitos transversais

- [x] Saldo visível / ocultável em todo o app
- [x] Mobile-first + breakpoints 800 / 1100 / 1920 / 4K
- [x] Navegação por views + sheets com voltar do navegador
- [x] Validação em formulários (gasto, cartão, meta, auth, upload)
- [x] Code splitting das telas secundárias

### Fora do escopo agora (para backend)

- Login com validação real de senha, persistência em banco e recuperação de senha
- Chamadas reais à OpenAI (`/api/invoice`, `/api/assistant`, `/api/insight`)
