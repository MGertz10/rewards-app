-- User-entered card metadata (statement close day, due day, credit limit, etc.)
-- Replaces localStorage storage so data persists across devices and PWA contexts.

create table if not exists user_card_metadata (
  card_id               text primary key,          -- matches CARDS[].id in lib/cards.ts
  opened_date           text,                       -- ISO YYYY-MM-DD
  statement_close_day   integer,                    -- 1-31
  due_day               integer,                    -- 1-31
  credit_limit          numeric(12,2),
  last4                 text,                       -- 4 digits
  active                boolean default true,
  cert_expiry           text,                       -- Marriott free night cert expiry ISO date
  cert_count            integer,                    -- number of valid certs
  updated_at            timestamptz default now()
);
