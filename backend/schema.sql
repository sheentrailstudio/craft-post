create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  plan text not null default 'free' check (plan in ('free', 'basic', 'pro')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  avatar_color text not null default '#6366f1',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists identities_user_id_idx on identities(user_id);
create unique index if not exists identities_one_default_per_user
  on identities(user_id)
  where is_default = true;

create table if not exists social_accounts (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null references identities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null,
  platform_account_id text not null,
  provider_user_id text,
  provider_account_id text,
  username text not null,
  display_name text,
  avatar_url text,
  access_token_encrypted text not null,
  refresh_token_encrypted text,
  token_type text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  status text not null default 'connected' check (status in ('connected', 'expired', 'revoked')),
  connected_at timestamptz not null default now(),
  last_connected_at timestamptz,
  last_error_code text,
  last_error_message text,
  updated_at timestamptz not null default now(),
  unique(identity_id, platform, platform_account_id)
);

create index if not exists social_accounts_user_id_idx on social_accounts(user_id);
create index if not exists social_accounts_identity_id_idx on social_accounts(identity_id);

alter table social_accounts
  drop constraint if exists social_accounts_platform_check,
  add column if not exists provider_user_id text,
  add column if not exists provider_account_id text,
  add column if not exists token_type text,
  add column if not exists last_connected_at timestamptz,
  add column if not exists last_error_code text,
  add column if not exists last_error_message text;

alter table profiles enable row level security;
alter table identities enable row level security;
alter table social_accounts enable row level security;

drop policy if exists "profiles owner read" on profiles;
create policy "profiles owner read"
  on profiles for select
  using (auth.uid() = user_id);

drop policy if exists "identities owner read" on identities;
create policy "identities owner read"
  on identities for select
  using (auth.uid() = user_id);

drop policy if exists "social accounts owner read" on social_accounts;
create policy "social accounts owner read"
  on social_accounts for select
  using (auth.uid() = user_id);
