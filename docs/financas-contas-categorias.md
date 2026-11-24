# Okiva: receitas, contas, recorrências, parcelas e categorias

Modelo financeiro em vigor a partir das migrations de **2026-11-23 e 2026-11-24** (etapas 6, 7 e 8).
Onde este documento e [modelo-de-dados.md](modelo-de-dados.md) / [supabase.md](supabase.md) divergirem, **vale este**.

| Etapa | Migration | O que entrou |
|---|---|---|
| 6 | `20261123120000_okiva_contas_recorrencias_parcelas.sql` | receitas, contas, recorrências, compras parceladas, pagamento de fatura, aviso de teto |
| 7 | `20261123180000_okiva_categorias_editaveis.sql` | categorias do app viram sugestões editáveis (CRUD completo) |
| 8 | `20261124120000_okiva_sem_categoria_regras.sql` | gasto "sem categoria" (pendente) e regras aprendidas por nome |

Todas já estão aplicadas no projeto `nbevtdkdzxuebmhvypan`.

## Regras de dinheiro

| | Teto / gastos do mês | Saldo |
|---|---|---|
| Gasto no Pix ou dinheiro | no mês da data | sai da conta na data |
| Gasto no cartão à vista | no mês da compra | só sai ao **pagar a fatura** |
| Gasto no cartão parcelado | **cada parcela no mês dela** | só sai ao pagar a fatura |
| Receita | não conta | entra na conta na data |
| Pagamento de fatura | **não conta** (senão o gasto contaria duas vezes) | sai da conta escolhida |
| Gasto sem categoria | conta no total do mês, em nenhum teto de categoria | igual ao gasto comum |

- **Saldo da Home** = soma dos saldos iniciais das contas + receitas − gastos fora do cartão − pagamentos de fatura (só datas até hoje).
  Mesma regra no banco (`balance_of`) e no front (`balanceOf` em `src/state/store.tsx`, regras em `src/lib/ledger.ts`).
- **Fatura do cartão** (`cards.invoice`) = gastos no cartão já "postados" − pagamentos de fatura. Parcela futura (`posted = false`)
  só entra quando a data dela chega.
- **Parcelas**: divisão como a maquininha, centavos que sobram na 1ª parcela (R$ 100 em 3x = 33,34 + 33,33 + 33,33).
  Parcela n = data da compra + (n−1) meses; em mês mais curto cai no último dia.
- **Recorrência**: uma regra "todo mês, dia X". O lançamento só é criado quando a data chega (`process_due`), então nenhum mês
  futuro aparece por causa dela. Editar vale dali para frente; os lançamentos já feitos continuam (e se editam um a um).
  Parcelado não pode ser recorrente.
- **Aviso de teto**: por categoria, liga/desliga e porcentagem (padrão 80%). Calculado no mês da compra (no parcelado, a 1ª parcela).

## Tabelas novas e colunas novas

### accounts
`name`, `kind` (`checking` · `savings` · `wallet`), `starting_balance`, `position`.
Toda pessoa tem ao menos uma conta: `ensure_default_account` cria "Principal" com o saldo que estava em `profiles.starting_balance`
(esse campo passa a valer 0). Excluir conta: lançamentos, recorrências e o saldo inicial dela passam para a conta mais antiga.

### recurrences
`kind` (`expense` · `income`), `name`, `category` (obrigatória), `method_type`, `card_id`, `account_id`, `amount`, `day` (1–31),
`start_date`, `end_date`, `last_run`. Lançamentos gerados têm `transactions.recurrence_id`; um por (regra, data).

### category_rules
`pattern` (nome normalizado: sem acento, minúsculo, espaços simples), `category`. Criada quando a pessoa classifica um gasto com
"Sempre usar para esse nome". A leitura de fatura e o Adicionar usam a regra quando a linha chega sem categoria.

### transactions (colunas novas)
| Coluna | Regra |
|---|---|
| `kind` | `expense` · `income` · `invoice_payment` |
| `category` | **pode ser null** só em gasto (= sem categoria, pendente). Receita usa origens `receita_*`; pagamento de fatura = `outros` |
| `account_id` | conta que o dinheiro movimentou (null em gasto no cartão) |
| `installment_group`, `installment_number`, `installment_total` | parcelas da mesma compra |
| `recurrence_id` | lançamento gerado por uma recorrência |
| `posted` | false = parcela futura, fora da fatura |

Datas futuras só são aceitas em parcelas a partir da 2ª.

### categories (mudou)
Toda categoria é uma linha. As 7 do app (`moradia`, `alimentacao`, `transporte`, `lazer`, `assinaturas`, `saude`, `outros`)
são criadas para cada conta como **sugestão** (coluna `key`) e podem ser renomeadas, recoloridas e excluídas.
O id usado nos lançamentos é `coalesce(key, id::text)`, então lançamentos antigos continuam valendo. Coluna `position` = ordem.
`'outros'` continua aceito sempre como destino de segurança (fatura, exclusões de recorrência).

Excluir categoria (`delete_category(p_category, p_move_to)`): os gastos dela ficam **sem categoria** (padrão) ou vão para a categoria
escolhida; recorrências vão para a escolhida ou `outros`; teto e regras dela são removidos.

### budget_caps (colunas novas)
`alert_enabled` (padrão true), `alert_percent` (1–100, padrão 80).

## RPCs novas ou alteradas

| RPC | Uso |
|---|---|
| `process_due()` | chamada ao abrir o app: garante a conta padrão, posta parcelas vencidas e gera as recorrências do dia. Idempotente |
| `save_installments(p_group, p_name, p_category, p_card_id, p_total, p_count, p_first_date)` | cria ou substitui (p_group) uma compra parcelada |
| `set_balance(p_balance)` | "Ajustar saldo": a diferença entra no saldo inicial da primeira conta |
| `delete_category(p_category, p_move_to)` | excluir categoria; `p_move_to` null = gastos ficam sem categoria |
| `recategorize_transactions(p_ids, p_category)` | classificar gastos (aceita null) |
| `import_invoice(...)` | linha sem categoria usa a regra aprendida; sem regra, fica pendente |
| `clear_my_data()` | também apaga contas, recorrências e regras e recria as categorias sugeridas |

`handle_new_user` (cadastro) cria as categorias sugeridas. A conta "Principal" nasce no primeiro `process_due`.

## Telas

| Onde | O quê |
|---|---|
| Home → Adicionar | Gasto ou Receita; parcelas (cartão); "Repetir todo mês"; categoria obrigatória ou "Decidir depois"; aviso de teto na hora |
| Home | seletor de mês com meses futuros (parcelas) em tom mais leve e "(atual)"; aviso "N gastos sem categoria"; valores em vermelho/verde |
| Home → Classificar | um gasto por vez, um toque na categoria; "Sempre usar para esse nome" salva a regra |
| Home → Ver contas | saldo total, contas, extrato de cada conta, recorrências (editar/encerrar/apagar) |
| Cartões | "Pagar fatura" (escolhe a conta e o valor; pagamento parcial permitido) |
| Metas | sino de aviso em cada teto; "Categorias" (CRUD completo + nomes aprendidos); mesmo sheet para todas as metas |

## Pendências conhecidas

- O site publicado na Vercel usa o código anterior a estas etapas e lê o saldo em `profiles.starting_balance` (agora 0):
  mostra o saldo errado até o próximo deploy. Os dados estão corretos.
- Leitura de fatura e assistente continuam simulados no front (`src/services/ai.ts`). A fatura simulada inclui nomes que a IA
  "não reconhece" (CNPJ, `PAG*`, `EC *`, `PIX QRS`) para testar o fluxo de classificação.
- Recomendado: um segundo projeto Supabase só para desenvolvimento, para o app local não alterar o banco do site publicado.
