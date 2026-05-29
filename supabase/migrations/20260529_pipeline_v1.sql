-- Pipeline v1: Add pipeline_version column and new status values
-- Also add index on audit_logs for efficient polling

-- Add pipeline_version to audits
ALTER TABLE audits ADD COLUMN IF NOT EXISTS pipeline_version text DEFAULT NULL;

-- Add index for fetching recent audit_logs by audit_id (used by activity feed polling)
CREATE INDEX IF NOT EXISTS idx_audit_logs_audit_id_created ON audit_logs (audit_id, created_at DESC);

-- Add index for detecting stale audits
CREATE INDEX IF NOT EXISTS idx_audits_status_updated ON audits (status, updated_at) WHERE status IN ('payment_received', 'crawling', 'analysing', 'generating_report');
