# Okiva: checklist completo de telas, funcionalidades e CRUD

Validado no navegador (desktop e mobile 375px), conta demo, mocks ligados.
Modelo de dados e matriz de CRUD: [modelo-de-dados.md](modelo-de-dados.md) · Contrato da API: [integracao-backend.md](integracao-backend.md)

Legenda: [x] validado no front (mock) · [ ] pendente (depende do backend)

> **Banco Supabase criado e testado (2026-11-22)**: tabelas, regras (triggers), RPCs, RLS e Storage — ver
> [supabase.md](supabase.md) e a seção 12a. Os itens "[ ] Rotas … no backend" abaixo continuam pendentes:
> a regra já existe e foi testada no banco, mas a **ligação do front ao Supabase ainda não foi feita** (o front usa mock).
Em toda escrita: botão em carregamento, sem envio duplo, toast de sucesso; em erro, nada muda e aparece toast de erro.

---

## 1. Entrar e criar conta

- [x] Entrar sem e-mail abre a conta demo; com e-mail abre (ou cria) aquela conta
- [x] "Lembrar de mim" mantém a sessão ao fechar o navegador
- [x] Criar conta: nome, e-mail, foto e saldo inicial (todos opcionais no protótipo)
- [x] Cada conta guarda os próprios dados
- [ ] Autenticação real (`/api/auth/login`, `/signup`, `/logout`) e senha

## 2. Conta (sheet)

| Operação | Onde | Status |
|---|---|---|
| Ver | Avatar na Home → Conta (nome, e-mail, foto, saldo) | [x] |
| Editar nome | Conta → **Editar perfil** → Nome (obrigatório) | [x] |
| Editar foto | Trocar foto / Remover (aceita só imagem; spinner) | [x] |
| Editar saldo | Ajustar saldo | [x] |
| Zerar dados | Começar do zero (confirmação; a conta continua) | [x] |
| Excluir conta | Editar perfil → **Excluir conta** (confirmação → volta ao login, conta e dados somem) | [x] |

- [x] E-mail aparece só para leitura ("é o seu login")
- [x] Ocultar saldo esconde valores em todas as telas e no assistente
- [x] Okiva Plus liga/desliga (modo manual × leitura de fatura + assistente)
- [x] Carregar dados de exemplo
- [x] Sair com confirmação
- [ ] `PATCH /api/me`, `DELETE /api/me`, `DELETE /api/me/data` no backend

## 3. Home e gastos (CRUD completo)

| Operação | Onde | Status |
|---|---|---|
| Criar | Adicionar → valor (obrigatório), descrição, categoria (fixas + criadas), pagamento, data (não futura) | [x] |
| Ver | Lista do mês (6 + "Ver mais"), troca de mês, Detalhe da compra | [x] |
| Editar | Detalhe → Editar → "Gasto atualizado" | [x] |
| Excluir | Detalhe → Apagar → confirmação → "Gasto apagado" | [x] |

- [x] Saldo, total do mês e categorias atualizam com animação
- [x] Gasto no cartão soma na fatura do cartão; editar e apagar desfazem
- [x] Gasto vindo de fatura mostra "Ver fatura …" no detalhe
- [ ] Rotas `/api/transactions` no backend

## 4. Importar fatura (Plus) e faturas importadas (CRUD completo)

| Operação | Onde | Status |
|---|---|---|
| Criar | Fatura → PDF/foto → leitura → Confirmar N lançamentos | [x] |
| Ver | **Cartões → Faturas importadas** → detalhe (arquivo, cartão, data, total, lançamentos) | [x] |
| Editar | Antes de confirmar: categoria e seleção; depois: cada lançamento pelo Detalhe da compra | [x] |
| Excluir | Detalhe da fatura → **Desfazer importação** (apaga os lançamentos e devolve a fatura anterior do cartão) | [x] |

- [x] Arquivo inválido ou acima de 20 MB: mensagem clara
- [x] Leitura com progresso; Cancelar volta ao início
- [x] Aviso de fatura duplicada (mesmo cartão no mesmo mês)
- [x] Sem cartão: lançamentos entram como Dinheiro
- [ ] Leitura real por IA (`POST /api/invoice`) e importação idempotente no servidor
- [ ] `GET /api/invoices`, `DELETE /api/invoices/:id` no backend

## 5. Cartões (CRUD completo)

| Operação | Onde | Status |
|---|---|---|
| Criar | + → apelido, final (4 dígitos), limite, fatura atual, vencimento (1–31) | [x] |
| Ver | Carteira empilhada (toque troca o da frente), limite usado, Próximas faturas | [x] |
| Editar | Toque no cartão/linha → "Cartão atualizado"; ordem da carteira salva em segundo plano | [x] |
| Excluir | Remover cartão → confirmação (gastos dele viram Dinheiro) | [x] |

- [x] Fatura acima do limite: aviso, sem bloquear
- [x] Estado vazio com botão para criar o primeiro cartão
- [ ] Rotas `/api/cards` no backend

## 6. Metas (CRUD completo)

| Operação | Onde | Status |
|---|---|---|
| Criar | + → nome e valor alvo (obrigatórios), já guardado, data (não no passado), principal | [x] |
| Ver | Meta principal (anel, média, previsão) e Demais metas | [x] |
| Editar | Toque na meta → "Meta atualizada"; tornar principal troca a anterior | [x] |
| Excluir | Excluir meta → confirmação (exclui também os depósitos) | [x] |

## 7. Depósitos das metas (CRUD completo)

| Operação | Onde | Status |
|---|---|---|
| Criar | Guardar R$ 500 / Guardar valor → chips de valor, prévia do %, aviso de meta atingida | [x] |
| Ver | Meta → **Depósitos (N)** com data e valor; "Ver todos" | [x] |
| Editar | Toque no depósito → valor e data → meta e média recalculadas | [x] |
| Excluir | Toque no depósito → **Excluir depósito** → o valor sai da meta | [x] |

- [x] Valor que já existia ao criar a meta aparece explicado (fora da média)
- [ ] Rotas `/api/goals` e `/api/goals/:id/deposits` no backend

## 8. Teto do mês e teto por categoria (CRUD completo)

| Operação | Teto do mês | Teto por categoria |
|---|---|---|
| Criar | [x] card "Defina seu limite" | [x] Teto por categoria → sugestões ou Nova categoria |
| Ver | [x] card Este mês (quanto ainda pode gastar) | [x] cards com % e barra |
| Editar | [x] toque no card | [x] toque no card da categoria |
| Excluir | [x] **Remover teto do mês** | [x] Remover teto da categoria |

- [x] Sugestões a partir dos lançamentos (ex.: oficina → Manutenção) e base para o app vazio
- [x] Quantidade de sugestões calculada pela largura (2 linhas, máximo 5)
- [ ] Rotas `/api/budget` no backend

## 9. Categorias criadas pela pessoa (CRUD completo)

| Operação | Onde | Status |
|---|---|---|
| Criar | Conta → **Minhas categorias** → Nova categoria · ou Teto por categoria → Nova categoria | [x] |
| Ver | Minhas categorias (cor, nº de lançamentos, teto); aparecem em Adicionar gasto, fatura e Metas | [x] |
| Editar | Toque na categoria → renomear (nome único, sem diferenciar maiúscula/acento) · atalho no teto da categoria | [x] |
| Excluir | Excluir categoria → confirmação (lançamentos vão para Outros, teto removido) | [x] |

- [x] Categorias fixas não se editam (avisado na tela)
- [ ] Rotas `/api/categories` e `/api/transactions/recategorize` no backend

## 10. Assistente de IA (Plus)

- [x] Acesso pela Home e por Metas; sem Plus abre o convite e depois o chat
- [x] Estado vazio com sugestões; indicador digitando; resposta com efeito de digitação
- [x] Parar; erro com Tentar de novo (`#erro` para testar); foco volta ao campo
- [x] Conversa mantida ao sair e voltar; **Nova conversa** limpa (criar · ver · excluir; mensagens não se editam)
- [x] Saldo oculto mascara valores
- [ ] Respostas reais (`POST /api/assistant`) e insight do servidor (`POST /api/insight`)

## 11. Animações e feedback

- [x] Transição de tela com direção; sheets e toasts com entrada e saída
- [x] Números com contagem, barras e anel enchendo; listas em cascata
- [x] Campos com erro em lilás + tremor + mensagem; botões com carregamento
- [x] Confirmação antes de toda exclusão
- [x] `prefers-reduced-motion` desliga as animações

## 12a. Banco de dados (Supabase)

- [x] Tabelas, enums, constraints e índices (`profiles`, `cards`, `transactions`, `goals`, `goal_deposits`, `budget_caps`, `categories`, `invoice_imports`)
- [x] RLS em todas as tabelas, políticas por operação, `anon` sem acesso; isolamento entre usuários testado
- [x] Fatura do cartão, depósitos → meta, excluir cartão/categoria/fatura, categoria válida, data não futura: triggers testados
- [x] RPCs `import_invoice` (idempotente), `recategorize_transactions`, `reorder_cards`, `set_balance`, `clear_my_data`, `delete_my_account`
- [x] Profile criado automaticamente ao criar usuário no Auth
- [x] Buckets privados `avatars` e `invoices` (20 MB) com política por pasta do usuário
- [x] Conta demo (mocks) no banco como seed temporário + `supabase/cleanup_demo.sql`
- [x] Front ligado ao Supabase: login e cadastro reais, conta carregada das tabelas ao abrir, cada operação gravada no banco (ver `docs/supabase.md` → Front ligado ao banco)
- [x] Validação de login/cadastro (e-mail, senha ≥ 6, confirmação) e mensagens de erro do Auth em português
- [x] Papel admin (temporário): `is_admin()` + políticas de acesso total; testado (admin vê/edita tudo, usuário comum continua isolado)
- [x] Papel de administrador removido (etapa 10, `20261125120000_okiva_hardening.sql`)
- [x] Senha do admin definida e login real pelo app funcionando
- [x] CRUD pelo app com sessão real, conferido no banco: gasto (criar → editar → apagar, com a fatura do cartão acompanhando), depósito em meta (criar → excluir, saved/deposited acompanhando), categoria (criar → recarregar a página e continuar lá → excluir)
- [x] Pelo app, conferido no banco: cartões (criar → reordenar a carteira → editar → remover), metas (criar → editar + tornar principal → excluir, principal volta para a anterior), teto por categoria (criar → editar → remover, sem afetar outros usuários), teto do mês (editar → remover → recriar), fatura (importar 34 lançamentos → duplicata bloqueada pelo banco → desfazer, cartão volta à fatura anterior), perfil (nome, saldo, Plus, ocultar saldo, foto enviada ao bucket e lida após recarregar, remoção apaga o arquivo)
- [x] DELETE de arquivo no Storage testado pela Storage API (remover foto)
- [x] Demonstração por visitante: "Ver demonstração" cria conta anônima com os dados do Lucas (11 gastos, 49 depósitos, saldo R$ 14.500), isolada dos outros usuários; sair pela faixa ou pela Conta apaga a conta e os dados; limpeza agendada de contas demo com mais de 24 h; demo não envia arquivos ao Storage
- [ ] Captcha (Turnstile) na entrada da demonstração, se aparecer abuso
- [ ] Cadastrar `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` na Vercel e ajustar Site URL / Redirect URLs no Auth
- [ ] Ligar "Leaked Password Protection" no Auth (recomendação do advisor)

## 12. Pronto para o backend

- [x] Toda escrita passa por `src/services/finance.ts` (mock ou HTTP pela mesma função)
- [x] Ids vêm da resposta do serviço
- [x] Snapshot da conta inclui gastos, cartões, metas, depósitos, faturas, tetos e categorias
- [x] Dados salvos antes desta versão são migrados (depósitos de exemplo, listas vazias)
- [x] Modelo de tabelas, chaves e regras em `docs/modelo-de-dados.md`
- [ ] Backend implementar as rotas e regras do contrato
- [ ] Hidratar o store com `GET /api/me/snapshot` após o login real

## 13. Qualidade

- [x] `tsc --noEmit` sem erros
- [x] `vite build` ok
- [x] Mobile 375px utilizável (atalhos, chat, sheets)
