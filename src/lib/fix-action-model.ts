/**
 * Fixpath — Canonical Fix Action Model
 *
 * Defines the single source of truth for:
 *  - What actions a user can take on a finding (action modes)
 *  - Which finding types support which actions (capability map)
 *  - What fix formats are available per type (patch formats)
 *  - Whether a finding is self-fixable, team-handoff-only, or strategic
 *
 * PROPRIETARY — do not distribute outside the Fixpath codebase.
 *
 * This module is React-free so it can be used across:
 *  - Fix Console UI
 *  - API routes
 *  - Export formatters
 *  - Pipeline processing
 *  - Background jobs
 */

import type { AuditFinding, FindingType, FixType } from '@/types/database';

/* ── Action modes ──────────────────────────────────────── */

/**
 * The four canonical actions a user can take on any finding.
 *
 * self_fix     — User will fix it themselves via the inline deploy console
 * team_handoff — User will send it to their team (copy brief, download, export)
 * defer        — User acknowledges but wants to address it later (not dismissed)
 * fixed        — Issue has been resolved (manually or via deploy)
 */
export type ActionMode = 'self_fix' | 'team_handoff' | 'defer' | 'fixed';

/* ── Fix status lifecycle ──────────────────────────────── */

/**
 * Workflow state for a finding's fix journey.
 *
 * unreviewed  — Finding surfaced, no action taken yet
 * in_progress — User is actively working on this fix
 * approved    — Fix has been reviewed and approved, pending deploy
 * deferred    — User chose to address later (distinct from dismissed)
 * fixed       — Fix confirmed deployed/applied
 * failed      — Deploy or fix attempt failed
 */
export type FixStatus =
  | 'unreviewed'
  | 'in_progress'
  | 'approved'
  | 'deferred'
  | 'fixed'
  | 'failed';

/* ── Supported low-risk fix types ──────────────────────── */

/**
 * Low-risk, deterministic fix types that can be safely deployed
 * through the self-fix console with user approval.
 *
 * These map to specific operations the surgical fix engine can
 * handle either deterministically (Tier 1) or via AI patch (Tier 2).
 */
export type DeployableFixType =
  | 'meta_title'
  | 'meta_description'
  | 'heading_copy'
  | 'alt_text'
  | 'schema_jsonld'
  | 'faq_block'
  | 'ai_summary'
  | 'robots_llms'
  | 'lang_attribute'
  | 'viewport_meta'
  | 'canonical_url'
  | 'meta_charset'
  | 'og_tags';

/* ── Patch format ──────────────────────────────────────── */

/**
 * Format of the fix payload. Determines how the Fix Console
 * renders the editor and how the surgical fix engine processes it.
 */
export type PatchFormat = 'text' | 'html' | 'json' | 'meta' | 'schema';

/* ── Capability map entry ──────────────────────────────── */

export interface FixCapability {
  /** Whether the finding can be self-fixed via deploy console */
  selfFixable: boolean;
  /** Whether the finding can be handed off to a team */
  teamHandoff: boolean;
  /** Whether the finding content is editable by the user */
  editable: boolean;
  /** Whether the finding can be deployed to a server */
  deployable: boolean;
  /** Whether AI helper should be shown for this type */
  aiAssistAvailable: boolean;
  /** Requires explicit user approval before any live mutation */
  approvalRequired: boolean;
  /** Expected patch format */
  patchFormat: PatchFormat;
  /** Deployable fix type key (null if not deployable) */
  deployableType: DeployableFixType | null;
  /** Who should typically fix this */
  defaultOwner: 'self' | 'engineering' | 'marketing' | 'design' | 'product';
}

/* ── Normalized finding payload ────────────────────────── */

/**
 * The normalized payload every finding exposes for the action model.
 * This is the contract between the pipeline and the Fix Console.
 */
export interface NormalizedFixPayload {
  /** Short summary of the issue */
  summary: string;
  /** Business impact description */
  impact: string | null;
  /** The recommended patch text or code */
  recommendedPatch: string;
  /** Format of the patch */
  patchFormat: PatchFormat;
  /** Whether this finding is eligible for self-deploy */
  deployEligible: boolean;
  /** Whether the patch content can be edited */
  isEditable: boolean;
  /** Allowed action modes based on the capability map */
  allowedActions: ActionMode[];
  /** The capability entry for this finding */
  capability: FixCapability;
}

/* ── Capability map ────────────────────────────────────── */

/**
 * Maps the combination of finding_type + fix_type to a capability set.
 *
 * This is the single source of truth for what the UI should show.
 * No pattern matching, no heuristics — data-driven decisions.
 */

const DEPLOYABLE_CAPABILITIES: Record<string, FixCapability> = {
  // ── Tier 1: Deterministic, instant, zero cost ──
  lang_attribute: {
    selfFixable: true, teamHandoff: true, editable: false, deployable: true,
    aiAssistAvailable: false, approvalRequired: true, patchFormat: 'html',
    deployableType: 'lang_attribute', defaultOwner: 'self',
  },
  viewport_meta: {
    selfFixable: true, teamHandoff: true, editable: false, deployable: true,
    aiAssistAvailable: false, approvalRequired: true, patchFormat: 'meta',
    deployableType: 'viewport_meta', defaultOwner: 'self',
  },
  meta_charset: {
    selfFixable: true, teamHandoff: true, editable: false, deployable: true,
    aiAssistAvailable: false, approvalRequired: true, patchFormat: 'meta',
    deployableType: 'meta_charset', defaultOwner: 'self',
  },
  canonical_url: {
    selfFixable: true, teamHandoff: true, editable: true, deployable: true,
    aiAssistAvailable: false, approvalRequired: true, patchFormat: 'html',
    deployableType: 'canonical_url', defaultOwner: 'self',
  },

  // ── Tier 2: AI-assisted, editable text patches ──
  meta_title: {
    selfFixable: true, teamHandoff: true, editable: true, deployable: true,
    aiAssistAvailable: true, approvalRequired: true, patchFormat: 'meta',
    deployableType: 'meta_title', defaultOwner: 'marketing',
  },
  meta_description: {
    selfFixable: true, teamHandoff: true, editable: true, deployable: true,
    aiAssistAvailable: true, approvalRequired: true, patchFormat: 'meta',
    deployableType: 'meta_description', defaultOwner: 'marketing',
  },
  heading_copy: {
    selfFixable: true, teamHandoff: true, editable: true, deployable: true,
    aiAssistAvailable: true, approvalRequired: true, patchFormat: 'html',
    deployableType: 'heading_copy', defaultOwner: 'marketing',
  },
  alt_text: {
    selfFixable: true, teamHandoff: true, editable: true, deployable: true,
    aiAssistAvailable: true, approvalRequired: true, patchFormat: 'html',
    deployableType: 'alt_text', defaultOwner: 'marketing',
  },
  og_tags: {
    selfFixable: true, teamHandoff: true, editable: true, deployable: true,
    aiAssistAvailable: true, approvalRequired: true, patchFormat: 'meta',
    deployableType: 'og_tags', defaultOwner: 'marketing',
  },

  // ── Tier 2: Structured data ──
  schema_jsonld: {
    selfFixable: true, teamHandoff: true, editable: true, deployable: true,
    aiAssistAvailable: true, approvalRequired: true, patchFormat: 'schema',
    deployableType: 'schema_jsonld', defaultOwner: 'engineering',
  },
  faq_block: {
    selfFixable: true, teamHandoff: true, editable: true, deployable: true,
    aiAssistAvailable: true, approvalRequired: true, patchFormat: 'schema',
    deployableType: 'faq_block', defaultOwner: 'engineering',
  },

  // ── Tier 2: File creation ──
  robots_llms: {
    selfFixable: true, teamHandoff: true, editable: true, deployable: true,
    aiAssistAvailable: false, approvalRequired: true, patchFormat: 'text',
    deployableType: 'robots_llms', defaultOwner: 'engineering',
  },
  ai_summary: {
    selfFixable: true, teamHandoff: true, editable: true, deployable: true,
    aiAssistAvailable: true, approvalRequired: true, patchFormat: 'text',
    deployableType: 'ai_summary', defaultOwner: 'marketing',
  },
};

/** Capability for fixable findings that don't map to a deployable type */
const FIXABLE_NON_DEPLOYABLE: FixCapability = {
  selfFixable: false, teamHandoff: true, editable: false, deployable: false,
  aiAssistAvailable: false, approvalRequired: false, patchFormat: 'text',
  deployableType: null, defaultOwner: 'engineering',
};

/** Capability for design-required findings */
const DESIGN_REQUIRED: FixCapability = {
  selfFixable: false, teamHandoff: true, editable: false, deployable: false,
  aiAssistAvailable: false, approvalRequired: false, patchFormat: 'text',
  deployableType: null, defaultOwner: 'design',
};

/** Capability for strategic/observational findings */
const STRATEGIC: FixCapability = {
  selfFixable: false, teamHandoff: true, editable: false, deployable: false,
  aiAssistAvailable: false, approvalRequired: false, patchFormat: 'text',
  deployableType: null, defaultOwner: 'product',
};

/* ── Finding → deployable fix type inference ───────────── */

/**
 * Maps a finding's characteristics to a deployable fix type key.
 * Returns null if the finding doesn't match any deployable pattern.
 *
 * This replaces the scattered regex pattern matching across FixConsole
 * and surgical-fix.ts with a single, authoritative lookup.
 */
export function inferDeployableType(
  finding: Pick<AuditFinding, 'title' | 'description' | 'recommendation' | 'fix_type'>,
): DeployableFixType | null {
  const text = `${finding.title} ${finding.description} ${finding.recommendation}`.toLowerCase();

  // Exact fix_type mappings first (highest confidence)
  if (finding.fix_type === 'schema') {
    if (/faq/i.test(text)) return 'faq_block';
    if (/json-?ld|structured\s+data|@type/i.test(text)) return 'schema_jsonld';
    return 'schema_jsonld';
  }

  if (finding.fix_type === 'meta') {
    if (/og:|open\s+graph/i.test(text)) return 'og_tags';
    if (/meta\s+desc/i.test(text)) return 'meta_description';
    if (/title\s+tag|page\s+title|meta\s+title/i.test(text)) return 'meta_title';
    if (/viewport/i.test(text)) return 'viewport_meta';
    if (/charset/i.test(text)) return 'meta_charset';
    if (/canonical/i.test(text)) return 'canonical_url';
    return 'meta_description'; // Default meta fix
  }

  // Content-based inference for remaining types
  if (/\blang(uage)?\s*(=|attr)/i.test(text) && /html/i.test(text)) return 'lang_attribute';
  if (/viewport\s+meta/i.test(text)) return 'viewport_meta';
  if (/canonical\s*(url|tag)/i.test(text)) return 'canonical_url';
  if (/alt\s+(text|attr|tag)/i.test(text)) return 'alt_text';
  if (/heading|<h[1-6]/i.test(text) && finding.fix_type === 'copy') return 'heading_copy';
  if (/llms\.txt|robots\.txt|ai\s+discovery/i.test(text)) return 'robots_llms';
  if (/ai[- ]summary|llm[- ]summary/i.test(text)) return 'ai_summary';
  if (/faq\s+(schema|block|page)/i.test(text)) return 'faq_block';
  if (/og:|open\s+graph/i.test(text)) return 'og_tags';
  if (/schema|json-?ld|structured\s+data|@type/i.test(text)) return 'schema_jsonld';
  if (/meta\s+desc/i.test(text)) return 'meta_description';
  if (/title\s+tag|page\s+title/i.test(text)) return 'meta_title';

  return null;
}

/* ── Core capability resolver ──────────────────────────── */

/**
 * Resolve the full capability set for a finding.
 *
 * This is the single entry point the UI and API should use to determine
 * what actions, controls, and features to show for any finding.
 */
export function resolveCapability(
  finding: Pick<AuditFinding, 'title' | 'description' | 'recommendation' | 'fix_type' | 'finding_type'>,
): FixCapability {
  // Strategic findings → handoff only
  if (finding.finding_type === 'strategic') {
    return STRATEGIC;
  }

  // Try to match a deployable fix type
  const deployableType = inferDeployableType(finding);

  if (deployableType && DEPLOYABLE_CAPABILITIES[deployableType]) {
    return DEPLOYABLE_CAPABILITIES[deployableType];
  }

  // Check if it's a design-required finding
  const text = `${finding.title} ${finding.description}`.toLowerCase();
  if (
    /design\s+(work|change|update|redesign)/i.test(text) ||
    /visual\s+(design|layout|change)/i.test(text) ||
    /ux\s+redesign/i.test(text) ||
    /requires?\s+design/i.test(text)
  ) {
    return DESIGN_REQUIRED;
  }

  // Fixable but not deployable (needs manual implementation)
  return FIXABLE_NON_DEPLOYABLE;
}

/* ── Allowed actions resolver ──────────────────────────── */

/**
 * Given a capability set, return which ActionModes the user can choose.
 */
export function allowedActions(cap: FixCapability): ActionMode[] {
  const actions: ActionMode[] = [];

  if (cap.selfFixable) actions.push('self_fix');
  if (cap.teamHandoff) actions.push('team_handoff');
  actions.push('defer'); // Always available
  actions.push('fixed'); // Always available (manual confirmation)

  return actions;
}

/* ── Normalize a finding for the Fix Console ───────────── */

/**
 * Takes a raw AuditFinding and produces the normalized payload
 * the Fix Console needs to render the correct UI.
 */
export function normalizeForFixConsole(
  finding: AuditFinding,
): NormalizedFixPayload {
  const capability = resolveCapability(finding);
  const actions = allowedActions(capability);

  return {
    summary: finding.description,
    impact: finding.estimated_impact || null,
    recommendedPatch: finding.recommendation,
    patchFormat: capability.patchFormat,
    deployEligible: capability.deployable,
    isEditable: capability.editable,
    allowedActions: actions,
    capability,
  };
}

/* ── Utility: default owner label ──────────────────────── */

const OWNER_LABELS: Record<string, string> = {
  self: 'You',
  engineering: 'Engineering',
  marketing: 'Marketing',
  design: 'Design',
  product: 'Product',
};

export function ownerLabel(owner: string): string {
  return OWNER_LABELS[owner] || owner;
}

/* ── Utility: action mode labels ───────────────────────── */

const ACTION_MODE_LABELS: Record<ActionMode, string> = {
  self_fix: 'Fix it yourself',
  team_handoff: 'Send to your team',
  defer: 'Save for later',
  fixed: 'Mark as fixed',
};

export function actionModeLabel(mode: ActionMode): string {
  return ACTION_MODE_LABELS[mode];
}

/* ── Utility: fix status labels ────────────────────────── */

const FIX_STATUS_LABELS: Record<FixStatus, string> = {
  unreviewed: 'Unreviewed',
  in_progress: 'In progress',
  approved: 'Approved',
  deferred: 'Deferred',
  fixed: 'Fixed',
  failed: 'Failed',
};

export function fixStatusLabel(status: FixStatus): string {
  return FIX_STATUS_LABELS[status];
}
