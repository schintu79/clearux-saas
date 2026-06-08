// ============================================================
// Workspace Guards — Centralized live-query safety layer
// ============================================================
//
// Every live product query MUST pass through these guards or
// apply equivalent constraints. These helpers enforce:
//   1. user_id ownership
//   2. workspace_id scoping (when applicable)
//   3. active workspace status
//   4. deleted_at IS NULL on soft-deletable records
//
// NO dashboard route, processing job, or report query should
// bypass these constraints. Domain is metadata — workspace is
// the ownership boundary.
//
// Usage:
//   import { assertWorkspaceActive, liveAuditQuery, liveBrandQuery } from '@/lib/workspace-guards'
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'

// ── Types ───────────────────────────────────────────────────

export interface WorkspaceCheck {
  valid: boolean
  reason?: string
}

export interface AuditCoherenceCheck {
  valid: boolean
  reason?: string
  audit?: any
  workspace?: any
  brand?: any
}

// ── Workspace validation ────────────────────────────────────

/**
 * Assert a workspace exists, belongs to the user, and is active.
 * Returns { valid: true } or { valid: false, reason: '...' }.
 */
export async function assertWorkspaceActive(
  db: SupabaseClient,
  workspaceId: string,
  userId: string,
): Promise<WorkspaceCheck> {
  const { data, error } = await db
    .from('workspaces')
    .select('id, status')
    .eq('id', workspaceId)
    .eq('user_id', userId)
    .single()

  if (error || !data) return { valid: false, reason: 'Workspace not found' }
  if (data.status !== 'active') return { valid: false, reason: 'Workspace is archived' }
  return { valid: true }
}

/**
 * Full relational coherence check before processing an audit.
 * Validates:
 *   - audit exists and is not deleted
 *   - workspace is active (if present)
 *   - brand identity is live (if linked)
 *   - workspace IDs are internally consistent
 */
export async function assertAuditCoherence(
  db: SupabaseClient,
  auditId: string,
  userId: string,
): Promise<AuditCoherenceCheck> {
  // 1. Audit must exist and not be deleted
  const { data: audit, error: auditErr } = await db
    .from('audits')
    .select('id, user_id, workspace_id, brand_identity_id, deleted_at, status')
    .eq('id', auditId)
    .single()

  if (auditErr || !audit) return { valid: false, reason: 'Audit not found' }
  if ((audit as any).deleted_at) return { valid: false, reason: 'Audit is deleted' }
  if ((audit as any).user_id !== userId) return { valid: false, reason: 'Audit does not belong to user' }

  // 2. Workspace must be active (if present)
  const wsId = (audit as any).workspace_id
  let workspace: any = null
  if (wsId) {
    const { data: ws } = await db
      .from('workspaces')
      .select('id, status, user_id')
      .eq('id', wsId)
      .single()

    if (!ws || ws.status !== 'active') {
      return { valid: false, reason: 'Workspace is archived or deleted' }
    }
    if (ws.user_id !== userId) {
      return { valid: false, reason: 'Workspace does not belong to user' }
    }
    workspace = ws
  }

  // 3. Brand identity must be live (if linked)
  const biId = (audit as any).brand_identity_id
  let brand: any = null
  if (biId) {
    const { data: bi } = await db
      .from('brand_identities')
      .select('id, workspace_id, deleted_at')
      .eq('id', biId)
      .single()

    if (!bi) return { valid: false, reason: 'Linked brand identity not found' }
    if ((bi as any).deleted_at) return { valid: false, reason: 'Linked brand identity is deleted' }

    // 4. Cross-check: brand's workspace must match audit's workspace
    if (wsId && (bi as any).workspace_id && (bi as any).workspace_id !== wsId) {
      return { valid: false, reason: 'Brand identity workspace does not match audit workspace' }
    }
    brand = bi
  }

  return { valid: true, audit, workspace, brand }
}

// ── Query builder helpers ───────────────────────────────────

/**
 * Start a live audit query — always scoped by user_id + workspace_id
 * + deleted_at IS NULL.
 */
export function liveAuditQuery(
  db: SupabaseClient,
  userId: string,
  workspaceId: string,
  select = '*',
) {
  return db
    .from('audits')
    .select(select)
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
}

/**
 * Start a live brand identity query — always scoped by user_id
 * + workspace_id + deleted_at IS NULL.
 */
export function liveBrandQuery(
  db: SupabaseClient,
  userId: string,
  workspaceId: string,
  select = '*',
) {
  return db
    .from('brand_identities')
    .select(select)
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
}

/**
 * Fetch the latest completed audit for a workspace.
 * Returns null if no completed audit exists.
 */
export async function latestLiveAudit(
  db: SupabaseClient,
  userId: string,
  workspaceId: string,
): Promise<any | null> {
  const { data } = await db
    .from('audits')
    .select('*')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .eq('status', 'completed')
    .is('deleted_at', null)
    .order('completed_at', { ascending: false })
    .limit(1)
    .single()

  return data || null
}
