// ============================================================
// Insert contracts — the schema drift firewall (Plan §0.3)
// ============================================================
// Eight separate incidents in June 2026 came from ONE disease:
// code writing a key the live table doesn't have. supabase-js
// never throws — the whole row batch is rejected and the error
// is returned, not raised. Result: viewport (3 days of fabricated
// scores), question_text_snapshot, accuracy, NUL-byte pages,
// pagespeed `category`/`position`, wcag_checklist/wcag_score,
// code_quality.
//
// Two nets, one registry:
//   1. CI-time  — schema-contract.test.ts asserts every key below
//      exists as a column in schema-snapshot.json (live truth).
//      Add a payload key without a migration → CI fails.
//   2. Runtime  — filterRowsToContract() strips keys outside the
//      contract and reports them loudly, so an unregistered key
//      costs ONE field, never the whole batch.
//
// Workflow when adding a column to a write path:
//   migration file + apply live + refresh schema-snapshot.json
//   (scripts/schema-snapshot.sql) + add the key here — ONE commit.

import snapshot from './schema-snapshot.json'

export type ContractTable = keyof typeof INSERT_CONTRACTS

/** Keys our writers are allowed to put in .insert() payloads, per table. */
export const INSERT_CONTRACTS = {
  audit_findings: [
    'audit_id', 'checklist_item_id', 'category_index', 'finding_type', 'fix_type',
    'severity', 'title', 'description', 'evidence', 'page_url', 'recommendation',
    'estimated_impact', 'target_element', 'screenshot_url', 'sort_order',
    'confidence_level', 'detection_source', 'communication', 'fix_format',
    'is_editable', 'is_deployable', 'approval_required', 'fix_status',
    'deployable_type', 'default_owner', 'ai_interpretation', 'human_interpretation',
    'viewport', 'status', 'dismissed', 'performance_metric_type', 'owner_team',
    'issue_family_id', 'status_in_audit', 'score_impact', 'scope_json',
    'page_count_affected', 'confidence_score', 'business_relevance',
  ],
  audit_pages: [
    'audit_id', 'url', 'title', 'h1', 'meta_description', 'content_text',
    'links_found', 'broken_links', 'has_structured_data', 'structured_data',
    'status_code', 'load_time_ms', 'is_mobile_friendly', 'viewport_meta',
    'crawled_at', 'crawl_status', 'skip_reason', 'canonical_url', 'is_duplicate',
    'page_type', 'fetch_strategy', 'screenshot_url', 'ai_readability',
    'technical_audit', 'performance_data', 'code_quality',
  ],
  audit_logs: ['audit_id', 'event', 'status', 'message', 'metadata'],
  reports: [
    'audit_id', 'executive_summary', 'key_recommendation', 'total_issues',
    'critical_count', 'high_count', 'medium_count', 'low_count', 'overall_score',
    'ux_score', 'conversion_score', 'mobile_score', 'content_score',
    'ai_discoverability_score', 'raw_json', 'pdf_url', 'pdf_generated_at',
    'ai_visibility_breakdown', 'model_benchmarks', 'brand_intelligence',
  ],
  workspace_ai_interrogations: [
    'workspace_id', 'user_id', 'question_id', 'question_text_snapshot',
    'question_family', 'selected_models', 'status', 'started_at',
    'source_question_set_id', 'is_followup', 'parent_interrogation_id',
  ],
  workspace_ai_interrogation_results: [
    'interrogation_id', 'model_slug', 'model_label', 'provider', 'status',
    'response_text', 'response_summary', 'themes', 'latency_ms', 'token_input',
    'token_output', 'estimated_cost_cents', 'error_message', 'accuracy',
    'accuracy_note',
  ],
  // Capture→Analyze→Compose Phase 1 — immutable PageCapture (shadow mode).
  page_captures: [
    'audit_id', 'workspace_id', 'user_id', 'page_url', 'page_status', 'http_status',
    'capture_schema_version', 'capture_renderer_version', 'fetch_strategy',
    'rendered_html_key', 'screenshot_keys', 'axe_raw_key',
    'title', 'h1', 'headings', 'links', 'form_presence', 'lang', 'meta',
    'dom_facts', 'extracted_text', 'viewport_results', 'captured_at',
  ],
  // Coverage-limitation decisions — workspace memory (dismiss/promote).
  coverage_limitation_decisions: [
    'workspace_id', 'user_id', 'audit_id', 'page_url', 'reason', 'decision',
    'finding_id', 'updated_at',
  ],
  // Phase 3 — fix-outcomes dataset (one row per fix verification attempt).
  fix_outcomes: [
    'finding_id', 'audit_id', 'workspace_id', 'user_id', 'issue_family_id',
    'page_url', 'detection_source', 'outcome', 'severity_before',
    'evidence_before', 'evidence_after', 'marked_fixed_at', 'verified_at',
    'time_to_fix_seconds', 'recheck_method', 'recheck_meta',
  ],
} as const

/** Keys our writers are allowed to put in .update() payloads, per table.
 *  (The wcag_checklist/wcag_score incident was an UPDATE, not an insert —
 *  updates against missing columns fail just as silently.) */
export const UPDATE_CONTRACTS = {
  audit_findings: ['verification_status', 'verification_note', 'screenshot_url', 'status', 'status_updated_at', 'status_note', 'dismissed', 'dismissal_reason', 'dismissed_at', 'verified_fixed_at'],
  audit_pages: ['is_mobile_friendly', 'viewport_meta', 'wcag_checklist', 'wcag_score', 'ai_readability', 'screenshot_url', 'technical_audit', 'code_quality', 'performance_data', 'excluded_from_score'],
  reports: ['total_issues', 'critical_count', 'high_count', 'medium_count', 'low_count', 'overall_score', 'pdf_url', 'pdf_generated_at', 'updated_at', 'raw_json', 'model_benchmarks', 'brand_intelligence'],
  workspace_ai_interrogations: ['status', 'token_input_total', 'token_output_total', 'estimated_cost_cents', 'completed_at', 'usage_units_consumed'],
  workspace_ai_interrogation_results: ['response_text', 'response_summary', 'themes', 'latency_ms', 'token_input', 'token_output', 'estimated_cost_cents', 'accuracy', 'accuracy_note', 'status', 'error_message'],
} as const

/** Live columns for a table, from the checked-in snapshot. */
export function snapshotColumns(table: string): string[] {
  const t = (snapshot as Record<string, unknown>)[table] as { columns?: string[] } | undefined
  return t?.columns ?? []
}

/** NOT NULL columns without defaults — must be present in inserts. */
export function snapshotRequired(table: string): string[] {
  const t = (snapshot as Record<string, unknown>)[table] as { required?: string[] } | undefined
  return t?.required ?? []
}

export interface ContractFilterResult<T> {
  rows: T[]
  /** Keys found in payloads that are NOT in the contract — schema drift. */
  unknownKeys: string[]
}

/**
 * Strip payload keys that are outside the table's insert contract.
 * Defense in depth for the runtime: an unregistered key costs one
 * field (loudly reported by the caller), never the whole batch.
 */
export function filterRowsToContract<T extends Record<string, unknown>>(
  table: ContractTable,
  rows: T[],
): ContractFilterResult<T> {
  const allowed = new Set<string>(INSERT_CONTRACTS[table])
  const unknown = new Set<string>()
  const filtered = rows.map((row) => {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(row)) {
      if (allowed.has(key)) out[key] = row[key]
      else unknown.add(key)
    }
    return out as T
  })
  return { rows: filtered, unknownKeys: [...unknown].sort() }
}
