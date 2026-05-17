-- Feature ideas / roadmap tracker
-- Pre-seeded with all backlog items from the initial build sessions.

CREATE TABLE IF NOT EXISTS feature_ideas (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT        NOT NULL,
  category    TEXT        NOT NULL DEFAULT 'General',
  status      TEXT        NOT NULL DEFAULT 'idea', -- idea | in_progress | done
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
