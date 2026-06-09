import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

// ── Admin-only: Reconstruct missing workspaces from audit data ──
//
// The workspaces table was emptied but audits still reference workspace_ids.
// This endpoint reconstructs workspace records from the audit data.
//
// GET  = dry run (show what would be created)
// POST = execute reconstruction

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

async function reconstructWorkspaces(dryRun: boolean) {
  const db = createServiceSupabase()
  const results: string[] = []

  // 1. Find all distinct workspace_ids referenced by audits
  const { data: audits } = await db
    .from('audits')
    .select('workspace_id, user_id, product_url, audit_type')
    .not('workspace_id', 'is', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (!audits || audits.length === 0) {
    return { message: 'No audits with workspace_ids found', results: [] }
  }

  // Group by workspace_id
  const wsMap = new Map<string, { userId: string; urls: string[]; types: string[] }>()
  for (const a of audits as any[]) {
    if (!a.workspace_id) continue
    const existing = wsMap.get(a.workspace_id)
    if (existing) {
      if (a.product_url && !existing.urls.includes(a.product_url)) existing.urls.push(a.product_url)
      if (a.audit_type && !existing.types.includes(a.audit_type)) existing.types.push(a.audit_type)
    } else {
      wsMap.set(a.workspace_id, {
        userId: a.user_id,
        urls: a.product_url ? [a.product_url] : [],
        types: a.audit_type ? [a.audit_type] : [],
      })
    }
  }

  results.push(`Found ${wsMap.size} distinct workspace_ids referenced by ${audits.length} audits`)

  // 2. Check which workspace records actually exist
  const wsIds = Array.from(wsMap.keys())
  const { data: existingWs } = await db
    .from('workspaces')
    .select('id')
    .in('id', wsIds)

  const existingIds = new Set((existingWs || []).map((w: any) => w.id))
  const missingIds = wsIds.filter(id => !existingIds.has(id))

  results.push(`${existingIds.size} workspace(s) already exist, ${missingIds.length} need reconstruction`)

  if (missingIds.length === 0) {
    return { message: 'All workspaces already exist — nothing to reconstruct', results }
  }

  // 3. Reconstruct missing workspaces
  let created = 0
  for (const wsId of missingIds) {
    const info = wsMap.get(wsId)!

    // Derive domain from the first URL
    let primaryDomain = ''
    let wsName = 'Unnamed workspace'

    if (info.urls.length > 0) {
      try {
        const url = info.urls[0].startsWith('http') ? info.urls[0] : `https://${info.urls[0]}`
        const hostname = new URL(url).hostname.replace(/^www\./, '')
        primaryDomain = hostname
        // Use domain as name (e.g., "qinacademy.com")
        wsName = hostname
      } catch {
        primaryDomain = info.urls[0] || ''
        wsName = info.urls[0] || 'Unnamed workspace'
      }
    }

    const slug = slugify(primaryDomain || wsId.slice(0, 8))

    const wsRecord = {
      id: wsId, // Preserve the original UUID so audit references remain valid
      user_id: info.userId,
      name: wsName,
      slug,
      primary_domain: primaryDomain || null,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    if (dryRun) {
      results.push(`WOULD CREATE: workspace "${wsName}" (${wsId}) — domain: ${primaryDomain || 'none'}, slug: ${slug}, user: ${info.userId}, urls: ${info.urls.join(', ')}`)
    } else {
      const { error } = await db
        .from('workspaces')
        .insert(wsRecord as any)

      if (error) {
        results.push(`ERROR creating workspace "${wsName}" (${wsId}): ${error.message}`)

        // If slug conflict, try with a suffix
        if (error.message.includes('unique') || error.message.includes('duplicate')) {
          const altSlug = `${slug}-${wsId.slice(0, 6)}`
          const { error: retryError } = await db
            .from('workspaces')
            .insert({ ...wsRecord, slug: altSlug } as any)

          if (retryError) {
            results.push(`  RETRY also failed: ${retryError.message}`)
          } else {
            created++
            results.push(`  RETRY succeeded with slug "${altSlug}"`)
          }
        }
      } else {
        created++
        results.push(`CREATED: workspace "${wsName}" (${wsId}) — domain: ${primaryDomain}, slug: ${slug}`)
      }
    }
  }

  // 4. Also fix orphaned brand audits (NULL workspace_id)
  if (!dryRun && created > 0) {
    const { data: orphaned } = await db
      .from('audits')
      .select('id, user_id, audit_type')
      .is('workspace_id', null)
      .is('deleted_at', null)

    for (const audit of (orphaned || []) as any[]) {
      // Find a workspace for this user
      const { data: userWs } = await db
        .from('workspaces')
        .select('id, name')
        .eq('user_id', audit.user_id)
        .eq('status', 'active')
        .limit(1)

      if (userWs && userWs.length > 0) {
        const ws = userWs[0] as any
        const { error } = await db
          .from('audits')
          .update({ workspace_id: ws.id, updated_at: new Date().toISOString() } as any)
          .eq('id', audit.id)

        if (!error) {
          results.push(`ASSIGNED orphan ${audit.id} (${audit.audit_type}) → "${ws.name}" (${ws.id})`)
        }
      }
    }
  }

  return {
    message: dryRun
      ? `Dry run: ${missingIds.length} workspace(s) would be reconstructed`
      : `Reconstruction complete: ${created} workspace(s) created`,
    totalReferencedWorkspaces: wsMap.size,
    existing: existingIds.size,
    missing: missingIds.length,
    created: dryRun ? 0 : created,
    results,
  }
}

export async function GET() {
  const result = await reconstructWorkspaces(true)
  return NextResponse.json(result)
}

export async function POST() {
  const result = await reconstructWorkspaces(false)
  return NextResponse.json(result)
}
