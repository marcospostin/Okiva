-- =============================================================================
-- Okiva - cadastro com confirmação de e-mail
-- =============================================================================
-- Com "Confirm email" ligado, o usuário só tem sessão depois de clicar no link,
-- então o app não consegue gravar o saldo inicial logo após o cadastro.
-- O app envia o saldo no metadata do signUp (options.data.balance) e o trigger
-- já cria o profile com ele. Valor inválido ou ausente = 0.
-- =============================================================================

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
  if v_raw ~ '^\d{1,10}(\.\d{1,2})?$' then
    v_balance := v_raw::numeric;
  end if;

  insert into public.profiles (id, email, name, starting_balance)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Você'
    ),
    v_balance
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
