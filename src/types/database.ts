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
  // White-label (Agency/Scale packages)
  white_label:   boolean
  package_tier:  string
  // Admin role
  role:          'user' | 'admin' | 'super_admin'
}

export interface Audit {
  id:                string
  user_id:           string
  status:            AuditStatus
  product_url:       string
  product_type:      string
  target_user:       string | null
  ux_concern:        string
  notes:             string | null
  plan:              'quick_scan' | 'full_audit' | 'agency_pro' | 'agency_scale' | null
  language:          string | null
  pages_crawled:     number
  crawl_error:       string | null
  delivery_deadline: string | null
  completed_at:      string | null
  created_at:        string
  updated_at:        string
  // White-label branding (optional, Agency/Scale only)
  white_label_company_name: string | null
  white_label_logo_url:     string | null
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
  crawled_at:          string
}

export interface AuditFinding {
  id:                string
  audit_id:          string
  checklist_item_id: string | null
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
  created_at:               string
  updated_at:               string
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

// ── VIEW TYPES ───────────────────────────────────────────────

export interface AuditOverview {
  id:               string
  user_id:          string
  status:           AuditStatus
  product_url:      string
  product_type:     string
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
        Insert: Partial<Audit> & Pick<Audit, 'user_id' | 'product_url'>
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
