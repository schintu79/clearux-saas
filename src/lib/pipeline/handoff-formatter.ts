// ============================================================
// Fixpath Proprietary — Handoff Formatter
// Generates role-specific export packages for team handoff.
// Supports concise summary, implementation-ready, copy fixes,
// and technical task list formats.
// ============================================================

import type {
  StakeholderRole,
  AuditFinding,
  HandoffPayload,
  RoleSummary,
} from '@/types/database'
import { ROLE_LABELS, ROLE_DESCRIPTIONS } from './role-mapper'

// ── Export format types ─────────────────────────────────────

export type HandoffFormat = 'summary' | 'implementation' | 'copy_fixes' | 'task_list'

export const HANDOFF_FORMAT_LABELS: Record<HandoffFormat, string> = {
  summary: 'Executive summary',
  implementation: 'Implementation brief',
  copy_fixes: 'Copy and content fixes',
  task_list: 'Technical task list',
}

export const HANDOFF_FORMAT_DESCRIPTIONS: Record<HandoffFormat, string> = {
  summary: 'High-level overview with business impact and priorities',
  implementation: 'Detailed findings with recommendations and effort estimates',
  copy_fixes: 'Copy-only fixes ready for immediate implementation',
  task_list: 'Structured task list for engineering sprints',
}

// ── Role-to-format recommendations ──────────────────────────

export const ROLE_RECOMMENDED_FORMATS: Record<StakeholderRole, HandoffFormat[]> = {
  executive: ['summary'],
  marketing: ['summary', 'copy_fixes', 'implementation'],
  product_ux: ['implementation', 'summary'],
  engineering: ['task_list', 'implementation'],
}

// ── Severity display helpers ────────────────────────────────

const SEVERITY_EMOJI: Record<string, string> = {
  critical: '[CRITICAL]',
  high: '[HIGH]',
  medium: '[MEDIUM]',
  low: '[LOW]',
}

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

// ── Core formatting functions ───────────────────────────────

interface HandoffInput {
  siteName: string
  auditDate: string
  overallScore: number | null
  role: StakeholderRole
  roleSummary: RoleSummary | null
  findings: AuditFinding[]
  format: HandoffFormat
}

/**
 * Generate a complete handoff export as markdown text.
 */
export function generateHandoffExport(input: HandoffInput): string {
  const { format } = input

  switch (format) {
    case 'summary':
      return formatSummary(input)
    case 'implementation':
      return formatImplementation(input)
    case 'copy_fixes':
      return formatCopyFixes(input)
    case 'task_list':
      return formatTaskList(input)
    default:
      return formatSummary(input)
  }
}

// ── Summary format (executive-friendly) ─────────────────────

function formatSummary(input: HandoffInput): string {
  const { siteName, auditDate, overallScore, role, roleSummary, findings } = input
  const roleLabel = ROLE_LABELS[role]
  const roleDesc = ROLE_DESCRIPTIONS[role]

  const lines: string[] = []

  lines.push(`# ${siteName} — ${roleLabel} handoff`)
  lines.push('')
  lines.push(`**Audit date:** ${auditDate}`)
  if (overallScore != null) {
    lines.push(`**Overall score:** ${overallScore}/100`)
  }
  lines.push(`**Prepared for:** ${roleLabel} — ${roleDesc}`)
  lines.push('')

  // Role summary
  if (roleSummary) {
    lines.push('## Overview')
    lines.push('')
    lines.push(roleSummary.impact_summary)
    lines.push('')

    if (roleSummary.top_issues.length > 0) {
      lines.push('**Top issues:**')
      lines.push('')
      for (const issue of roleSummary.top_issues) {
        lines.push(`- ${issue}`)
      }
      lines.push('')
    }

    if (roleSummary.next_steps.length > 0) {
      lines.push('**Recommended next steps:**')
      lines.push('')
      for (const step of roleSummary.next_steps) {
        lines.push(`- ${step}`)
      }
      lines.push('')
    }
  }

  // Severity breakdown
  const sevCounts = countBySeverity(findings)
  lines.push('## Issue breakdown')
  lines.push('')
  lines.push(`| Severity | Count |`)
  lines.push(`|----------|-------|`)
  for (const [sev, count] of Object.entries(sevCounts)) {
    if (count > 0) lines.push(`| ${sev.charAt(0).toUpperCase() + sev.slice(1)} | ${count} |`)
  }
  lines.push('')

  // Top findings (max 10)
  const sorted = sortBySeverity(findings)
  const topFindings = sorted.slice(0, 10)

  lines.push('## Priority findings')
  lines.push('')
  for (const f of topFindings) {
    const sev = SEVERITY_EMOJI[f.severity] || ''
    lines.push(`### ${sev} ${f.title}`)
    lines.push('')
    if (f.description) lines.push(f.description)
    lines.push('')
    if (f.estimated_impact) {
      lines.push(`**Business impact:** ${f.estimated_impact}`)
      lines.push('')
    }
    if (f.recommendation) {
      lines.push(`**Recommendation:** ${f.recommendation}`)
      lines.push('')
    }
    lines.push('---')
    lines.push('')
  }

  if (findings.length > 10) {
    lines.push(`*${findings.length - 10} additional findings not shown in this summary.*`)
    lines.push('')
  }

  lines.push(formatFooter(siteName))

  return lines.join('\n')
}

// ── Implementation format (detailed) ────────────────────────

function formatImplementation(input: HandoffInput): string {
  const { siteName, auditDate, overallScore, role, findings } = input
  const roleLabel = ROLE_LABELS[role]

  const lines: string[] = []

  lines.push(`# ${siteName} — Implementation brief for ${roleLabel}`)
  lines.push('')
  lines.push(`**Audit date:** ${auditDate}`)
  if (overallScore != null) lines.push(`**Overall score:** ${overallScore}/100`)
  lines.push(`**Total findings for ${roleLabel}:** ${findings.length}`)
  lines.push('')

  // Group by severity
  const grouped = groupBySeverity(findings)

  for (const severity of ['critical', 'high', 'medium', 'low'] as const) {
    const group = grouped[severity]
    if (!group || group.length === 0) continue

    lines.push(`## ${severity.charAt(0).toUpperCase() + severity.slice(1)} priority (${group.length})`)
    lines.push('')

    for (const f of group) {
      const effort = (f.handoff_payload as HandoffPayload | null)?.effort || 'unknown'
      const effortLabel = effort === 'quick_win' ? 'Quick win' : effort === 'moderate' ? 'Moderate effort' : effort === 'significant' ? 'Significant effort' : effort

      lines.push(`### ${f.title}`)
      lines.push('')
      lines.push(`**Effort:** ${effortLabel}`)
      if (f.fix_type) lines.push(`**Fix type:** ${f.fix_type}`)
      if (f.is_deployable) lines.push(`**Deployable:** Yes (can be applied from Fix Console)`)
      lines.push('')
      if (f.description) {
        lines.push(f.description)
        lines.push('')
      }
      if (f.estimated_impact) {
        lines.push(`**Impact:** ${f.estimated_impact}`)
        lines.push('')
      }
      if (f.recommendation) {
        lines.push(`**What to do:** ${f.recommendation}`)
        lines.push('')
      }
      if (f.target_element) {
        lines.push(`**Evidence:** \`${f.target_element}\``)
        lines.push('')
      }
      if (f.page_url) {
        lines.push(`**Page:** ${f.page_url}`)
        lines.push('')
      }
      lines.push('---')
      lines.push('')
    }
  }

  lines.push(formatFooter(siteName))

  return lines.join('\n')
}

// ── Copy fixes format (marketing-friendly) ──────────────────

function formatCopyFixes(input: HandoffInput): string {
  const { siteName, auditDate, role, findings } = input
  const roleLabel = ROLE_LABELS[role]

  // Filter to copy-type fixes only
  const copyFindings = findings.filter(f =>
    f.fix_type === 'copy' ||
    f.fix_type === 'meta' ||
    (f.finding_type === 'strategic' && f.recommendation?.toLowerCase().includes('copy')) ||
    (f.recommendation?.toLowerCase().includes('rewrite') || f.recommendation?.toLowerCase().includes('update the text') || f.recommendation?.toLowerCase().includes('change the wording'))
  )

  const lines: string[] = []

  lines.push(`# ${siteName} — Copy and content fixes for ${roleLabel}`)
  lines.push('')
  lines.push(`**Audit date:** ${auditDate}`)
  lines.push(`**Copy fixes found:** ${copyFindings.length}`)
  lines.push('')

  if (copyFindings.length === 0) {
    lines.push('No copy-specific fixes were identified for this role. Consider reviewing the full implementation brief instead.')
    lines.push('')
    lines.push(formatFooter(siteName))
    return lines.join('\n')
  }

  lines.push('Each item below can be updated directly in your CMS or codebase.')
  lines.push('')

  const sorted = sortBySeverity(copyFindings)

  for (let i = 0; i < sorted.length; i++) {
    const f = sorted[i]
    const sev = SEVERITY_EMOJI[f.severity] || ''

    lines.push(`## ${i + 1}. ${sev} ${f.title}`)
    lines.push('')
    if (f.page_url) lines.push(`**Page:** ${f.page_url}`)
    lines.push('')
    if (f.description) {
      lines.push(`**Issue:** ${f.description}`)
      lines.push('')
    }
    if (f.target_element) {
      lines.push(`**Current:** \`${f.target_element}\``)
      lines.push('')
    }
    if (f.recommendation) {
      lines.push(`**Recommended change:** ${f.recommendation}`)
      lines.push('')
    }
    if (f.is_deployable) {
      lines.push('> This fix can be deployed directly from the Fixpath Fix Console.')
      lines.push('')
    }
    lines.push('---')
    lines.push('')
  }

  lines.push(formatFooter(siteName))

  return lines.join('\n')
}

// ── Task list format (engineering-friendly) ─────────────────

function formatTaskList(input: HandoffInput): string {
  const { siteName, auditDate, role, findings } = input
  const roleLabel = ROLE_LABELS[role]

  const lines: string[] = []

  lines.push(`# ${siteName} — Task list for ${roleLabel}`)
  lines.push('')
  lines.push(`**Audit date:** ${auditDate}`)
  lines.push(`**Total tasks:** ${findings.length}`)
  lines.push('')

  // Quick wins first
  const quickWins = findings.filter(f => {
    const effort = (f.handoff_payload as HandoffPayload | null)?.effort
    return effort === 'quick_win' || f.is_deployable
  })
  const remaining = findings.filter(f => {
    const effort = (f.handoff_payload as HandoffPayload | null)?.effort
    return effort !== 'quick_win' && !f.is_deployable
  })

  if (quickWins.length > 0) {
    lines.push(`## Quick wins (${quickWins.length})`)
    lines.push('')
    lines.push('These can be addressed immediately with minimal effort.')
    lines.push('')
    for (const f of sortBySeverity(quickWins)) {
      const sev = SEVERITY_EMOJI[f.severity] || ''
      const deployable = f.is_deployable ? ' [DEPLOYABLE]' : ''
      lines.push(`- [ ] ${sev} ${f.title}${deployable}`)
      if (f.recommendation) lines.push(`  - ${f.recommendation}`)
      if (f.page_url) lines.push(`  - Page: ${f.page_url}`)
    }
    lines.push('')
  }

  // Group remaining by severity
  const grouped = groupBySeverity(remaining)

  for (const severity of ['critical', 'high', 'medium', 'low'] as const) {
    const group = grouped[severity]
    if (!group || group.length === 0) continue

    lines.push(`## ${severity.charAt(0).toUpperCase() + severity.slice(1)} priority (${group.length})`)
    lines.push('')
    for (const f of group) {
      const effort = (f.handoff_payload as HandoffPayload | null)?.effort || 'unknown'
      const effortTag = effort === 'moderate' ? ' [MODERATE]' : effort === 'significant' ? ' [SIGNIFICANT]' : ''
      lines.push(`- [ ] ${f.title}${effortTag}`)
      if (f.recommendation) lines.push(`  - ${f.recommendation}`)
      if (f.fix_type) lines.push(`  - Fix type: ${f.fix_type}`)
      if (f.page_url) lines.push(`  - Page: ${f.page_url}`)
    }
    lines.push('')
  }

  // Summary stats
  lines.push('## Summary')
  lines.push('')
  const deployable = findings.filter(f => f.is_deployable).length
  lines.push(`- Total tasks: ${findings.length}`)
  lines.push(`- Quick wins: ${quickWins.length}`)
  lines.push(`- Auto-deployable: ${deployable}`)
  lines.push('')

  lines.push(formatFooter(siteName))

  return lines.join('\n')
}

// ── Helpers ─────────────────────────────────────────────────

function sortBySeverity(findings: AuditFinding[]): AuditFinding[] {
  return [...findings].sort((a, b) => {
    return (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)
  })
}

function groupBySeverity(findings: AuditFinding[]): Record<string, AuditFinding[]> {
  const groups: Record<string, AuditFinding[]> = {}
  for (const f of findings) {
    const sev = f.severity || 'medium'
    if (!groups[sev]) groups[sev] = []
    groups[sev].push(f)
  }
  return groups
}

function countBySeverity(findings: AuditFinding[]): Record<string, number> {
  const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 }
  for (const f of findings) {
    const sev = f.severity || 'medium'
    counts[sev] = (counts[sev] || 0) + 1
  }
  return counts
}

function formatFooter(siteName: string): string {
  return `\n---\n*Generated by Fixpath for ${siteName}. Visit fixpath.co for more details.*\n`
}
