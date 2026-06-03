// ============================================================
// Fixpath — Finding Communication Display Helpers
// ============================================================
//
// Shared utilities for rendering the dual-layer communication
// model across all display paths (Find, Fix, FixConsole, shared
// view, reports, exports).
//
// BACKWARD COMPATIBLE: All functions gracefully handle findings
// that lack the `communication` JSONB field (legacy findings).
// ============================================================

import type { AuditFinding, FindingCommunication } from '@/types/database'

/**
 * Get the display title — prefers plain-language title, falls back to original.
 */
export function getDisplayTitle(finding: AuditFinding | Record<string, any>): string {
  const comm = (finding as any).communication as FindingCommunication | null
  return comm?.title_plain || finding.title
}

/**
 * Get the "what we found" text — prefers communication.what_found, falls back to description.
 */
export function getWhatFound(finding: AuditFinding | Record<string, any>): string {
  const comm = (finding as any).communication as FindingCommunication | null
  return comm?.what_found || finding.description
}

/**
 * Get the "why it matters" text — prefers communication.why_matters, falls back to estimated_impact.
 */
export function getWhyMatters(finding: AuditFinding | Record<string, any>): string | null {
  const comm = (finding as any).communication as FindingCommunication | null
  return comm?.why_matters || (finding as any).estimated_impact || null
}

/**
 * Get the technical note — only available in communication layer.
 */
export function getTechnicalNote(finding: AuditFinding | Record<string, any>): string | null {
  const comm = (finding as any).communication as FindingCommunication | null
  return comm?.technical_note || null
}

/**
 * Get the plain-language fix recommendation.
 */
export function getFixPlain(finding: AuditFinding | Record<string, any>): string {
  const comm = (finding as any).communication as FindingCommunication | null
  return comm?.fix_plain || finding.recommendation
}

/**
 * Get the technical fix recommendation.
 */
export function getFixTechnical(finding: AuditFinding | Record<string, any>): string | null {
  const comm = (finding as any).communication as FindingCommunication | null
  return comm?.fix_technical || null
}

/**
 * Check if a finding has the dual-layer communication data.
 */
export function hasCommunication(finding: AuditFinding | Record<string, any>): boolean {
  const comm = (finding as any).communication as FindingCommunication | null
  return !!comm && !!comm.title_plain && !!comm.what_found
}

/**
 * Get the full communication object, or null.
 */
export function getCommunication(finding: AuditFinding | Record<string, any>): FindingCommunication | null {
  return (finding as any).communication as FindingCommunication | null
}
