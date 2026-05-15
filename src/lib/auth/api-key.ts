// ============================================================
// ClearUX — API key authentication helper
//
// Resolves a Bearer token from the Authorization header into a
// user row, so /api/* route handlers can serve machine-to-machine
// clients (WordPress plugin, CI integrations) in addition to the
// existing cookie-session callers.
//
// Usage in a route handler:
//
//   const auth = await getAuthenticatedUser(request)
//   if (!auth) return unauthorized()
//   const { userId, source, key } = auth   // source: 'api_key' | 'cookie'
//
// The helper tries API key first, then falls back to the
// cookie-based Supabase SSR session. Cookie auth is unchanged.
// ============================================================

import { createHash, randomBytes } from 'crypto'
import type { NextRequest } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

export type AuthScope = 'audits:read' | 'audits:run' | 'reports:read' | 'admin'

export type AuthenticatedUser = {
  userId: string
  email: string | null
  source: 'api_key' | 'cookie'
  scopes: AuthScope[]
  keyId?: string
}

const RAW_KEY_PREFIX = 'cux_'

function hashKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex')
}

/**
 * Generate a fresh API key. Returns the raw key (show to the user
 * once) and the hash (store in DB). The prefix is the literal
 * "cux_" plus the first 8 chars of the entropy portion, for
 * display in the dashboard ("cux_a1b2c3d4…").
 */
export function generateApiKey(): { rawKey: string; keyHash: string; keyPrefix: string } {
  const entropy = randomBytes(32).toString('base64url')
  const rawKey = `${RAW_KEY_PREFIX}${entropy}`
  return {
    rawKey,
    keyHash: hashKey(rawKey),
    keyPrefix: `${RAW_KEY_PREFIX}${entropy.slice(0, 8)}`,
  }
}

/**
 * Pull the Bearer token from an Authorization header.
 * Returns null if the header is missing or malformed.
 */
function extractBearer(request: NextRequest | Request): string | null {
  const header = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!header) return null
  const match = header.match(/^Bearer\s+(.+)$/i)
  if (!match) return null
  const token = match[1].trim()
  if (!token.startsWith(RAW_KEY_PREFIX)) return null
  return token
}

/**
 * Resolve a Bearer API key to a user. Returns null when:
 *   - no Authorization header is present
 *   - the token doesn't look like a ClearUX key
 *   - no matching, non-revoked, non-expired key exists
 *
 * On success, updates last_used_at on a best-effort basis (does
 * not block the request).
 */
async function authenticateWithApiKey(
  request: NextRequest | Request,
): Promise<AuthenticatedUser | null> {
  const token = extractBearer(request)
  if (!token) return null

  const db = createServiceSupabase()
  const keyHash = hashKey(token)

  const { data, error } = await db
    .from('api_keys')
    .select('id, user_id, scopes, revoked_at, expires_at')
    .eq('key_hash', keyHash)
    .maybeSingle()

  if (error || !data) return null
  const row = data as any
  if (row.revoked_at) return null
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return null

  // Touch last_used_at without blocking the request.
  db.from('api_keys')
    .update({ last_used_at: new Date().toISOString() } as any)
    .eq('id', row.id)
    .then(() => {}, (err: unknown) => console.warn('[api-key] touch failed:', err))

  // Look up email from profiles for parity with cookie auth.
  let email: string | null = null
  try {
    const { data: prof } = await db
      .from('profiles')
      .select('email')
      .eq('id', row.user_id)
      .maybeSingle()
    email = (prof as any)?.email ?? null
  } catch {
    // Non-fatal.
  }

  return {
    userId: row.user_id,
    email,
    source: 'api_key',
    scopes: Array.isArray(row.scopes) ? (row.scopes as AuthScope[]) : [],
    keyId: row.id,
  }
}

/**
 * Resolve the current user from either an API key (preferred when
 * an Authorization header is present) or the cookie-based Supabase
 * SSR session (existing behaviour). Returns null when neither
 * succeeds.
 *
 * Existing routes can adopt this incrementally:
 *
 *   const auth = await getAuthenticatedUser(request)
 *   if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 *   const { userId } = auth
 *
 * No behaviour change for routes that haven't adopted it yet.
 */
export async function getAuthenticatedUser(
  request: NextRequest | Request,
  requiredScope?: AuthScope,
): Promise<AuthenticatedUser | null> {
  const apiKeyAuth = await authenticateWithApiKey(request)
  if (apiKeyAuth) {
    if (requiredScope && !apiKeyAuth.scopes.includes(requiredScope)) return null
    return apiKeyAuth
  }

  // Cookie fallback — unchanged from existing pattern.
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    return {
      userId: user.id,
      email: user.email ?? null,
      source: 'cookie',
      // Cookie sessions are full-trust (the user themselves), so
      // they implicitly carry every scope.
      scopes: ['audits:read', 'audits:run', 'reports:read'],
    }
  } catch {
    return null
  }
}

/**
 * Hash helper exported for the (eventual) /api/account/api-keys
 * route that mints new keys.
 */
export function hashApiKey(rawKey: string): string {
  return hashKey(rawKey)
}
