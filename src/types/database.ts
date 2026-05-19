// ============================================================
// ClearUX SaaS — Database Types
// Auto-generated from schema. Keep in sync with migrations.
// ============================================================

export type AuditStatus =
  | 'pending_payment'
  | 'payment_received'
  | 'crawling'
  | 'analysing'
  | 'generating_report'
  | 'completed'
  | 'failed'

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
  audits_remaining:      number         // monthly allowance remaining
  audits_per_month:      number         // monthly allowance total
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
  // Brand identity for brand consistency auditing
  brand_identity_id:  string | null
  // Module selection (slug-based): null = complete audit
  selected_modules:   string[] | null
  // Re-audit linkage
  previous_audit_id:  string | null
  // Industry classification (Phase 4)
  detected_industry:  string | null
}

export interface ScheduledAudit {
  id:          string
  user_id:     string
  product_url: string
  frequency:   'weekly' | 'monthly' | 'quarterly'
  language:    string
  is_active:   boolean
  last_run_at: string | null
  next_run_at: string | null
  created_at:  string
  updated_at:  string
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
export type SiteNoteType = 'context' | 'dismissal' | 'discussion'

export interface SiteNote {
  id:          string
  user_id:     string
  domain:      string
  note_type:   SiteNoteType
  category:    string | null
  title:       string
  content:     string
  finding_ref: string | null
  is_active:   boolean
  created_at:  string
  updated_at:  string
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
  created_at:        string
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

export type AIModelId = 'claude' | 'gpt4o' | 'gemini' | 'perplexity'

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
  created_at:  string
  updated_at:  string
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
