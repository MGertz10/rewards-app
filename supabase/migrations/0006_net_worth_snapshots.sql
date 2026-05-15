-- Net worth snapshots — one row per day, upserted by the dashboard on load.
-- Enables the net worth trend graph without any external data source.

CREATE TABLE IF NOT EXISTS net_worth_snapshots (
  recorded_date   date        PRIMARY KEY,
  total_assets    numeric     NOT NULL DEFAULT 0,
  total_liabilities numeric   NOT NULL DEFAULT 0,
  net_worth       numeric     NOT NULL DEFAULT 0,
  breakdown       jsonb,       -- { cash, investment, retirement, hsa, credit }
  created_at      timestamptz DEFAULT now()
);
