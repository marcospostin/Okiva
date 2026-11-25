-- =============================================================================
-- Okiva - etapa 16: banco + apelido em contas e cartões
-- =============================================================================
-- accounts.name     continua sendo o banco ("Nubank"); accounts.nickname é o apelido opcional
--                   ("Dia a dia"). Subconta usa só name (o banco é o da conta mãe).
-- cards.bank        banco do cartão ("Nubank"). cards.nickname vira o apelido; sem apelido, o app
--                   grava nickname = bank (a coluna continua obrigatória). Cartões antigos sem banco
--                   mostram o nickname como antes.
-- O tipo de conta "wallet" (dinheiro em espécie) deixa de ser oferecido no app; contas existentes
-- desse tipo continuam funcionando.
--
-- Rollback: alter table public.accounts drop column nickname; alter table public.cards drop column bank;
-- =============================================================================

alter table public.accounts
  add column nickname text,
  add constraint accounts_nickname_len check (nickname is null or length(btrim(nickname)) between 1 and 30);
comment on column public.accounts.nickname is 'Apelido opcional da conta ("Dia a dia"). O nome (name) é o banco.';

alter table public.cards
  add column bank text,
  add constraint cards_bank_len check (bank is null or length(btrim(bank)) between 1 and 30);
comment on column public.cards.bank is 'Banco do cartão ("Nubank"). nickname = apelido (igual ao banco quando não há apelido).';
