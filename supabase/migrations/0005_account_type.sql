-- 0005_account_type.sql
-- Adds Plaid account type/subtype to card_balances so we can correctly classify
-- credit cards vs depository/investment accounts without relying on credit_limit being set.
-- Chase, in particular, sometimes omits credit_limit for card accounts.

ALTER TABLE card_balances
  ADD COLUMN IF NOT EXISTS account_type    text,   -- 'credit' | 'depository' | 'investment' | 'loan'
  ADD COLUMN IF NOT EXISTS account_subtype text;   -- 'credit_card' | 'checking' | 'savings' | '401k' | 'hsa' etc.
