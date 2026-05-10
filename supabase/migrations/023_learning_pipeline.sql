-- ============================================================
-- ClearUX — Learning Pipeline Tables
-- These tables power the proprietary feedback loop:
--   - finding_patterns: tracks dismiss/accept rates per finding type
--   - global_quality_stats: cross-user aggregate quality metrics
--   - rule_changelog: audit trail for pipeline rule changes
-- ============================================================

-- ── Finding Patterns ────────────────────────────────────────
-- Tracks how often each finding type gets dismissed vs acted on.
-- Used by the Relevance Scorer to flag low-confidence findings.
-- Key: normalized title fingerprint (lowercase, stripped, hashed).

CREATE TABLE IF NOT EXISTS finding_patterns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_hash      TEXT NOT NULL,                -- normalized title fingerprint
  canonical_title TEXT NOT NULL,                -- human-readable representative title
  topic           TEXT,                          -- topic cluster (from dedup topic patterns)
  total_shown     INT NOT NULL DEFAULT 0,       -- how many times this pattern was shown to users
  total_dismissed INT NOT NULL DEFAULT 0,       -- how many times users dismissed it
  total_fixed     INT NOT NULL DEFAULT 0,       -- how many times users marked it as fixed
  total_accepted  INT NOT NULL DEFAULT 0,       -- how many times users left it open (acted on it)
  avg_severity    REAL,                          -- average severity weight across occurrences
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(title_hash)
);

CREATE INDEX IF NOT EXISTS idx_finding_patterns_hash ON finding_patterns(title_hash);
CREATE INDEX IF NOT EXISTS idx_finding_patterns_topic ON finding_patterns(topic) WHERE topic IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_finding_patterns_dismiss_rate
  ON finding_patterns(total_shown, total_dismissed)
  WHERE total_shown >= 5;

-- ── Global Quality Stats ────────────────────────────────────
-- Aggregate metrics per finding category/topic across ALL users.
-- Used by Quality Stats engine for threshold tuning and reporting.

CREATE TABLE IF NOT EXISTS global_quality_stats (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stat_period         TEXT NOT NULL,            -- 'all_time' | '2025-05' (monthly)
  stat_type           TEXT NOT NULL,            -- 'by_topic' | 'by_severity' | 'by_module'
  stat_key            TEXT NOT NULL,            -- topic name, severity level, or module slug
  total_findings      INT NOT NULL DEFAULT 0,
  total_dismissed     INT NOT NULL DEFAULT 0,
  total_fixed         INT NOT NULL DEFAULT 0,
  total_open          INT NOT NULL DEFAULT 0,
  false_positive_rate REAL,                     -- dismissed / total_findings
  avg_time_to_fix_hrs REAL,                     -- average hours from created to fixed
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(stat_period, stat_type, stat_key)
);

CREATE INDEX IF NOT EXISTS idx_quality_stats_lookup
  ON global_quality_stats(stat_period, stat_type);

-- ── Rule Changelog ──────────────────────────────────────────
-- Audit trail for every change the learning engine makes to
-- pipeline rules. Enables rollback and impact measurement.

CREATE TABLE IF NOT EXISTS rule_changelog (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type       TEXT NOT NULL,                -- 'synonym' | 'topic_pattern' | 'speculative_regex' | 'whitelist' | 'threshold'
  action          TEXT NOT NULL,                -- 'added' | 'removed' | 'modified' | 'proposed'
  rule_key        TEXT NOT NULL,                -- what changed (e.g., "SYNONYM_GROUP: unclear" or "THRESHOLD: BASE")
  old_value       TEXT,                          -- previous value (JSON or string)
  new_value       TEXT,                          -- new value (JSON or string)
  reason          TEXT NOT NULL,                -- why the change was made
  confidence      REAL,                          -- 0.0 - 1.0: how confident the learner is
  data_points     INT,                          -- how many observations drove this change
  auto_applied    BOOLEAN NOT NULL DEFAULT false, -- true if auto-applied, false if proposed
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rule_changelog_type ON rule_changelog(rule_type, created_at DESC);

-- ── RLS Policies ────────────────────────────────────────────
-- These tables are written by the service role (Inngest functions)
-- and read by admins. No user-facing RLS needed.

ALTER TABLE finding_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_quality_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_changelog ENABLE ROW LEVEL SECURITY;

-- Service role has full access (used by Inngest)
-- Admin users can read for dashboard/analytics
DROP POLICY IF EXISTS "Service role full access" ON finding_patterns;
CREATE POLICY "Service role full access" ON finding_patterns FOR ALL USING (true);

DROP POLICY IF EXISTS "Service role full access" ON global_quality_stats;
CREATE POLICY "Service role full access" ON global_quality_stats FOR ALL USING (true);

DROP POLICY IF EXISTS "Service role full access" ON rule_changelog;
CREATE POLICY "Service role full access" ON rule_changelog FOR ALL USING (true);
