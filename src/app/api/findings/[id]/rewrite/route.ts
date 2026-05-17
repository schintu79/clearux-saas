// ============================================================
// ClearUX API — POST /api/findings/:id/rewrite
//
// Lightweight AI helper for the Fix Console.
// Given a finding + a user instruction (e.g. "make this title clearer",
// "tighten this meta description", "make it brand aligned"), returns
// a single suggested rewrite of the patch text. Never mutates anything.
// The user must explicitly accept and push the change themselves.
//
// Falls back to a deterministic placeholder suggestion if no API key
// is configured, so the UI stays useful in any environment.
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

function deterministicSuggestion(patch: string, instruction: string, fallback: string): string {
  const i = instruction.toLowerCase()
  const trimmed = patch.trim() || fallback.trim()
  if (!trimmed) return ''
  if (i.includes('short') || i.includes('tight') || i.includes('concise')) {
    const sentences = trimmed.split(/(?<=[.!?])\s+/)
    return sentences.slice(0, 2).join(' ')
  }
  if (i.includes('clear')) return trimmed.replace(/\s+/g, ' ')
  return trimmed
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: findingId } = await params
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const patch = typeof body.patch === 'string' ? body.patch : ''
    const instruction = typeof body.instruction === 'string' ? body.instruction.slice(0, 500) : ''
    if (!instruction.trim()) {
      return NextResponse.json({ error: 'instruction required' }, { status: 400 })
    }

    const db = createServiceSupabase()
    const { data: finding } = await db
      .from('audit_findings')
      .select('audit_id, title, description, severity')
      .eq('id', findingId)
      .single()
    if (!finding) return NextResponse.json({ error: 'Finding not found' }, { status: 404 })

    const { data: audit } = await db
      .from('audits')
      .select('user_id')
      .eq('id', (finding as any).audit_id)
      .single()
    if (!audit || (audit as any).user_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const f = finding as any
    const findingContext = `${f.title}. ${f.description || ''}`.trim()
    const anthropic = getAnthropicClient()
    if (!anthropic) {
      return NextResponse.json({
        suggestion: deterministicSuggestion(patch, instruction, findingContext),
        source: 'fallback',
        note: 'AI key not configured — returned a basic local rewrite. Edit before approving.',
      })
    }

    const hasPatch = patch.trim().length > 0
    const resp = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: hasPatch
          ? `You are helping a website owner refine an implementation-ready fix snippet.

FINDING TITLE: ${f.title}
FINDING CONTEXT: ${f.description?.slice(0, 600) || '(none)'}

CURRENT FIX TEXT:
"""
${patch.slice(0, 2000)}
"""

USER INSTRUCTION: ${instruction}

Return ONLY the rewritten fix text — no preamble, no markdown fences, no commentary.
Preserve the format (if the input is JSON, return valid JSON; if it's copy text, return copy text).
Stay practical and concise. Do not invent facts. If the instruction is unclear, make the smallest improvement that helps.`
          : `You are helping a website owner draft an implementation-ready fix for an audit finding.

FINDING TITLE: ${f.title}
FINDING CONTEXT: ${f.description?.slice(0, 600) || '(none)'}

USER INSTRUCTION: ${instruction}

There is no existing fix text yet — draft one from scratch based on the finding above.
Return ONLY the fix text — no preamble, no markdown fences, no commentary.
Choose the most natural format (copy text, JSON-LD, HTML snippet, etc.) based on the finding.
Stay practical and concise. Do not invent facts beyond what the finding suggests.`,
      }],
    })

    const text = resp.content[0]?.type === 'text' ? resp.content[0].text : ''
    const cleaned = text.replace(/^```[a-zA-Z]*\n?/g, '').replace(/```\s*$/g, '').trim()

    return NextResponse.json({
      suggestion: cleaned || deterministicSuggestion(patch, instruction, findingContext),
      source: cleaned ? 'ai' : 'fallback',
    })
  } catch (err) {
    console.error('POST /api/findings/:id/rewrite error:', err)
    return NextResponse.json({ error: 'Failed to generate suggestion' }, { status: 500 })
  }
}
