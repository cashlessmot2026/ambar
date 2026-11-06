-- Ámbar PWA: esquema. RLS activo sin políticas: la llave anon no accede a tablas directamente.
create extension if not exists pgcrypto with schema extensions;

create table if not exists settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists menus (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  subtitle text,
  start_time time not null default '00:00',
  end_time time not null default '23:59',
  sort int not null default 0,
  active boolean not null default true
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references menus(id) on delete cascade,
  name text not null,
  image text,
  sort int not null default 0
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  name text not null,
  description text,
  price int not null check (price >= 0),
  images text[] not null default '{}',
  active boolean not null default true,
  featured boolean not null default false,
  sort int not null default 0
);

create table if not exists rewards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  stars_required int not null check (stars_required > 0),
  image text,
  active boolean not null default true,
  sort int not null default 0
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  phone text unique not null,
  consent_at timestamptz not null,
  consent_version text not null,
  token_hash bytea,
  stars int not null default 0 check (stars >= 0),
  pending_reward_id uuid references rewards(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists star_events (
  id bigint generated always as identity primary key,
  customer_id uuid not null references customers(id) on delete cascade,
  kind text not null check (kind in ('earn', 'redeem', 'adjust')),
  delta int not null,
  reward_id uuid references rewards(id) on delete set null,
  reward_name text,
  created_at timestamptz not null default now()
);
create index if not exists star_events_customer_idx on star_events (customer_id, created_at desc);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  number int generated always as identity,
  customer_id uuid not null references customers(id) on delete cascade,
  items jsonb not null,
  total int not null,
  notes text,
  status text not null default 'nuevo' check (status in ('nuevo', 'preparando', 'entregado', 'cancelado')),
  created_at timestamptz not null default now()
);
create index if not exists orders_created_idx on orders (created_at desc);

create table if not exists admin_config (
  id int primary key default 1 check (id = 1),
  password_hash text not null,
  business_key text not null
);

create table if not exists admin_sessions (
  token_hash bytea primary key,
  expires_at timestamptz not null
);

do $$
declare t text;
begin
  foreach t in array array['settings','menus','categories','products','rewards','customers','star_events','orders','admin_config','admin_sessions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end $$;

insert into admin_config (id, password_hash, business_key)
values (1, extensions.crypt('{{ADMIN_INITIAL_PASSWORD}}', extensions.gen_salt('bf')), encode(extensions.gen_random_bytes(18), 'hex'))
on conflict (id) do nothing;

insert into settings (id, data) values (1, '{}'::jsonb) on conflict (id) do nothing;
