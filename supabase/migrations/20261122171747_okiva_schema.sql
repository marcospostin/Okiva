-- Okiva - etapa 1: schema (tabelas, enums, constraints e índices)
-- Especificação: docs/modelo-de-dados.md · Visão geral: docs/supabase.md
-- Rollback (destrutivo, apaga todos os dados do app):
--   drop table if exists public.transactions, public.invoice_imports, public.goal_deposits,
--     public.budget_caps, public.categories, public.cards cascade;
--   alter table public.profiles drop constraint if exists profiles_featured_goal_fkey;
--   drop table if exists public.goals, public.profiles cascade;
--   drop type if exists public.payment_method, public.tx_source, public.card_color, public.goal_icon;
--   drop function if exists public.normalize_label(text);

create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------- enums
create type public.payment_method as enum ('card', 'pix', 'cash');
create type public.tx_source      as enum ('manual', 'fatura');
create type public.card_color     as enum ('gradient', 'lilac', 'offwhite');
create type public.goal_icon      as enum ('plane', 'shield', 'book', 'car', 'target');

-- Chave de comparação de nomes de categoria: sem acento, minúsculas, espaços colapsados.
-- Mesma regra de normalizeLabel() em src/data/categories.ts.
create or replace function public.normalize_label(p_label text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select regexp_replace(lower(extensions.unaccent('extensions.unaccent'::regdictionary, btrim(p_label))), '\s+', ' ', 'g')
$$;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  name             text not null check (length(btrim(name)) > 0),
  email            text not null,
  avatar_url       text,
  starting_balance numeric(12,2) not null default 0,
  stage            smallint not null default 1 check (stage in (1, 2)),
  hide_balance     boolean not null default false,
  featured_goal_id uuid,
  budget_total     numeric(12,2) not null default 0 check (budget_total >= 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table public.profiles is 'Conta (1:1 com auth.users). Saldo = starting_balance - soma dos gastos. budget_total = teto do mês (0 = sem teto).';

-- ---------------------------------------------------------------- cards
create table public.cards (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  nickname   text not null check (length(btrim(nickname)) > 0),
  last4      text not null check (last4 ~ '^\d{4}$'),
  color      public.card_color not null default 'gradient',
  invoice    numeric(12,2) not null default 0 check (invoice >= 0),
  "limit"    numeric(12,2) not null check ("limit" > 0),
  due_day    smallint not null check (due_day between 1 and 31),
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cards_id_user_key unique (id, user_id)
);
comment on column public.cards.position is 'Ordem da carteira: maior = frente (último de cardOrder).';
create index cards_user_position_idx on public.cards (user_id, position);

-- ---------------------------------------------------------------- goals
create table public.goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name          text not null check (length(btrim(name)) > 0),
  target        numeric(12,2) not null check (target > 0),
  saved         numeric(12,2) not null default 0 check (saved >= 0),
  initial_saved numeric(12,2) not null default 0 check (initial_saved >= 0),
  deposited     numeric(12,2) not null default 0 check (deposited >= 0),
  deadline      text check (deadline ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  icon          public.goal_icon not null default 'target',
  started_at    text not null default to_char(current_date, 'YYYY-MM') check (started_at ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint goals_id_user_key unique (id, user_id)
);
comment on column public.goals.saved is 'initial_saved + deposited (mantido por trigger).';
create index goals_user_idx on public.goals (user_id, created_at);

alter table public.profiles
  add constraint profiles_featured_goal_fkey
  foreign key (featured_goal_id, id) references public.goals (id, user_id)
  on delete set null (featured_goal_id);
create index profiles_featured_goal_idx on public.profiles (featured_goal_id, id);

-- ---------------------------------------------------------------- goal_deposits
create table public.goal_deposits (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  goal_id    uuid not null,
  amount     numeric(12,2) not null check (amount > 0),
  date       date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint goal_deposits_goal_fkey foreign key (goal_id, user_id) references public.goals (id, user_id) on delete cascade
);
create index goal_deposits_goal_idx on public.goal_deposits (goal_id, user_id);
create index goal_deposits_user_date_idx on public.goal_deposits (user_id, date desc);

-- ---------------------------------------------------------------- categories (criadas pela pessoa)
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  label      text not null check (length(btrim(label)) > 0),
  color      text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index categories_user_label_key on public.categories (user_id, public.normalize_label(label));

-- ---------------------------------------------------------------- budget_caps
create table public.budget_caps (
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  category   text not null,
  value      numeric(12,2) not null check (value > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);

-- ---------------------------------------------------------------- invoice_imports
create table public.invoice_imports (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  card_id          uuid,
  file_name        text not null check (length(btrim(file_name)) > 0),
  total            numeric(12,2) not null check (total >= 0),
  previous_invoice numeric(12,2),
  imported_at      date not null default current_date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint invoice_imports_id_user_key unique (id, user_id),
  -- NULLS DISTINCT (padrão): faturas sem cartão / de cartão excluído não conflitam entre si;
  -- a idempotência sem cartão é garantida pela RPC import_invoice.
  constraint invoice_imports_dedupe_key unique (user_id, card_id, file_name, total),
  constraint invoice_imports_card_fkey foreign key (card_id, user_id) references public.cards (id, user_id) on delete set null (card_id)
);
create index invoice_imports_card_idx on public.invoice_imports (card_id, user_id);
create index invoice_imports_user_date_idx on public.invoice_imports (user_id, imported_at desc);

-- ---------------------------------------------------------------- transactions (gastos)
create table public.transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name        text not null check (length(btrim(name)) > 0),
  category    text not null default 'outros',
  method_type public.payment_method not null default 'cash',
  card_id     uuid,
  date        date not null default current_date,
  amount      numeric(12,2) not null check (amount > 0),
  source      public.tx_source not null default 'manual',
  invoice_id  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint transactions_card_required check ((method_type = 'card') = (card_id is not null)),
  constraint transactions_card_fkey foreign key (card_id, user_id) references public.cards (id, user_id) on delete set null (card_id),
  constraint transactions_invoice_fkey foreign key (invoice_id, user_id) references public.invoice_imports (id, user_id) on delete cascade
);
create index transactions_user_date_idx on public.transactions (user_id, date desc);
create index transactions_card_idx on public.transactions (card_id, user_id);
create index transactions_invoice_idx on public.transactions (invoice_id, user_id);
create index transactions_user_category_idx on public.transactions (user_id, category);
