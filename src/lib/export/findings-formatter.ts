/**
 * Findings export formatter — pure TypeScript, no React.
 *
 * Transforms grouped audit findings into a structured export format and
 * renders them to Markdown (with PDF, DOCX, email, and API renderers
 * planned for future iterations).
 *
 * This module is intentionally React-free so it can be reused in API
 * routes, edge functions, and background jobs.
 */

import type { GroupedFinding } from '@/lib/audit-findings-presentation';
import type { AuditFinding } from '@/types/database';
import {
  inferFixType,
  classifyFinding,
  inferImpact,
  type FixClassification,
} from '@/components/dashboard/v2/FixConsole';
import {
  PHASE1_MODULES,
  moduleIndexForFinding,
} from '@/lib/dashboard/latest-audit';

/* ── Export types ────────────────────────────────────────── */

export interface ExportFinding {
  title: string;
  severity: string; // 'critical' | 'high' | 'medium' | 'low'
  status: string; // 'open' | 'in_progress' | 'fixed' | 'backlog'
  modules: string[]; // e.g. ['Foundation', 'SEO Structure']
  fixType: string; // e.g. 'Schema', 'HTML', 'Copy', 'Code fix'
  classification: string; // 'Surgical fix', 'Bulk fix', 'Requires design work', 'Strategic insight'
  description: string;
  whyItMatters: string | null; // estimated_impact
  recommendation: string;
  affectedPages: string[];
  findingType: string; // 'fixable' | 'strategic'
  evidence: string | null;
  dismissed: boolean;
  dismissalReason: string | null;
}

export interface ExportMeta {
  siteName: string; // hostname or brand name
  auditDate: string; // formatted date
  auditId: string;
  totalFindings: number;
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
  byModule: Record<string, number>;
  exportDate: string;
}

/* ── Label maps (React-free equivalents of CLASSIFICATION_META / FIX_TYPE_META) ── */

const FIX_TYPE_LABELS: Record<string, string> = {
  copy: 'Copy',
  heading: 'Heading',
  meta: 'Meta',
  schema: 'Schema',
  accessibility: 'Accessibility',
  content: 'Content',
  technical: 'Technical',
  design: 'Design',
  code: 'Code fix',
  html: 'HTML',
  file: 'File',
  config: 'Config',
};

const CLASSIFICATION_LABELS: Record<FixClassification, string> = {
  fixable_surgical: 'Surgical fix',
  fixable_bulk: 'Bulk fix',
  requires_design_work: 'Requires design work',
  strategic_comment: 'Strategic insight',
};

const SEVERITY_SORT: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const STATUS_SORT: Record<string, number> = {
  open: 0,
  in_progress: 1,
  backlog: 2,
  fixed: 3,
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In progress',
  backlog: 'Backlog',
  fixed: 'Fixed',
};

/* ── Core transform ─────────────────────────────────────── */

/**
 * Transform grouped findings into a flat, format-agnostic export list.
 */
export function prepareFindingsForExport(
  groups: GroupedFinding[],
  modules: readonly string[],
): ExportFinding[] {
  return groups.map((g) => {
    const f: AuditFinding = g.primary;
    const uiFixType = inferFixType(f);
    const classification = classifyFinding(f, uiFixType, g.affectedPages);
    const _impact = inferImpact(f);

    // Resolve module names from indices
    const moduleNames: string[] = g.affectedModuleIndices
      .filter((i) => i >= 0 && i < modules.length)
      .map((i) => modules[i]);

    // If no module indices, try deriving from the primary finding
    if (moduleNames.length === 0) {
      const idx = moduleIndexForFinding(f);
      if (idx >= 0 && idx < modules.length) {
        moduleNames.push(modules[idx]);
      }
    }

    return {
      title: f.title,
      severity: f.severity,
      status: f.status,
      modules: moduleNames,
      fixType: FIX_TYPE_LABELS[uiFixType] || FIX_TYPE_LABELS[f.fix_type || ''] || 'Content',
      classification: CLASSIFICATION_LABELS[classification],
      description: f.description,
      whyItMatters: f.estimated_impact || null,
      recommendation: f.recommendation,
      affectedPages: g.affectedPages,
      findingType: f.finding_type,
      evidence: f.evidence || null,
      dismissed: f.dismissed,
      dismissalReason: f.dismissal_reason || null,
    };
  });
}

/* ── Metadata builder ───────────────────────────────────── */

export function buildExportMeta(
  findings: ExportFinding[],
  siteName: string,
  auditDate: string,
  auditId: string,
): ExportMeta {
  const bySeverity: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byModule: Record<string, number> = {};

  for (const f of findings) {
    bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
    byStatus[f.status] = (byStatus[f.status] || 0) + 1;
    for (const m of f.modules) {
      byModule[m] = (byModule[m] || 0) + 1;
    }
  }

  return {
    siteName,
    auditDate: formatDateForExport(auditDate),
    auditId,
    totalFindings: findings.length,
    bySeverity,
    byStatus,
    byModule,
    exportDate: formatDateForExport(new Date().toISOString()),
  };
}

/* ── Markdown renderer ──────────────────────────────────── */

export function renderMarkdown(
  findings: ExportFinding[],
  meta: ExportMeta,
): string {
  const lines: string[] = [];

  // ── Header ──
  lines.push(`# Fixpath audit report -- ${meta.siteName}`);
  lines.push('');
  lines.push(`**Audit date:** ${meta.auditDate}  `);
  lines.push(`**Exported:** ${meta.exportDate}  `);

  // Status breakdown inline
  const statusParts = ['open', 'in_progress', 'fixed', 'backlog']
    .filter((s) => meta.byStatus[s])
    .map((s) => `${meta.byStatus[s]} ${STATUS_LABELS[s]?.toLowerCase() || s}`);
  lines.push(
    `**Total findings:** ${meta.totalFindings}${statusParts.length ? ` (${statusParts.join(', ')})` : ''}`,
  );
  lines.push('');

  // ── Summary tables ──
  lines.push('## Summary');
  lines.push('');

  // Severity table
  lines.push('| Severity | Count |');
  lines.push('|----------|-------|');
  for (const sev of ['critical', 'high', 'medium', 'low']) {
    if (meta.bySeverity[sev]) {
      lines.push(`| ${capitalize(sev)} | ${meta.bySeverity[sev]} |`);
    }
  }
  lines.push('');

  // Module table
  const moduleEntries = Object.entries(meta.byModule).sort(
    ([a], [b]) => {
      const ai = PHASE1_MODULES.indexOf(a as typeof PHASE1_MODULES[number]);
      const bi = PHASE1_MODULES.indexOf(b as typeof PHASE1_MODULES[number]);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    },
  );
  if (moduleEntries.length > 0) {
    lines.push('| Module | Count |');
    lines.push('|--------|-------|');
    for (const [mod, count] of moduleEntries) {
      lines.push(`| ${mod} | ${count} |`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  // ── Findings ──
  lines.push('## Findings');
  lines.push('');

  // Sort: severity desc, then status
  const sorted = [...findings].sort((a, b) => {
    const sevDiff = (SEVERITY_SORT[a.severity] ?? 99) - (SEVERITY_SORT[b.severity] ?? 99);
    if (sevDiff !== 0) return sevDiff;
    return (STATUS_SORT[a.status] ?? 99) - (STATUS_SORT[b.status] ?? 99);
  });

  sorted.forEach((f, i) => {
    lines.push(`### ${i + 1}. [${f.severity.toUpperCase()}] ${f.title}`);
    lines.push('');
    lines.push(`- **Status:** ${STATUS_LABELS[f.status] || capitalize(f.status)}`);
    if (f.modules.length > 0) {
      lines.push(`- **Module:** ${f.modules.join(', ')}`);
    }
    lines.push(`- **Fix type:** ${f.fixType} -- ${f.classification}`);
    if (f.affectedPages.length > 0) {
      lines.push(
        `- **Affected pages:** ${f.affectedPages.join(', ')}`,
      );
    }
    if (f.dismissed) {
      lines.push(`- **Dismissed:** ${f.dismissalReason || 'Yes'}`);
    }
    lines.push('');

    // Description
    lines.push('**What we found**');
    lines.push('');
    lines.push(f.description);
    lines.push('');

    // Why it matters
    if (f.whyItMatters) {
      lines.push('**Why it matters**');
      lines.push('');
      lines.push(f.whyItMatters);
      lines.push('');
    }

    // Evidence
    if (f.evidence) {
      lines.push('**Evidence**');
      lines.push('');
      lines.push(f.evidence);
      lines.push('');
    }

    // Recommendation
    lines.push('**Recommended fix**');
    lines.push('');
    lines.push(f.recommendation);
    lines.push('');

    lines.push('---');
    lines.push('');
  });

  return lines.join('\n');
}

/* ── Helpers ─────────────────────────────────────────────── */

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDateForExport(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}
