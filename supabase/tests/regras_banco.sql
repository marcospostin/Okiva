-- Okiva · teste das regras do banco (saldo, cartão removido, crédito, adiantar, extrato, apagar dados).
--
-- Como rodar: cole no SQL Editor do Supabase e execute. Cria uma conta de demonstração temporária,
-- confere as regras e TERMINA COM ERRO DE PROPÓSITO para desfazer tudo (nada fica gravado):
--   - "OK: todas as regras passaram"      → tudo certo
--   - qualquer outra mensagem de erro     → a regra que quebrou está no texto
--
-- Rode depois de mudar funções/triggers de saldo, fatura, parcelas ou exclusão.

do $$
declare
  u uuid := gen_random_uuid();
  c record;
  acc uuid;
  grp uuid;
  cid uuid;
  b numeric;
  inv numeric;
  n int;
  sum_before numeric;
begin
  insert into auth.users (id, instance_id, aud, role, is_anonymous, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values (u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now(), now(), '{}', '{}');
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  execute 'set local role authenticated';
  perform public.seed_demo_account();

  -- 1. Saldo: set_balance grava exatamente o valor pedido (transferências e ajustes não atrapalham)
  perform public.set_balance(10000);
  assert public.balance_of(u) = 10000, format('set_balance(10000) deu %s', public.balance_of(u));
  perform public.set_balance(-350);
  assert public.balance_of(u) = -350, format('saldo negativo: set_balance(-350) deu %s', public.balance_of(u));
  perform public.set_balance(10000);

  -- 2. Crédito: pagar R$ 200 a mais deixa a fatura negativa; apagar o pagamento volta ao valor exato
  select * into c from public.cards where user_id = u order by position limit 1;
  select id into acc from public.accounts where user_id = u and parent_id is null order by position limit 1;
  insert into public.transactions (user_id, kind, name, method_type, card_id, account_id, date, amount, source)
  values (u, 'invoice_payment', 'Teste', 'card', c.id, acc, current_date, c.invoice + 200, 'manual');
  select invoice into inv from public.cards where id = c.id;
  assert inv = -200, format('pagar 200 a mais: fatura %s (esperado -200)', inv);
  delete from public.transactions where user_id = u and name = 'Teste' and kind = 'invoice_payment';
  select invoice into inv from public.cards where id = c.id;
  assert inv = c.invoice, format('apagar o pagamento: fatura %s (esperado %s)', inv, c.invoice);

  -- 3. Adiantar 2 parcelas com R$ 10 de desconto: a fatura sobe (soma das parcelas − 10)
  select t.installment_group into grp from public.transactions t
   where t.user_id = u and t.method_type = 'card' and not t.posted and t.installment_group is not null
   group by t.installment_group having count(*) >= 2 limit 1;
  if grp is not null then
    select t.card_id, sum(t.amount) into cid, sum_before
      from (select card_id, amount from public.transactions where installment_group = grp and not posted order by installment_number desc limit 2) t
     group by t.card_id;
    select invoice into inv from public.cards where id = cid;
    perform public.anticipate_installments(grp, 2, 10, current_date);
    assert (select invoice from public.cards where id = cid) = inv + sum_before - 10, 'adiantar parcelas: fatura não subiu o valor certo';
  end if;

  -- 4. Extrato de conta: receita + gasto + pagamento de fatura; desfazer volta tudo
  select * into c from public.cards where user_id = u order by position limit 1;
  b := public.balance_of(u);
  perform public.import_invoice(null, 'teste-extrato.ofx', 400, jsonb_build_array(
    jsonb_build_object('kind', 'income', 'name', 'Salário', 'category', 'receita_salario', 'amount', 5000),
    jsonb_build_object('kind', 'expense', 'name', 'Mercado', 'amount', 100),
    jsonb_build_object('kind', 'invoice_payment', 'name', 'Pagamento fatura', 'cardId', c.id, 'amount', 300)), null, acc);
  assert public.balance_of(u) = b + 4600, format('extrato: saldo %s (esperado %s)', public.balance_of(u), b + 4600);
  assert (select invoice from public.cards where id = c.id) = c.invoice - 300, 'extrato: pagamento não abateu a fatura';
  delete from public.invoice_imports where user_id = u and file_name = 'teste-extrato.ofx';
  assert public.balance_of(u) = b, 'desfazer extrato: saldo não voltou';
  assert (select invoice from public.cards where id = c.id) = c.invoice, 'desfazer extrato: fatura não voltou';

  -- 5. Remover cartão: saldo e total de gastos não mudam; pagamentos continuam pagamentos
  b := public.balance_of(u);
  select coalesce(sum(amount), 0) into sum_before from public.transactions where user_id = u and kind = 'expense';
  select * into c from public.cards where user_id = u order by position limit 1;
  delete from public.cards where id = c.id;
  assert public.balance_of(u) = b, format('remover cartão mudou o saldo: %s → %s', b, public.balance_of(u));
  assert (select coalesce(sum(amount), 0) from public.transactions where user_id = u and kind = 'expense') = sum_before, 'remover cartão mudou o total de gastos';
  assert not exists (select 1 from public.transactions where user_id = u and removed_card is not null and kind = 'expense' and method_type = 'card'), 'compra de cartão removido ainda aponta para cartão';

  -- 6. Começar do zero: apaga tudo, inclusive subcontas e mais de uma conta principal
  perform public.clear_my_data();
  select count(*) into n from public.accounts where user_id = u;
  assert n = 0, format('clear_my_data deixou %s contas', n);

  raise exception 'OK: todas as regras passaram (nada foi gravado)';
end $$;
