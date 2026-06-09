-- ============================================================
-- Migration: Add completed_with_warnings to audit_status enum
--
-- Root cause: Tasks #851 and #862 updated 26 source files to
-- handle this status but never added the value to the PostgreSQL
-- enum. Every query using .in('status', ['completed', 'completed_with_warnings'])
-- was failing silently because PostgREST cannot cast an invalid
-- enum value — returning null data instead of audit rows.
--
-- This was the root cause of "audits exist in DB but are
-- invisible in workspace UI."
-- ============================================================

ALTER TYPE audit_status ADD VALUE IF NOT EXISTS 'completed_with_warnings';
ALTER TYPE audit_status ADD VALUE IF NOT EXISTS 'stalled';
