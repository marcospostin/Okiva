-- Okiva · etapa 18: saldo inicial negativo no cadastro (cheque especial).
-- O app passou a aceitar saldo negativo (conferência, saldo inicial da conta, "Ajustar saldo"
-- e cadastro). O trigger do cadastro só aceitava número positivo no metadata "balance".

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance numeric := 0;
  v_raw text := new.raw_user_meta_data ->> 'balance';
begin
  -- Aceita sinal de menos (ex.: "-350.00"); qualquer outra coisa vira 0
  if v_raw ~ '^-?\d{1,10}(\.\d{1,2})?$' then
    v_balance := v_raw::numeric;
  end if;

  insert into public.profiles (id, email, name, starting_balance)
  values (
    new.id,
    coalesce(new.email, ''),
    left(coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Você'
    ), 60),
    v_balance
  )
  on conflict (id) do nothing;
  perform public.seed_default_categories(new.id);
  return new;
end;
$$;
