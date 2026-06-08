// ============================================================
// ClearUX API — POST /api/findings/:id/explain
//
// Returns a short, step-by-step explanation of how to apply a fix
// for a given finding. Used by the Fix tab's "Explain" helper.
//
// Read-only. Never mutates findings, never pushes to a live site.
// Falls back to a deterministic explanation if no API key is set
// so the helper stays useful in dev environments.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import Anthropic from '@anthropic-ai/sdk'

let _anthropic: Anthropic | null = null
function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  if (!_anthropic) _anthropic = new Anthropic({ apiKey, timeout: 30_000 })
  return _anthropic
}

function deterministicExplanation(f: { title: string; description: string | null; recommendation: string | null }): string {
  const steps: string[] = []
  steps.push(`1. Confirm the issue: ${f.title}.`)
  if (f.description) steps.push(`2. Read the context — ${f.description.split(/\n+/)[0].slice(0, 220)}`)
  if (f.recommendation) steps.push(`3. Apply the recommended change. Suggested copy/snippet is loaded in the editor — edit before approving.`)
  steps.push(`${steps.length + 1}. Copy or download the snippet, ship the change, then come back and mark the finding as fixed.`)
  return steps.join('\n')
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: findingId } = await params
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = createServiceSupabase()
    const { data: finding } = await db
      .from('audit_findings')
      .select('audit_id, title, description, recommendation, severity')
      .eq('id', findingId)
      .single()
    if (!finding) return NextResponse.json({ error: 'Finding not found' }, { status: 404 })

    const { data: audit } = await db
      .from('audits')
      .select('user_id')
      .eq('id', (finding as any).audit_id)
      .is('deleted_at', null)
      .single()
    if (!audit || (audit as any).user_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const f = finding as any
    const anthropic = getAnthropicClient()
    if (!anthropic) {
      return NextResponse.json({
        explanation: deterministicExplanation(f),
        source: 'fallback',
      })
    }

    const resp = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `You are helping a website owner ship a fix for an audit finding.

FINDING TITLE: ${f.title}
FINDING CONTEXT: ${(f.description || '').slice(0, 800)}
RECOMMENDED FIX: ${(f.recommendation || '').slice(0, 800)}

Write a concise numbered list (3–5 steps) explaining how to apply this fix in practice.
Be specific and actionable. Plain text, no markdown, no preamble. Each step on its own line.`,
      }],
    })

    const text = resp.content[0]?.type === 'text' ? resp.content[0].text : ''
    const cleaned = text.replace(/^```[a-zA-Z]*\n?/g, '').replace(/```\s*$/g, '').trim()

    return NextResponse.json({
      explanation: cleaned || deterministicExplanation(f),
      source: cleaned ? 'ai' : 'fallback',
    })
  } catch (err) {
    console.error('POST /api/findings/:id/explain error:', err)
    return NextResponse.json({ error: 'Failed to generate explanation' }, { status: 500 })
  }
}
