-- Investment holdings for manually-tracked accounts (Fidelity, UBS, etc.)
-- Each row is one position: ticker + share count + optional cost basis.
-- Live prices are fetched at read-time from /api/prices (Yahoo Finance).

create table if not exists manual_holdings (
  id                   uuid default uuid_generate_v4() primary key,
  account_id           uuid not null references manual_accounts(id) on delete cascade,
  ticker               text not null,                        -- e.g. "FXAIX", "AAPL", "BRK.B"
  name                 text,                                 -- friendly name, e.g. "Fidelity 500 Index"
  shares               numeric(14,6) not null default 0,
  cost_basis_per_share numeric(12,4),                       -- optional, used for gain/loss
  asset_class          text not null default 'equity',      -- equity|bond|fund|cash|crypto|other
  updated_at           timestamptz default now()
);

-- Holdings synced from Plaid Investments product (Merrill Lynch 401k + HSA)
-- Populated by /api/plaid/sync when the item has the investments product.

create table if not exists plaid_holdings (
  id               uuid default uuid_generate_v4() primary key,
  plaid_account_id text not null,
  item_id          text not null references plaid_items(item_id) on delete cascade,
  ticker           text,                    -- null for funds without a ticker
  name             text not null,
  quantity         numeric(14,6),
  close_price      numeric(12,4),           -- Plaid's last close price
  cost_basis       numeric(12,4),           -- per share, if Plaid provides it
  value            numeric(12,2),           -- quantity * close_price
  asset_class      text,
  as_of            timestamptz default now(),
  unique (plaid_account_id, name)           -- upsert key: account + holding name
);
