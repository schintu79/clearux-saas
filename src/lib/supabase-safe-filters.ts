/**
 * Safe Supabase query helpers — gracefully handle missing columns.
 *
 * Some columns (deleted_at, tag) were added in later migrations that
 * may not have been applied to all environments yet. These helpers
 * let queries work regardless, with automatic fallback.
 */

import { SupabaseClient, PostgrestFilterBuilder } from '@supabase/supabase-js'

/**
 * Fetch brand identity ownership, safe against missing `deleted_at` column.
 *
 * Tries with `.is('deleted_at', null)` first; on failure retries without.
 * Returns the row if found, null otherwise.
 */
export async function safeFetchBrandOwner(
  db: SupabaseClient,
  brandIdentityId: string,
): Promise<{ user_id: string } | null> {
  // Attempt with soft-delete filter
  const { data, error } = await db
    .from('brand_identities')
    .select('user_id')
    .eq('id', brandIdentityId)
    .is('deleted_at', null)
    .single()

  if (!error) return data as any

  // If the error is column-related, retry without the filter
  if (error.message?.includes('deleted_at') || error.code === '42703' || error.code === 'PGRST204') {
    const { data: fallback } = await db
      .from('brand_identities')
      .select('user_id')
      .eq('id', brandIdentityId)
      .single()
    return fallback as any
  }

  // Genuine "not found" or other error
  return null
}

/**
 * List brand identities with files, safe against missing columns.
 *
 * Falls back to simpler select if `deleted_at` or `tag` columns are missing.
 */
export async function safeListBrandIdentities(
  db: SupabaseClient,
  userId: string,
  workspaceId?: string | null,
): Promise<any[]> {
  // Full query with all columns
  let query = db
    .from('brand_identities')
    .select('*, brand_identity_files(id, file_name, file_type, file_size_bytes, created_at, tag)')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (workspaceId) query = query.eq('workspace_id', workspaceId)

  const { data, error } = await query

  if (!error) return data ?? []

  // Retry without `tag` in embedded select and without deleted_at filter
  let fallback = db
    .from('brand_identities')
    .select('*, brand_identity_files(id, file_name, file_type, file_size_bytes, created_at)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (workspaceId) fallback = fallback.eq('workspace_id', workspaceId)

  const { data: fb1, error: fb1Err } = await fallback

  if (!fb1Err) return fb1 ?? []

  // Last resort — no embedded select, no deleted_at
  let bare = db
    .from('brand_identities')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (workspaceId) bare = bare.eq('workspace_id', workspaceId)

  const { data: fb2 } = await bare

  // Manually load files if the bare query worked
  const identities = fb2 ?? []
  for (const identity of identities) {
    const { data: files } = await db
      .from('brand_identity_files')
      .select('id, file_name, file_type, file_size_bytes, created_at')
      .eq('brand_identity_id', identity.id)
    identity.brand_identity_files = files ?? []
  }

  return identities
}

/**
 * Fetch a single brand identity with files, safe against missing columns.
 */
export async function safeGetBrandIdentity(
  db: SupabaseClient,
  id: string,
  userId: string,
): Promise<any | null> {
  // Full query
  const { data, error } = await db
    .from('brand_identities')
    .select('*, brand_identity_files(*)')
    .eq('id', id)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .single()

  if (!error) return data

  // Retry without deleted_at
  const { data: fallback, error: fbErr } = await db
    .from('brand_identities')
    .select('*, brand_identity_files(*)')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (!fbErr) return fallback

  return null
}
