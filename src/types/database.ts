// ============================================================
// ClearUX SaaS — Database Types
// Auto-generated from schema. Keep in sync with migrations.
// ============================================================

// ── Workspace ───────────────────────────────────────────────

export type WorkspaceType = 'website' | 'brand' | 'website_and_brand'
export type WorkspaceStatus = 'active' | 'archived'

export interface Workspace {
  id:                       string
  user_id:                  string
  name:                     string
  slug:                     string
  primary_domain:           string | null
  brand_name:               string | null
  workspace_type:           WorkspaceType
  status:                   WorkspaceStatus
  active_audit_id:          string | null
  active_brand_identity_id: string | null
  settings_json:            Record<string, unknown>
  // Workspace enrichment (AI interrogation context)
  category:                 string | null
  subcategory:              string | null
  region:                   string | null
  country:                  string | null
  city:                     string | null
  language:                 string
  audience_type:            string | null
  created_at:               string
  updated_at:               string
  archived_at:              string | null
}

export type AuditStatus =
  | 'pending_payment'
  | 'payment_received'
  | 'crawling'
  | 'analysing'
  | 'generating_report'
  | 'completed'
  | 'failed'
  | 'completed_with_warnings'
  | 'stalled'

export type PaymentStatus =
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'refunded'

export type FindingSeverity =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'

export type FindingViewport =
  | 'mobile'
  | 'desktop'
  | 'tablet'
  | 'all'
  | 'cross-viewport'
  | 'technical'
  | 'brand-dna'
  | null

export type AuditDepthMode = 'standard' | 'deep'

export type AuditType = 'website' | 'brand_identity' | 'design'

// ── TABLE TYPES ──────────────────────────────────────────────

export interface Profile {
  id:          string
  full_name:   string | null
  company:     string | null
  email:       string
  avatar_url:  string | null
  audit_count: number
  credits:     number
  created_at:  string
  updated_at:  string
  // Billing / company details (optional — for invoices)
  billing_company_name:  string | null
  billing_vat_number:    string | null
  billing_address_line1: string | null
  billing_address_line2: string | null
  billing_city:          string | null
  billing_postal_code:   string | null
  billing_country:       string | null
  // White-label (Agency/Scale packages or Pro+ subscriptions)
  white_label:   boolean
  package_tier:  string
  // Subscription
  subscription_plan:     string | null  // 'starter' | 'pro' | 'agency' | null
  subscription_status:   string | null  // 'active' | 'cancelled' | 'past_due' | null
  subscription_interval: string | null  // 'monthly' | 'yearly' | null
  stripe_customer_id:    string | null
  stripe_subscription_id: string | null
  audits_remaining:      number         // monthly allowance remaining (legacy counter — prefer audit-usage.ts query)
  audits_per_month:      number         // monthly allowance total
  deep_audits_per_month: number         // monthly deep-audit entitlement
  // Billing period boundaries (set by Stripe webhook)
  billing_period_start:  string | null  // ISO timestamp — start of current billing period
  billing_period_end:    string | null  // ISO timestamp — end of current billing period
  // AI interrogation entitlement
  ai_checks_per_month: number
  // Admin role
  role:          'user' | 'admin' | 'super_admin'
  // Email preferences
  marketing_emails: boolean
  welcome_email_sent: boolean
}

export interface Audit {
  id:                string
  user_id:           string
  status:            AuditStatus
  product_url:       string | null
  product_type:      string
  audit_type:        AuditType
  target_user:       string | null
  ux_concern:        string
  notes:             string | null
  plan:              'quick_scan' | 'full_audit' | 'agency_pro' | 'agency_scale' | 'free_preview' | null
  language:          string | null
  pages_crawled:     number
  progress_percent:  number | null
  crawl_error:       string | null
  delivery_deadline: string | null
  completed_at:      string | null
  created_at:        string
  updated_at:        string
  // White-label branding (optional, Agency/Scale only)
  white_label_company_name: string | null
  white_label_logo_url:     string | null
  // Free preview support
  is_free_preview:    boolean
  claimed_by:         string | null
  free_audit_email:   string | null
  // Sharing
  share_token:        string | null
  share_enabled:      boolean
  // Depth mode: 'standard' = re-audit checks only baseline findings; 'deep' = find new issues
  depth_mode:         AuditDepthMode
  // Pillar selection: null = all pillars (full audit), array of indices = partial audit
  selected_pillars:   number[] | null
  // Brand identity for Design Consistency Brand DNA enrichment
  brand_identity_id:  string | null
  // Module selection (slug-based): null = complete audit
  selected_modules:   string[] | null
  // Re-audit linkage
  previous_audit_id:  string | null
  // Industry classification (Phase 4)
  detected_industry:  string | null
  // Crawl summary (Fix 4 — crawl transparency)
  crawl_summary:      CrawlSummary | null
  crawl_started_at:   string | null
  crawl_completed_at: string | null
  // Performance summary (Fix 3)
  performance_summary: PerformanceSummary | null
  // Role-based summaries (Fix 5)
  role_summaries: RoleSummaries | null
  // Website Speed (PageSpeed Insights)
  speed_data:       SpeedDataSummary | null
  speed_tested_at:  string | null
  // Progressive loading: current pipeline stage
  audit_stage:      AuditStage | null
  // Workspace scoping
  workspace_id:     string | null
  // Pipeline version (v1, v2, etc.) — null for legacy audits
  pipeline_version: string | null
  // Canonical issue reconciliation (migration 050)
  audit_run_type:           AuditRunType
  trigger_source:           AuditTriggerSource
  coverage_summary_json:    Record<string, unknown> | null
  score_version:            string | null
  reconciliation_summary:   Record<string, unknown> | null
  // Soft-delete timestamp (workspace isolation — migration 048)
  deleted_at:               string | null
}

/** Pipeline stage for progressive frontend loading */
export type AuditStage = 'preflight' | 'crawling' | 'checking' | 'probing' | 'analysing' | 'reporting' | 'enriching' | 'complete'

/** Structured crawl summary stored as jsonb on audits table */
export interface CrawlSummary {
  urls_discovered:      number
  pages_analyzed:       number
  pages_skipped:        number
  pages_blocked:        number
  pages_duplicate:      number
  pages_excluded:       number
  js_pages_detected:    number
  avg_load_time_ms:     number | null
  discovery_sources:    {
    sitemap:       number
    html_links:    number
    common_paths:  number
  }
  excluded_urls:        Array<{ url: string; reason: string }>
  coverage_notes:       string[]
}

/** Per-page performance data — stored as jsonb on audit_pages.performance_data */
export interface PagePerformanceData {
  /** Estimated Largest Contentful Paint in ms (heuristic from page weight + blocking resources) */
  lcp_estimate_ms:        number | null
  /** Estimated Interaction to Next Paint in ms (heuristic from script count + weight) */
  inp_estimate_ms:        number | null
  /** Estimated Cumulative Layout Shift score (heuristic from images without dimensions) */
  cls_estimate:           number | null
  /** Total page weight in KB (HTML + inline resources) */
  page_weight_kb:         number
  /** Total number of <script> tags */
  script_count:           number
  /** Estimated total JS weight in KB (inline scripts) */
  script_weight_kb:       number
  /** Number of render-blocking scripts (no async/defer) */
  render_blocking_scripts: number
  /** Total number of images */
  image_count:            number
  /** Estimated image weight in KB (from src attributes) */
  image_weight_kb:        number
  /** Images missing width/height attributes (cause layout shift) */
  images_missing_dimensions: number
  /** Images not using lazy loading */
  images_not_lazy:        number
  /** Number of third-party script domains */
  third_party_count:      number
  /** List of third-party domains detected */
  third_party_domains:    string[]
  /** Number of CSS <link> tags (render-blocking by default) */
  css_count:              number
  /** Number of web fonts detected */
  font_count:             number
  /** Overall performance rating */
  rating:                 'good' | 'needs_improvement' | 'poor'
}

/** Site-level performance summary — stored as jsonb on audits.performance_summary */
export interface PerformanceSummary {
  /** Number of pages with performance data */
  pages_analyzed:         number
  /** Average estimated LCP across pages */
  avg_lcp_ms:             number | null
  /** Average estimated INP across pages */
  avg_inp_ms:             number | null
  /** Average estimated CLS across pages */
  avg_cls:                number | null
  /** Average page weight in KB */
  avg_page_weight_kb:     number
  /** Total third-party domains found across all pages */
  unique_third_party_domains: string[]
  /** Pages with render-blocking scripts */
  pages_with_blocking_scripts: number
  /** Pages with images missing dimensions */
  pages_with_layout_shift_risk: number
  /** Pages rated 'poor' */
  pages_poor:             number
  /** Pages rated 'needs_improvement' */
  pages_needs_improvement: number
  /** Pages rated 'good' */
  pages_good:             number
  /** Overall site performance rating */
  overall_rating:         'good' | 'needs_improvement' | 'poor'
  /** Plain-language summary of top performance concerns */
  top_concerns:           string[]
}

/** PageSpeed Insights data stored as jsonb on audits.speed_data */
export interface SpeedDataSummary {
  mobile: SpeedStrategyResult | null
  desktop: SpeedStrategyResult | null
  testedAt: string
}

export interface SpeedCategoryScores {
  /** Performance score 0-100 */
  performance: number
  /** Accessibility score 0-100 */
  accessibility: number
  /** Best Practices score 0-100 */
  bestPractices: number
  /** SEO score 0-100 */
  seo: number
}

export interface SpeedStrategyResult {
  /** Overall performance score 0-100 (backward compat) */
  score: number
  /** All four Lighthouse category scores */
  categories?: SpeedCategoryScores
  strategy: 'mobile' | 'desktop'
  metrics: {
    fcp?: SpeedMetric
    lcp: SpeedMetric
    cls: SpeedMetric
    inp: SpeedMetric
    ttfb: SpeedMetric
    speedIndex: SpeedMetric
    tbt: SpeedMetric
  }
  /** Count of failing diagnostics */
  issueCount: number
  finalUrl: string
  /** Base64-encoded screenshot thumbnail (data URI) */
  screenshotUrl?: string | null
  testedAt: string
}

export interface SpeedMetric {
  value: number
  displayValue: string
  status: 'good' | 'needs_improvement' | 'poor'
}

export type OwnerTeam = 'engineering' | 'marketing' | 'product' | 'design'

/** Stakeholder roles for role-based views and handoff */
export type StakeholderRole = 'executive' | 'marketing' | 'product_ux' | 'engineering'

/** Handoff payload attached to a finding for team export */
export interface HandoffPayload {
  /** One-line summary for the stakeholder */
  summary:        string
  /** Why this matters to the business */
  business_impact: string
  /** Concrete next steps */
  next_steps:     string[]
  /** Effort estimate */
  effort:         'quick_win' | 'moderate' | 'significant'
  /** Priority rank within this role's view (lower = higher priority) */
  priority_rank:  number
}

/** Per-role summary stored on the audit */
export interface RoleSummary {
  role:            StakeholderRole
  /** Total findings relevant to this role */
  finding_count:   number
  /** High-severity findings for this role */
  critical_count:  number
  /** Top 3 issues as plain-language bullets */
  top_issues:      string[]
  /** Business impact summary */
  impact_summary:  string
  /** Recommended next steps */
  next_steps:      string[]
}

/** All role summaries for an audit */
export interface RoleSummaries {
  generated_at:  string
  summaries:     RoleSummary[]
}

export interface ScheduledAudit {
  id:          string
  user_id:     string
  product_url: string
  frequency:   'weekly' | 'monthly' | 'quarterly'
  language:    string
  is_active:   boolean
  last_run_at:   string | null
  next_run_at:   string | null
  created_at:    string
  updated_at:    string
  workspace_id:  string | null
}

export interface Payment {
  id:                       string
  audit_id:                 string
  user_id:                  string
  stripe_payment_intent_id: string | null
  stripe_customer_id:       string | null
  stripe_invoice_id:        string | null
  amount_cents:             number
  currency:                 string
  status:                   PaymentStatus
  invoice_url:              string | null
  receipt_url:              string | null
  created_at:               string
  updated_at:               string
}

export interface ChecklistCategory {
  id:          string
  name:        string
  slug:        string
  description: string | null
  icon:        string | null
  sort_order:  number
  is_active:   boolean
  created_at:  string
}

export interface ChecklistItem {
  id:            string
  category_id:   string
  title:         string
  description:   string
  what_to_check: string
  sort_order:    number
  is_active:     boolean
  created_at:    string
}

export interface AuditPage {
  id:                  string
  audit_id:            string
  url:                 string
  title:               string | null
  h1:                  string | null
  meta_description:    string | null
  content_text:        string | null
  links_found:         number
  broken_links:        string[]
  has_structured_data: boolean
  structured_data:     Record<string, unknown> | null
  status_code:         number | null
  load_time_ms:        number | null
  is_mobile_friendly:  boolean | null
  viewport_meta:       string | null
  screenshot_url:      string | null
  ai_readability:      AIPageReadability | null
  wcag_checklist:      string | null       // JSON-stringified WcagCheckResult[]
  wcag_score:          number | null       // 0-100 WCAG conformance score
  crawled_at:          string
  // Crawl metadata (Fix 4)
  crawl_status:        string | null       // 'success' | 'failed' | 'skipped' | 'blocked'
  skip_reason:         string | null       // why the page was skipped
  canonical_url:       string | null       // canonical URL if different from page URL
  is_duplicate:        boolean             // true if canonicalized to another URL
  page_type:           string | null       // 'content' | 'auth_gate' | 'redirect' | 'error'
  fetch_strategy:      string | null       // 'direct' | 'jina' | 'google_cache'
  // Performance data (Fix 3)
  performance_data:    PagePerformanceData | null
}

/** Per-page AI readability breakdown — stored as jsonb on audit_pages */
export interface AIPageReadability {
  /** What AI can extract from this page */
  extractable: string[]
  /** What AI misses or can't access */
  missing: string[]
  /** Structured data types present on this page */
  structuredDataTypes: string[]
  /** Head tag completeness: 0-100 */
  headTagScore: number
  /** Content extractability: 0-100 */
  contentScore: number
  /** Overall AI readability: 0-100 */
  overallScore: number
  /** Traffic light status */
  status: 'green' | 'amber' | 'red'
}

export type FindingStatus = 'open' | 'in_progress' | 'fixed' | 'backlog'

/** Status of a finding within a specific audit run (system-determined via reconciliation) */
export type FindingStatusInAudit = 'new' | 'still_present' | 'improved' | 'fixed' | 'regressed' | 'duplicate' | 'superseded' | 'invalidated'

/** Audit run type classification */
export type AuditRunType = 'first_audit' | 'reaudit' | 'deep_audit' | 'post_fix_verification'

/** Audit trigger source */
export type AuditTriggerSource = 'manual' | 'scheduled' | 'post_fix' | 'api' | 'webhook'
export type SiteNoteType = 'context' | 'dismissal' | 'discussion'

export interface SiteNote {
  id:            string
  user_id:       string
  domain:        string
  note_type:     SiteNoteType
  category:      string | null
  title:         string
  content:       string
  finding_ref:   string | null
  is_active:     boolean
  created_at:    string
  updated_at:    string
  workspace_id:  string | null
}

/**
 * Finding type — separates concrete, deployable fixes from broader observations.
 *
 * 'fixable'   — Concrete, actionable issue with a clear implementation path.
 *               Shown in the Fix Console. Must be deployable: HTML, schema,
 *               metadata, copy, or file changes the user can push from the console.
 *
 * 'strategic' — Broader observation that requires redesign, strategy, or judgment.
 *               Shown under "Strategic observations" on the Find tab.
 *               NOT shown in the Fix Console. Useful context but not deployable.
 */
export type FindingType = 'fixable' | 'strategic'

/**
 * Fix type — for fixable findings, describes the deployment mechanism.
 *
 * 'html'     — Edit existing HTML (heading structure, alt text, semantic tags)
 * 'meta'     — Add or change meta tags, OG tags, canonical, title tags
 * 'schema'   — Add or fix JSON-LD structured data
 * 'copy'     — Rewrite or improve text content (headlines, CTAs, descriptions)
 * 'file'     — Add a new file (robots.txt, sitemap.xml, llms.txt, etc.)
 * 'config'   — Server or platform config (redirects, headers, etc.)
 */
export type FixType = 'html' | 'meta' | 'schema' | 'copy' | 'file' | 'config' | null

/**
 * Dual-layer communication model for findings.
 * Every finding has a plain-language layer (for site owners, marketers)
 * and a technical layer (for developers). Plain-language comes FIRST.
 */
export interface FindingCommunication {
  /** Plain-language issue title — no jargon, names specific elements (e.g. "Your navigation menu is hidden on desktop") */
  title_plain: string
  /** What we found — plain-language description of what's happening, with evidence */
  what_found: string
  /** Why it matters — business/user impact in plain terms */
  why_matters: string
  /** Technical note — developer-facing detail (CSS selectors, HTML structure, WCAG refs, etc.) */
  technical_note: string | null
  /** Plain-language fix recommendation — what to do, not how to code it */
  fix_plain: string
  /** Technical fix recommendation — exact implementation (HTML, CSS, config changes) */
  fix_technical: string | null
}

export interface AuditFinding {
  id:                string
  audit_id:          string
  checklist_item_id: string | null
  category_index:    number | null       // 0-23 explicit category assignment (kills keyword-matching inference)
  finding_type:      FindingType          // 'fixable' or 'strategic'
  fix_type:          FixType              // deployment mechanism for fixable findings
  severity:          FindingSeverity
  title:             string
  description:       string
  evidence:          string | null
  page_url:          string | null
  recommendation:    string
  estimated_impact:  string | null
  target_element:    string | null
  screenshot_url:    string | null
  sort_order:        number
  status:            FindingStatus
  status_updated_at: string | null
  status_note:       string | null
  dismissed:         boolean
  dismissal_reason:  string | null
  dismissed_at:      string | null
  verification_status: 'confirmed_open' | 'likely_fixed' | 'poorly_fixed' | null
  verification_note:   string | null
  /** AI X-Ray: how AI interprets this element */
  ai_interpretation:   string | null
  /** AI X-Ray: how a human interprets the same element */
  human_interpretation: string | null
  /** Action model: user-selected action mode */
  action_mode:         'self_fix' | 'team_handoff' | 'defer' | 'fixed' | null
  /** Action model: normalized fix payload from capability map */
  fix_payload:         Record<string, unknown> | null
  /** Action model: patch format (text, html, json, meta, schema) */
  fix_format:          string | null
  /** Action model: whether patch content is user-editable */
  is_editable:         boolean
  /** Action model: whether finding can be deployed via surgical fix */
  is_deployable:       boolean
  /** Action model: whether user must approve before deploy */
  approval_required:   boolean
  /** Action model: fix lifecycle status */
  fix_status:          'unreviewed' | 'in_progress' | 'approved' | 'deferred' | 'fixed' | 'failed'
  /** Action model: deployable fix type key (meta_title, schema_jsonld, etc.) */
  deployable_type:     string | null
  /** Action model: default owner team */
  default_owner:       'self' | 'engineering' | 'marketing' | 'design' | 'product'
  /** Evidence contract: how certain the detection is */
  confidence_level:    'deterministic' | 'heuristic' | 'interpretive'
  /** Evidence contract: which pipeline stage produced this finding */
  detection_source:    'analyzer' | 'deep_analyzer' | 'wcag_checker' | 'responsive_checker' | 'structured_data' | 'head_tag' | 'crawler' | 'gap_fill' | 'brand_analyzer' | 'performance_checker' | 'pagespeed_api'
  /** Evidence contract: proposed replacement value for the current issue */
  proposed_value:      string | null
  /** Evidence contract: CSS selector or XPath targeting the affected element */
  affected_selector:   string | null
  /** Performance: which metric this finding relates to (lcp, inp, cls, page_weight, etc.) */
  performance_metric_type: string | null
  /** Performance: which team should own this fix */
  owner_team:          OwnerTeam | null
  /** Role-based: stakeholder roles this finding is relevant to */
  owner_roles:         StakeholderRole[]
  /** Role-based: primary stakeholder for this finding */
  primary_owner_role:  StakeholderRole | null
  /** Role-based: whether handoff package is ready */
  handoff_ready:       boolean
  /** Role-based: structured handoff payload for team export */
  handoff_payload:     HandoffPayload | null
  /** Dual-layer communication: plain-language + technical (JSONB, nullable for legacy) */
  communication:       FindingCommunication | null
  /** Viewport context: which viewport(s) this finding applies to */
  viewport:            FindingViewport
  /** Fix history gate: finding lifecycle state relative to prior audits */
  finding_state:       'new' | 'still_present' | 'reopened' | null
  created_at:        string
  // Canonical issue reconciliation (migration 050)
  issue_family_id:     string | null
  status_in_audit:     FindingStatusInAudit
  score_impact:        number
  scope_json:          Record<string, unknown> | null
  page_count_affected: number
  confidence_score:    number
  business_relevance:  number
}

export interface FindingActionHistory {
  id:          string
  finding_id:  string
  user_id:     string
  action:      'self_fix' | 'team_handoff' | 'defer' | 'fixed' | 'approve' | 'deploy' | 'reject'
  from_status: string | null
  to_status:   string
  note:        string | null
  metadata:    Record<string, unknown> | null
  created_at:  string
}

export interface Report {
  id:                       string
  audit_id:                 string
  executive_summary:        string
  key_recommendation:       string | null
  total_issues:             number
  critical_count:           number
  high_count:               number
  medium_count:             number
  low_count:                number
  overall_score:            number | null
  ux_score:                 number | null
  conversion_score:         number | null
  mobile_score:             number | null
  ai_discoverability_score: number | null
  content_score:            number | null
  raw_json:                 Record<string, unknown> | null
  pdf_url:                  string | null
  pdf_generated_at:         string | null
  ai_visibility_breakdown:  AIVisibilityBreakdown | null
  model_benchmarks:         ModelBenchmarksSummary | null
  created_at:               string
  updated_at:               string
}

/** AI Visibility Score breakdown — stored as jsonb on reports */
export interface AIVisibilityBreakdown {
  /** Structured data coverage: 0-100 */
  structuredData: number
  /** LLM probe accuracy: 0-100 */
  llmAccuracy: number
  /** Crawl infrastructure readiness: 0-100 (robots.txt, llms.txt, ai-plugin) */
  crawlInfrastructure: number
  /** Content extractability: 0-100 (head tags, meta, OG) */
  contentExtractability: number
  /** Overall AI Visibility Score: 0-100 */
  overall: number
}

/** Model benchmarks summary — stored as jsonb on reports */
export interface ModelBenchmarksSummary {
  /** Per-model accuracy scores */
  models: Array<{
    modelId: string
    modelLabel: string
    accuracyScore: number
  }>
  /** Best performing model */
  bestModel: string
  /** Average accuracy across all models */
  averageAccuracy: number
  /** Insight text */
  insight: string
}

/**
 * AI model identifiers. Now a string to support dynamic user-enabled
 * models via OpenRouter. Legacy short IDs ('claude', 'gpt4o', 'gemini',
 * 'perplexity') remain valid for backwards compatibility with existing DB data.
 */
export type AIModelId = string

export type MultiModelProbeStatus = 'measured' | 'skipped' | 'error'

export interface MultiModelProbe {
  id:                string
  audit_id:          string
  model_id:          string
  model_label:       string
  accuracy_score:    number
  accurate_count:    number
  partial_count:     number
  inaccurate_count:  number
  hallucinated_count: number
  no_data_count:     number
  total_questions:   number
  results_json:      Record<string, unknown>[]
  status:            MultiModelProbeStatus
  error_message:     string | null
  created_at:        string
}

export interface IndustryBenchmarkRow {
  id:           string
  industry:     string
  sample_size:  number
  avg_score:    number
  median_score: number
  p90_score:    number
  p10_score:    number
  distribution: Record<string, number>
  computed_at:  string
  created_at:   string
}

export interface PredictiveRecommendationRow {
  id:               string
  audit_id:         string
  action:           string
  predicted_impact: number
  confidence:       string
  data_points:      number
  avg_improvement:  number
  category:         string
  evidence:         string | null
  created_at:       string
}

export type LlmProbeAccuracy = 'accurate' | 'partial' | 'inaccurate' | 'hallucinated' | 'no_data'

export interface LlmProbeResult {
  id:            string
  audit_id:      string
  question:      string
  answer:        string
  accuracy:      LlmProbeAccuracy | null
  accuracy_note: string | null
  cited_url:     string | null
  model_used:    string
  created_at:    string
}

export type CitationType = 'direct_quote' | 'paraphrase' | 'reference' | 'ignored'

export interface AiCitation {
  id:            string
  audit_id:      string
  page_url:      string
  cited_text:    string
  ai_context:    string
  citation_type: CitationType
  model_used:    string
  created_at:    string
}

export type PlaybookType = 'json_ld' | 'meta_tags' | 'llms_txt' | 'robots_txt' | 'structured_data'

export interface FixPlaybook {
  id:            string
  audit_id:      string
  playbook_type: PlaybookType
  title:         string
  description:   string | null
  code_snippet:  string
  language:      string
  priority:      number
  created_at:    string
}

export interface AuditLog {
  id:         string
  audit_id:   string
  event:      string
  status:     'info' | 'success' | 'error' | 'warning'
  message:    string | null
  metadata:   Record<string, unknown>
  created_at: string
}

export interface WhiteLabelSettings {
  id:            string
  user_id:       string
  company_name:  string | null
  logo_url:      string | null
  brand_color:   string | null
  contact_email: string | null
  footer_text:   string | null
  is_active:     boolean
  created_at:    string
  updated_at:    string
}

export interface BrandIdentity {
  id:          string
  user_id:     string
  name:        string
  description: string | null
  // Phase 1 Brand DNA capture (migration 031). Optional so existing
  // rows continue to load; the UI prompts users to fill them in but
  // never blocks audit runs on missing values.
  website_url:    string | null
  brand_voice:    string | null
  tone_keywords:  string[]
  primary_colors: string[]
  logo_url:       string | null
  // Phase 2 Brand DNA columns (Supabase migration).
  logo_file_id:        string | null
  brand_guide_file_id: string | null
  brand_promise:       string | null
  created_at:     string
  updated_at:     string
  deleted_at:     string | null
  // Workspace scoping
  workspace_id:   string | null
}

export interface BrandIdentityFile {
  id:                string
  brand_identity_id: string
  file_name:         string
  file_url:          string
  file_type:         string | null
  file_size_bytes:   number | null
  version:           number
  replaces_file_id:  string | null
  tag:               string | null
  created_at:        string
}

export interface BrandAuditFileSnapshot {
  id:            string
  audit_id:      string
  brand_file_id: string
  file_name:     string
  file_url:      string
  created_at:    string
}

// ── VIEW TYPES ───────────────────────────────────────────────

export interface AuditOverview {
  id:               string
  user_id:          string
  status:           AuditStatus
  product_url:      string | null
  product_type:     string
  audit_type:       AuditType
  created_at:       string
  delivery_deadline: string | null
  completed_at:     string | null
  payment_status:   PaymentStatus | null
  overall_score:    number | null
  total_issues:     number | null
  critical_count:   number | null
  pdf_url:          string | null
}

// ── JOIN TYPES (for common queries) ─────────────────────────

export interface AuditWithReport extends Audit {
  report: Report | null
  payment: Payment | null
}

export interface FindingWithCategory extends AuditFinding {
  checklist_item: ChecklistItem & {
    category: ChecklistCategory
  } | null
}

export interface ReportWithFindings extends Report {
  findings: FindingWithCategory[]
  audit: Audit
}

// ── FTP / SFTP deployment ──────────────────────────────────────

export type FtpProtocol = 'ftp' | 'ftps' | 'sftp'
export type DeployAction = 'create' | 'update' | 'delete' | 'backup'
export type DeployStatus = 'success' | 'failed' | 'rolled_back'

export interface FtpConnection {
  id:                 string
  user_id:            string
  brand_identity_id:  string | null
  label:              string
  protocol:           FtpProtocol
  host:               string
  port:               number
  username:           string
  password_encrypted: string
  remote_path:        string
  last_connected_at:  string | null
  is_active:          boolean
  created_at:         string
  updated_at:         string
  workspace_id:       string | null
}

export interface FtpDeployLog {
  id:             string
  connection_id:  string
  user_id:        string
  audit_id:       string | null
  finding_id:     string | null
  file_path:      string
  action:         DeployAction
  backup_content: string | null
  new_content:    string | null
  status:         DeployStatus
  error_message:  string | null
  created_at:     string
}

// ── AI Interrogation Tables ──────────────────────────────────

export interface AIQuestionLibraryRow {
  id:                   string
  question_text:        string
  question_family:      string
  category:             string | null
  subcategory:          string | null
  region:               string | null
  language:             string
  audience_type:        string | null
  intent_tags:          string[]
  priority_score:       number
  is_active:            boolean
  followup_question_ids: string[]
  created_at:           string
  updated_at:           string
}

export interface WorkspaceAIQuestionSet {
  id:                   string
  workspace_id:         string
  generated_at:         string
  valid_until:          string
  category_snapshot:    string | null
  region_snapshot:      string | null
  language_snapshot:    string
  source_context:       Record<string, unknown>
  question_ids:         string[]
  ranking_metadata:     Record<string, unknown>
  version:              number
  created_at:           string
}

export type InterrogationStatus = 'pending' | 'running' | 'completed' | 'failed' | 'partial'
export type InterrogationResultStatus = 'pending' | 'running' | 'completed' | 'failed' | 'timeout'

export interface WorkspaceAIInterrogation {
  id:                       string
  workspace_id:             string
  user_id:                  string
  question_id:              string | null
  question_text_snapshot:   string
  question_family:          string
  selected_models:          string[]
  status:                   InterrogationStatus
  started_at:               string
  completed_at:             string | null
  usage_units_consumed:     number
  token_input_total:        number
  token_output_total:       number
  estimated_cost_cents:     number
  source_question_set_id:   string | null
  is_followup:              boolean
  parent_interrogation_id:  string | null
  created_at:               string
}

export interface WorkspaceAIInterrogationResult {
  id:                   string
  interrogation_id:     string
  model_slug:           string
  model_label:          string
  provider:             string
  response_text:        string | null
  response_summary:     string | null
  themes:               string[]
  latency_ms:           number | null
  token_input:          number
  token_output:         number
  estimated_cost_cents: number
  status:               InterrogationResultStatus
  error_message:        string | null
  created_at:           string
}

// ── SUPABASE DATABASE TYPE MAP ────────────────────────────────
// For use with createClient<Database>()

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Partial<Profile> & Pick<Profile, 'id' | 'email'>
        Update: Partial<Profile>
      }
      audits: {
        Row: Audit
        Insert: Partial<Audit> & Pick<Audit, 'user_id'>
        Update: Partial<Audit>
      }
      payments: {
        Row: Payment
        Insert: Partial<Payment> & Pick<Payment, 'audit_id' | 'user_id' | 'amount_cents' | 'currency' | 'status'>
        Update: Partial<Payment>
      }
      checklist_categories: {
        Row: ChecklistCategory
        Insert: Partial<ChecklistCategory> & Pick<ChecklistCategory, 'name' | 'slug' | 'sort_order'>
        Update: Partial<ChecklistCategory>
      }
      checklist_items: {
        Row: ChecklistItem
        Insert: Partial<ChecklistItem> & Pick<ChecklistItem, 'category_id' | 'title' | 'description' | 'what_to_check' | 'sort_order'>
        Update: Partial<ChecklistItem>
      }
      audit_pages: {
        Row: AuditPage
        Insert: Partial<AuditPage> & Pick<AuditPage, 'audit_id' | 'url'>
        Update: Partial<AuditPage>
      }
      audit_findings: {
        Row: AuditFinding
        Insert: Partial<AuditFinding> & Pick<AuditFinding, 'audit_id' | 'severity' | 'title' | 'description' | 'recommendation'>
        Update: Partial<AuditFinding>
      }
      reports: {
        Row: Report
        Insert: Partial<Report> & Pick<Report, 'audit_id' | 'executive_summary' | 'total_issues' | 'critical_count' | 'high_count' | 'medium_count' | 'low_count'>
        Update: Partial<Report>
      }
      audit_logs: {
        Row: AuditLog
        Insert: Partial<AuditLog> & Pick<AuditLog, 'audit_id' | 'event' | 'status'>
        Update: Partial<AuditLog>
      }
      white_label_settings: {
        Row: WhiteLabelSettings
        Insert: Partial<WhiteLabelSettings> & Pick<WhiteLabelSettings, 'user_id'>
        Update: Partial<WhiteLabelSettings>
      }
      brand_identities: {
        Row: BrandIdentity
        Insert: Partial<BrandIdentity> & Pick<BrandIdentity, 'user_id' | 'name'>
        Update: Partial<BrandIdentity>
      }
      brand_identity_files: {
        Row: BrandIdentityFile
        Insert: Partial<BrandIdentityFile> & Pick<BrandIdentityFile, 'brand_identity_id' | 'file_name' | 'file_url'>
        Update: Partial<BrandIdentityFile>
      }
      brand_audit_file_snapshots: {
        Row: BrandAuditFileSnapshot
        Insert: Partial<BrandAuditFileSnapshot> & Pick<BrandAuditFileSnapshot, 'audit_id' | 'brand_file_id' | 'file_name' | 'file_url'>
        Update: Partial<BrandAuditFileSnapshot>
      }
      llm_probe_results: {
        Row: LlmProbeResult
        Insert: Partial<LlmProbeResult> & Pick<LlmProbeResult, 'audit_id' | 'question' | 'answer' | 'model_used'>
        Update: Partial<LlmProbeResult>
      }
      ai_citations: {
        Row: AiCitation
        Insert: Partial<AiCitation> & Pick<AiCitation, 'audit_id' | 'page_url' | 'cited_text' | 'ai_context'>
        Update: Partial<AiCitation>
      }
      fix_playbooks: {
        Row: FixPlaybook
        Insert: Partial<FixPlaybook> & Pick<FixPlaybook, 'audit_id' | 'playbook_type' | 'title' | 'code_snippet'>
        Update: Partial<FixPlaybook>
      }
      multi_model_probes: {
        Row: MultiModelProbe
        Insert: Partial<MultiModelProbe> & Pick<MultiModelProbe, 'audit_id' | 'model_id' | 'model_label'>
        Update: Partial<MultiModelProbe>
      }
      industry_benchmarks: {
        Row: IndustryBenchmarkRow
        Insert: Partial<IndustryBenchmarkRow> & Pick<IndustryBenchmarkRow, 'industry'>
        Update: Partial<IndustryBenchmarkRow>
      }
      predictive_recommendations: {
        Row: PredictiveRecommendationRow
        Insert: Partial<PredictiveRecommendationRow> & Pick<PredictiveRecommendationRow, 'audit_id' | 'action' | 'category'>
        Update: Partial<PredictiveRecommendationRow>
      }
      // Canonical issue system (migration 050)
      issue_families: {
        Row: import('@/types/canonical-issues').IssueFamily
        Insert: Partial<import('@/types/canonical-issues').IssueFamily> & Pick<import('@/types/canonical-issues').IssueFamily, 'workspace_id' | 'category_key' | 'issue_key' | 'title_canonical'>
        Update: Partial<import('@/types/canonical-issues').IssueFamily>
      }
      finding_evidence: {
        Row: import('@/types/canonical-issues').FindingEvidence
        Insert: Partial<import('@/types/canonical-issues').FindingEvidence> & Pick<import('@/types/canonical-issues').FindingEvidence, 'audit_finding_id' | 'evidence_type'>
        Update: Partial<import('@/types/canonical-issues').FindingEvidence>
      }
      issue_lifecycle_events: {
        Row: import('@/types/canonical-issues').IssueLifecycleEvent
        Insert: Partial<import('@/types/canonical-issues').IssueLifecycleEvent> & Pick<import('@/types/canonical-issues').IssueLifecycleEvent, 'issue_family_id' | 'event_type'>
        Update: Partial<import('@/types/canonical-issues').IssueLifecycleEvent>
      }
      score_snapshots: {
        Row: import('@/types/canonical-issues').ScoreSnapshot
        Insert: Partial<import('@/types/canonical-issues').ScoreSnapshot> & Pick<import('@/types/canonical-issues').ScoreSnapshot, 'audit_id' | 'workspace_id'>
        Update: Partial<import('@/types/canonical-issues').ScoreSnapshot>
      }
      // AI Interrogation tables
      ai_question_library: {
        Row: AIQuestionLibraryRow
        Insert: Partial<AIQuestionLibraryRow> & Pick<AIQuestionLibraryRow, 'question_text' | 'question_family'>
        Update: Partial<AIQuestionLibraryRow>
      }
      workspace_ai_question_sets: {
        Row: WorkspaceAIQuestionSet
        Insert: Partial<WorkspaceAIQuestionSet> & Pick<WorkspaceAIQuestionSet, 'workspace_id' | 'question_ids' | 'valid_until'>
        Update: Partial<WorkspaceAIQuestionSet>
      }
      workspace_ai_interrogations: {
        Row: WorkspaceAIInterrogation
        Insert: Partial<WorkspaceAIInterrogation> & Pick<WorkspaceAIInterrogation, 'workspace_id' | 'user_id' | 'question_text_snapshot' | 'question_family' | 'selected_models'>
        Update: Partial<WorkspaceAIInterrogation>
      }
      workspace_ai_interrogation_results: {
        Row: WorkspaceAIInterrogationResult
        Insert: Partial<WorkspaceAIInterrogationResult> & Pick<WorkspaceAIInterrogationResult, 'interrogation_id' | 'model_slug' | 'model_label' | 'provider'>
        Update: Partial<WorkspaceAIInterrogationResult>
      }
    }
    Views: {
      audit_overview: {
        Row: AuditOverview
      }
    }
    Enums: {
      audit_status: AuditStatus
      payment_status: PaymentStatus
      finding_severity: FindingSeverity
    }
  }
}
