import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

/**
 * GET /api/audits/[id]/activity?after=<iso-timestamp>
 *
 * Returns recent audit_logs for the live activity feed.
 * Supports incremental fetching via `after` param.
 * Returns max 50 entries, newest first.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: auditId } = await params
  const after = req.nextUrl.searchParams.get('after')

  // Auth check
  const userSupabase = await createServerSupabase()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceSupabase()

  // Verify ownership
  const { data: audit } = await db
    .from('audits')
    .select('user_id')
    .eq('id', auditId)
    .is('deleted_at', null)
    .single()

  if (!audit || (audit as any).user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch logs — only "activity" events for the feed, skip internal debug events
  let query = db
    .from('audit_logs')
    .select('id, event, status, message, metadata, created_at')
    .eq('audit_id', auditId)
    .in('event', [
      'stage_started', 'stage_completed', 'stage_failed',
      'activity', 'pipeline_started', 'pipeline_completed',
      'pipeline_failed', 'pipeline_stalled',
    ])
    .order('created_at', { ascending: true })
    .limit(100)

  if (after) {
    query = query.gt('created_at', after)
  }

  const { data: logs, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 })
  }

  return NextResponse.json({
    logs: (logs ?? []).map((log: any) => ({
      id: log.id,
      event: log.event,
      status: log.status,
      message: log.message,
      metadata: log.metadata,
      createdAt: log.created_at,
    })),
  })
}
