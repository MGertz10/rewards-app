-- Rewards App — initial schema
-- Single-user app; RLS is noted but not enforced in v1.
-- Run via: supabase db push  (or paste into Supabase SQL editor)

-- ── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── plaid_items ──────────────────────────────────────────────────────────────
-- One row per linked bank/card institution.
create table if not exists plaid_items (
  item_id               text primary key,
  access_token_encrypted text not null,       -- AES-GCM encrypted
  institution           text not null default 'Unknown',
  cursor                text,                 -- transactions sync cursor
  updated_at            timestamptz not null default now()
);

-- ── card_balances ─────────────────────────────────────────────────────────────
-- Latest balance snapshot per Plaid account. Refreshed daily by cron.
create table if not exists card_balances (
  plaid_account_id  text primary key,
  item_id           text references plaid_items(item_id) on delete cascade,
  name              text,
  mask              text,                     -- last 4
  current_balance   numeric(12,2),
  available_balance numeric(12,2),
  credit_limit      numeric(12,2),
  utilization_pct   numeric(5,1),
  as_of             timestamptz not null default now()
);

-- ── transactions ──────────────────────────────────────────────────────────────
create table if not exists transactions (
  id                uuid primary key default uuid_generate_v4(),
  plaid_tx_id       text unique not null,
  plaid_account_id  text references card_balances(plaid_account_id) on delete cascade,
  item_id           text references plaid_items(item_id) on delete cascade,
  posted_at         date not null,
  amount            numeric(12,2) not null,   -- positive = debit, negative = credit
  merchant_raw      text,
  category          text,
  pending           boolean not null default false,
  created_at        timestamptz not null default now()
);
create index if not exists transactions_posted_at_idx on transactions(posted_at desc);
create index if not exists transactions_account_idx  on transactions(plaid_account_id);

-- ── alerts ────────────────────────────────────────────────────────────────────
create table if not exists alerts (
  id              uuid primary key default uuid_generate_v4(),
  type            text not null,              -- 'payment_due' | 'fee_renewal' | 'points_expiry' | 'over_pace'
  severity        text not null default 'info', -- 'high' | 'medium' | 'low' | 'info'
  title           text not null,
  body            text,
  due_at          timestamptz,
  dismissed_at    timestamptz,
  sent_email_at   timestamptz,
  payload         jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists alerts_due_at_idx on alerts(due_at);

-- ── applications_log ─────────────────────────────────────────────────────────
-- Manual log for 5/24 tracking.
create table if not exists applications_log (
  id          uuid primary key default uuid_generate_v4(),
  card_name   text not null,
  issuer      text not null,
  applied_at  date not null,
  approved_at date,
  inquiry     boolean not null default true,  -- false = soft pull only
  notes       text,
  created_at  timestamptz not null default now()
);

-- ── points_balances ───────────────────────────────────────────────────────────
-- Manually updated point balances (Plaid doesn't expose rewards data).
create table if not exists points_balances (
  id          uuid primary key default uuid_generate_v4(),
  program     text not null,                 -- 'chase_ur' | 'capital_one' | 'marriott_bonvoy'
  balance     integer not null default 0,
  cert_count  integer not null default 0,
  expires_at  date,
  source      text,                          -- 'manual' | 'plaid' (future)
  as_of       timestamptz not null default now()
);

-- ── trips ─────────────────────────────────────────────────────────────────────
create table if not exists trips (
  id        uuid primary key default uuid_generate_v4(),
  name      text not null,
  dest      text,
  start_dt  date,
  end_dt    date,
  travelers integer not null default 1,
  payload   jsonb,
  created_at timestamptz not null default now()
);

-- ── kv_cache ──────────────────────────────────────────────────────────────────
-- Generic key-value cache for refreshable strategy data (promos, CPP, etc.)
create table if not exists kv_cache (
  key          text primary key,
  value        jsonb not null,
  refreshed_at timestamptz not null default now()
);
