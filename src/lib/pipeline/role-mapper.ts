// ============================================================
// Fixpath Proprietary — Role Mapper
// Maps findings to stakeholder roles and generates role-based
// summaries for team handoff workflows.
// ============================================================

import type {
  FindingSeverity,
  StakeholderRole,
  HandoffPayload,
  RoleSummary,
  RoleSummaries,
  AuditFinding,
} from '@/types/database'

// ── Category-to-role mapping ─────────────────────────────────
// Maps each of the 24 category indices to the stakeholder roles
// that should see findings from that category.
// Some categories map to multiple roles.

const CATEGORY_ROLE_MAP: Record<number, StakeholderRole[]> = {
  // Foundation (0-3)
  0: ['product_ux', 'marketing'],           // Visual design & first impressions
  1: ['marketing', 'executive'],             // Value proposition & messaging
  2: ['product_ux', 'engineering'],          // Navigation & information architecture
  3: ['marketing', 'product_ux'],            // Content quality & readability

  // Human Experience (4-7)
  4: ['marketing', 'product_ux'],            // CTAs & conversion paths
  5: ['marketing', 'executive'],             // Trust & credibility
  6: ['product_ux', 'executive'],            // Ethical design & dark patterns
  7: ['product_ux'],                         // Emotional design & delight

  // Inclusive Design (8-11)
  8: ['engineering', 'product_ux'],          // Accessibility (WCAG)
  9: ['product_ux'],                         // Cognitive accessibility
  10: ['product_ux', 'executive'],           // Digital wellbeing
  11: ['engineering', 'product_ux'],         // Responsive design

  // Future Readiness (12-15)
  12: ['engineering'],                       // Performance & speed
  13: ['marketing', 'engineering'],          // AI discoverability
  14: ['engineering'],                       // AI agent readiness
  15: ['marketing', 'product_ux'],           // Cultural & global readiness

  // SEO Structure & Rules (16-19)
  16: ['marketing', 'engineering'],          // On-page SEO
  17: ['engineering'],                       // Technical SEO
  18: ['marketing'],                         // Social media / rich snippets
  19: ['marketing'],                         // Content strategy & keywords

  // Brand Consistency (20-23)
  20: ['marketing', 'executive'],            // Brand identity
  21: ['marketing', 'executive'],            // Brand experience & story
  22: ['marketing', 'product_ux'],           // Brand visuals
  23: ['marketing'],                         // Brand communication
}

// ── Severity-to-role priority boost ──────────────────────────
// Executive stakeholders care more about high-severity issues.
// Engineering cares about all severities equally.

const SEVERITY_SCORES: Record<FindingSeverity, number> = {
  critical: 4, high: 3, medium: 2, low: 1,
}

const ROLE_SEVERITY_WEIGHT: Record<StakeholderRole, Record<FindingSeverity, number>> = {
  executive:    { critical: 4, high: 3, medium: 1, low: 0 },
  marketing:    { critical: 4, high: 3, medium: 2, low: 1 },
  product_ux:   { critical: 4, high: 3, medium: 2, low: 1 },
  engineering:  { critical: 4, high: 3, medium: 2, low: 1 },
}

// ── Effort estimation heuristics ─────────────────────────────

function estimateEffort(finding: Pick<AuditFinding, 'fix_type' | 'finding_type' | 'is_deployable'>): HandoffPayload['effort'] {
  if (finding.is_deployable) return 'quick_win'
  if (finding.fix_type === 'meta' || finding.fix_type === 'schema') return 'quick_win'
  if (finding.fix_type === 'copy') return 'quick_win'
  if (finding.finding_type === 'strategic') return 'significant'
  return 'moderate'
}

// ── Role display names ───────────────────────────────────────

export const ROLE_LABELS: Record<StakeholderRole, string> = {
  executive:   'Leadership',
  marketing:   'Marketing',
  product_ux:  'Product & UX',
  engineering: 'Engineering',
}

export const ROLE_DESCRIPTIONS: Record<StakeholderRole, string> = {
  executive:   'Strategic overview — business impact, risk, and ROI',
  marketing:   'Brand, content, SEO, and conversion optimization',
  product_ux:  'User experience, accessibility, and design quality',
  engineering: 'Technical debt, performance, and infrastructure',
}

// ── Core mapping functions ───────────────────────────────────

/**
 * Determine which stakeholder roles should see a finding
 * based on its category, severity, and type.
 */
export function assignOwnerRoles(
  finding: Pick<AuditFinding, 'category_index' | 'severity' | 'owner_team' | 'finding_type' | 'detection_source'>
): StakeholderRole[] {
  const roles = new Set<StakeholderRole>()

  // 1. Category-based mapping (primary source)
  const catIdx = finding.category_index ?? 0
  const categoryRoles = CATEGORY_ROLE_MAP[catIdx] || ['product_ux']
  for (const r of categoryRoles) roles.add(r)

  // 2. Detection source overrides
  if (finding.detection_source === 'performance_checker') {
    roles.add('engineering')
  }
  if (finding.detection_source === 'wcag_checker') {
    roles.add('engineering')
    roles.add('product_ux')
  }
  if (finding.detection_source === 'responsive_checker') {
    roles.add('engineering')
    roles.add('product_ux')
  }

  // 3. Owner team mapping (from performance findings)
  if (finding.owner_team === 'engineering') roles.add('engineering')
  if (finding.owner_team === 'marketing') roles.add('marketing')
  if (finding.owner_team === 'product') roles.add('product_ux')
  if (finding.owner_team === 'design') roles.add('product_ux')

  // 4. High/critical-severity issues always surface to executives
  if (finding.severity === 'high' || finding.severity === 'critical') {
    roles.add('executive')
  }

  return Array.from(roles)
}

/**
 * Pick the single most relevant stakeholder for a finding.
 */
export function assignPrimaryOwner(
  finding: Pick<AuditFinding, 'category_index' | 'severity' | 'owner_team' | 'finding_type' | 'detection_source' | 'fix_type' | 'is_deployable'>,
  ownerRoles: StakeholderRole[]
): StakeholderRole {
  if (ownerRoles.length === 1) return ownerRoles[0]

  // Use severity weight to pick the primary owner
  let bestRole = ownerRoles[0]
  let bestScore = -1

  for (const role of ownerRoles) {
    const weight = ROLE_SEVERITY_WEIGHT[role]?.[finding.severity] ?? 1
    // Boost based on detection source alignment
    let bonus = 0
    if (role === 'engineering' && (finding.detection_source === 'performance_checker' || finding.detection_source === 'wcag_checker')) bonus += 2
    if (role === 'marketing' && (finding.category_index ?? 0) >= 16 && (finding.category_index ?? 0) <= 19) bonus += 2
    if (role === 'product_ux' && (finding.category_index ?? 0) >= 4 && (finding.category_index ?? 0) <= 11) bonus += 2

    const score = weight + bonus
    if (score > bestScore) {
      bestScore = score
      bestRole = role
    }
  }

  return bestRole
}

/**
 * Generate a handoff payload for a finding — structured data
 * that makes it easy to hand off to a team member.
 */
export function generateHandoffPayload(
  finding: Pick<AuditFinding, 'title' | 'description' | 'recommendation' | 'severity' | 'estimated_impact' | 'fix_type' | 'finding_type' | 'is_deployable'>,
  primaryOwner: StakeholderRole,
  priorityRank: number
): HandoffPayload {
  // Build a concise summary
  const severity = finding.severity === 'critical' ? 'Critical priority' : finding.severity === 'high' ? 'High priority' : finding.severity === 'medium' ? 'Medium priority' : 'Low priority'
  const summary = `${severity}: ${finding.title}`

  // Business impact from estimated_impact or derive from severity
  const business_impact = finding.estimated_impact
    || (finding.severity === 'critical'
      ? 'This issue has a significant negative impact on user experience, trust, or conversion. It should be addressed urgently.'
      : finding.severity === 'high'
        ? 'This issue likely affects user experience and conversion. Fixing it should produce visible improvement.'
        : finding.severity === 'medium'
          ? 'This issue affects quality and may impact user trust over time.'
          : 'Minor improvement that contributes to overall polish.')

  // Next steps based on primary owner and fix type
  const next_steps: string[] = []

  if (finding.recommendation) {
    next_steps.push(finding.recommendation)
  }

  if (primaryOwner === 'engineering') {
    if (finding.is_deployable) {
      next_steps.push('This fix can be deployed directly from the Fix Console.')
    } else {
      next_steps.push('Review the technical details and estimate implementation effort.')
    }
  } else if (primaryOwner === 'marketing') {
    if (finding.fix_type === 'copy') {
      next_steps.push('Update the copy as recommended. The change can be reviewed in the Fix Console.')
    } else {
      next_steps.push('Coordinate with content or design team to implement.')
    }
  } else if (primaryOwner === 'product_ux') {
    next_steps.push('Evaluate the UX impact and prioritize in your design backlog.')
  } else {
    next_steps.push('Review findings and decide on prioritization.')
  }

  return {
    summary,
    business_impact,
    next_steps,
    effort: estimateEffort(finding),
    priority_rank: priorityRank,
  }
}

/**
 * Process all findings for an audit and assign roles + handoff payloads.
 * Returns enrichment data keyed by finding index.
 */
export function enrichFindingsWithRoles(
  findings: Array<Pick<AuditFinding, 'id' | 'title' | 'description' | 'recommendation' | 'severity' | 'estimated_impact' | 'category_index' | 'owner_team' | 'finding_type' | 'detection_source' | 'fix_type' | 'is_deployable'>>
): Array<{
  id: string
  owner_roles: StakeholderRole[]
  primary_owner_role: StakeholderRole
  handoff_ready: boolean
  handoff_payload: HandoffPayload
}> {
  // Sort by severity for priority ranking per role
  const rolePriorityCounters: Record<StakeholderRole, number> = {
    executive: 0, marketing: 0, product_ux: 0, engineering: 0,
  }

  return findings.map((f) => {
    const owner_roles = assignOwnerRoles(f)
    const primary_owner_role = assignPrimaryOwner(f, owner_roles)

    // Increment priority counter for the primary owner
    rolePriorityCounters[primary_owner_role] += 1
    const priorityRank = rolePriorityCounters[primary_owner_role]

    const handoff_payload = generateHandoffPayload(f, primary_owner_role, priorityRank)

    return {
      id: f.id,
      owner_roles,
      primary_owner_role,
      handoff_ready: true,
      handoff_payload,
    }
  })
}

/**
 * Generate per-role summaries for the audit.
 */
export function generateRoleSummaries(
  findings: Array<Pick<AuditFinding, 'title' | 'severity' | 'category_index' | 'owner_team' | 'finding_type' | 'detection_source' | 'estimated_impact' | 'recommendation' | 'fix_type' | 'is_deployable'>>,
  enriched: Array<{ owner_roles: StakeholderRole[]; primary_owner_role: StakeholderRole }>
): RoleSummaries {
  const ALL_ROLES: StakeholderRole[] = ['executive', 'marketing', 'product_ux', 'engineering']

  const summaries: RoleSummary[] = ALL_ROLES.map((role) => {
    // Findings relevant to this role
    const relevant = findings.filter((_, i) => enriched[i]?.owner_roles.includes(role))
    const critical = relevant.filter((f) => f.severity === 'critical' || f.severity === 'high')

    // Top 3 issues (highest severity first)
    const sorted = [...relevant].sort((a, b) => {
      return (SEVERITY_SCORES[b.severity] || 0) - (SEVERITY_SCORES[a.severity] || 0)
    })
    const top_issues = sorted.slice(0, 3).map((f) => f.title)

    // Impact summary
    let impact_summary: string
    if (critical.length === 0) {
      impact_summary = `No critical issues for ${ROLE_LABELS[role]}. ${relevant.length} findings to review at your convenience.`
    } else if (critical.length === 1) {
      impact_summary = `1 critical issue requires attention. ${relevant.length} total findings relevant to ${ROLE_LABELS[role]}.`
    } else {
      impact_summary = `${critical.length} critical issues need prompt attention. ${relevant.length} total findings relevant to ${ROLE_LABELS[role]}.`
    }

    // Next steps per role
    const next_steps: string[] = []
    if (role === 'executive') {
      if (critical.length > 0) next_steps.push(`Review ${critical.length} high-priority issue${critical.length > 1 ? 's' : ''} and assign owners.`)
      next_steps.push('Share the role-specific reports with your team leads.')
      if (relevant.length > 5) next_steps.push('Consider scheduling a cross-team review session.')
    } else if (role === 'marketing') {
      const copyFixes = relevant.filter((f) => f.fix_type === 'copy').length
      if (copyFixes > 0) next_steps.push(`${copyFixes} copy fix${copyFixes > 1 ? 'es' : ''} can be updated directly.`)
      const seoFindings = relevant.filter((f) => (f.category_index ?? 0) >= 16 && (f.category_index ?? 0) <= 19).length
      if (seoFindings > 0) next_steps.push(`${seoFindings} SEO improvement${seoFindings > 1 ? 's' : ''} to review.`)
      next_steps.push('Prioritize changes that affect conversion and brand perception.')
    } else if (role === 'product_ux') {
      const a11y = relevant.filter((f) => f.detection_source === 'wcag_checker' || f.detection_source === 'responsive_checker').length
      if (a11y > 0) next_steps.push(`${a11y} accessibility or responsive issue${a11y > 1 ? 's' : ''} to address.`)
      next_steps.push('Review UX findings and update your design backlog.')
      next_steps.push('Coordinate with engineering on implementation timelines.')
    } else if (role === 'engineering') {
      const deployable = relevant.filter((f) => f.is_deployable).length
      if (deployable > 0) next_steps.push(`${deployable} fix${deployable > 1 ? 'es' : ''} can be deployed directly from the Fix Console.`)
      const perfFindings = relevant.filter((f) => f.detection_source === 'performance_checker').length
      if (perfFindings > 0) next_steps.push(`${perfFindings} performance issue${perfFindings > 1 ? 's' : ''} to optimize.`)
      next_steps.push('Estimate effort for remaining fixes and plan sprints.')
    }

    return {
      role,
      finding_count: relevant.length,
      critical_count: critical.length,
      top_issues,
      impact_summary,
      next_steps,
    }
  })

  return {
    generated_at: new Date().toISOString(),
    summaries,
  }
}
