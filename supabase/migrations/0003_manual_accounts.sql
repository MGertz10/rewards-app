-- Manually entered accounts for institutions Plaid can't connect
-- (Fidelity, UBS ESPP, Inspira HSA, BoA HSA, etc.)
-- User updates balances periodically; feeds net worth on the Dashboard.

create table if not exists manual_accounts (
  id            uuid default uuid_generate_v4() primary key,
  name          text not null,                        -- e.g. "Fidelity Roth IRA"
  institution   text not null default '',             -- e.g. "Fidelity"
  account_type  text not null default 'other',        -- checking|savings|investment|retirement|hsa|loan|other
  balance       numeric(12,2) not null default 0,     -- positive = asset, negative = liability
  notes         text,
  updated_at    timestamptz default now()
);
