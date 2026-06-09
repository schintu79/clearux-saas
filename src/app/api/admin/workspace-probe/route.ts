import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

// ── Admin-only: Deep probe into workspace table structure ──
// Diagnoses why workspace queries return empty

export async function GET() {
  const db = createServiceSupabase()
  const results: Record<string, any> = {}

  // 1. Select just id — this worked in rebuild
  const q1 = await db.from('workspaces').select('id').limit(10)
  results.justId = { data: q1.data, error: q1.error?.message || null, count: q1.data?.length }

  // 2. Select * to see actual columns
  const q2 = await db.from('workspaces').select('*').limit(5)
  results.selectAll = {
    data: q2.data,
    error: q2.error?.message || null,
    count: q2.data?.length,
    // Show column names from first row
    columns: q2.data && q2.data.length > 0 ? Object.keys(q2.data[0]) : 'NO_ROWS',
  }

  // 3. Try each column individually to find which one breaks
  const cols = ['id', 'name', 'slug', 'primary_domain', 'user_id', 'status', 'deleted_at', 'created_at', 'updated_at']
  const colResults: Record<string, any> = {}
  for (const col of cols) {
    const q = await db.from('workspaces').select(col).limit(1)
    colResults[col] = {
      ok: !q.error,
      error: q.error?.message || null,
      sample: q.data?.[0] || null,
    }
  }
  results.columnProbe = colResults

  // 4. Get workspace IDs referenced by audits
  const { data: auditWsIds } = await db
    .from('audits')
    .select('workspace_id')
    .not('workspace_id', 'is', null)
    .is('deleted_at', null)

  const uniqueIds = [...new Set((auditWsIds || []).map((a: any) => a.workspace_id))]
  results.auditWorkspaceIds = uniqueIds

  // 5. For each referenced ID, check if it exists and what data it has
  const wsDetails: any[] = []
  for (const wsId of uniqueIds) {
    const q = await db.from('workspaces').select('*').eq('id', wsId).single()
    wsDetails.push({
      id: wsId,
      exists: !q.error,
      error: q.error?.message || null,
      data: q.data,
    })
  }
  results.workspaceDetails = wsDetails

  return NextResponse.json(results)
}
