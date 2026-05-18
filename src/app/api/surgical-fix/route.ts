// ============================================================
// Fixpath API — /api/surgical-fix
// POST → Generate a surgical fix for a finding
//
// Reads the live file from FTP, uses AI to locate the exact
// code that needs changing, and returns a full patched file
// with a diff preview. Does NOT write to FTP — the caller
// uses /api/ftp with action:'write' to deploy after approval.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { decrypt } from '@/lib/ftp-crypto'
import { createFtpClient, type FtpCredentials } from '@/lib/ftp-client'
import {
  classifyOperation,
  buildPrompt,
  callSurgicalAI,
  applyPatch,
  computeDiff,
  validatePatch,
  type SurgicalFixRequest,
  type SurgicalFixResult,
} from '@/lib/surgical-fix'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30 // Haiku is fast — 30s is plenty

export async function POST(request: NextRequest) {
  try {
    // ── Auth ────────────────────────────────────────────────
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: SurgicalFixRequest = await request.json()
    const {
      connectionId,
      filePath,
      recommendation,
      findingTitle,
      findingDescription,
      findingCategory,
    } = body

    if (!connectionId || !filePath || !recommendation) {
      return NextResponse.json(
        { error: 'Missing required fields: connectionId, filePath, recommendation' },
        { status: 400 },
      )
    }

    // ── Classify operation ──────────────────────────────────
    const operation = classifyOperation(recommendation, findingTitle, findingDescription, filePath)

    // ── Handle "create" — no need to read existing file ────
    if (operation === 'create') {
      const result: SurgicalFixResult = {
        operation: 'create',
        originalContent: '',
        patchedContent: recommendation,
        changes: [{
          startLineOriginal: 1,
          startLinePatched: 1,
          linesRemoved: [],
          linesAdded: recommendation.split('\n'),
          contextBefore: [],
          contextAfter: [],
        }],
        confidence: 'high',
        aiExplanation: `Create new file: ${filePath}`,
      }
      return NextResponse.json(result)
    }

    // ── Get FTP credentials ─────────────────────────────────
    const creds = await getCredentials(connectionId, user.id)
    if (!creds) {
      return NextResponse.json({ error: 'FTP connection not found' }, { status: 404 })
    }

    // ── Read live file from FTP ─────────────────────────────
    let originalContent: string
    const client = await createFtpClient(creds)
    try {
      await client.connect()
      originalContent = await client.read(filePath)
      await client.disconnect()
    } catch (err: any) {
      // File doesn't exist — treat as create
      try { await client.disconnect() } catch {}
      const result: SurgicalFixResult = {
        operation: 'create',
        originalContent: '',
        patchedContent: recommendation,
        changes: [{
          startLineOriginal: 1,
          startLinePatched: 1,
          linesRemoved: [],
          linesAdded: recommendation.split('\n'),
          contextBefore: [],
          contextAfter: [],
        }],
        confidence: 'high',
        aiExplanation: `File does not exist yet — will be created: ${filePath}`,
        warning: `Could not read existing file: ${err?.message}. Will create new file.`,
      }
      return NextResponse.json(result)
    }

    // ── Check for binary content ────────────────────────────
    if (isBinary(originalContent)) {
      return NextResponse.json(
        { error: 'This file appears to be binary and cannot be surgically modified.' },
        { status: 400 },
      )
    }

    // ── Build and call AI ───────────────────────────────────
    const prompt = buildPrompt(
      operation,
      originalContent,
      recommendation,
      findingTitle,
      findingDescription,
    )

    const aiResult = await callSurgicalAI(prompt)

    // ── Handle AI failure ───────────────────────────────────
    if (aiResult.failed) {
      const result: SurgicalFixResult = {
        operation,
        originalContent,
        patchedContent: originalContent,
        changes: [],
        confidence: 'low',
        aiExplanation: '',
        warning: `Could not locate the fix point: ${aiResult.failReason || 'unknown reason'}. You can apply the fix manually.`,
      }
      return NextResponse.json(result)
    }

    // ── Apply the patch programmatically ────────────────────
    const { patchedContent, applied, warning: patchWarning } = applyPatch(
      originalContent,
      aiResult.patch!,
    )

    if (!applied) {
      const result: SurgicalFixResult = {
        operation,
        originalContent,
        patchedContent: originalContent,
        changes: [],
        confidence: 'low',
        aiExplanation: aiResult.explanation,
        warning: patchWarning || 'Patch could not be applied. The target code was not found in the file.',
      }
      return NextResponse.json(result)
    }

    // ── Validate and diff ───────────────────────────────────
    const validation = validatePatch(originalContent, patchedContent, operation)
    const changes = computeDiff(originalContent, patchedContent)

    let confidence: 'high' | 'medium' | 'low' = 'high'
    if (validation.warnings.length > 0) confidence = 'medium'
    if (!validation.valid) confidence = 'low'
    if (changes.length === 0) confidence = 'low'

    const result: SurgicalFixResult = {
      operation,
      originalContent,
      patchedContent,
      changes,
      confidence,
      aiExplanation: aiResult.explanation,
      warning: validation.warnings.length > 0
        ? validation.warnings.join(' ')
        : changes.length === 0
          ? 'No changes detected. Try editing manually.'
          : undefined,
    }

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[surgical-fix] Error:', err)
    return NextResponse.json(
      { error: err?.message || 'Internal server error generating surgical fix.' },
      { status: 500 },
    )
  }
}

// ── Helpers ────────────────────────────────────────────────

async function getCredentials(connectionId: string, userId: string): Promise<FtpCredentials | null> {
  const db = createServiceSupabase()
  const { data, error } = await db
    .from('ftp_connections')
    .select('*')
    .eq('id', connectionId)
    .eq('user_id', userId)
    .single()

  if (error || !data) return null

  return {
    protocol: (data as any).protocol,
    host: (data as any).host,
    port: (data as any).port,
    username: (data as any).username,
    password: decrypt((data as any).password_encrypted),
    remotePath: (data as any).remote_path,
  }
}

function isBinary(content: string): boolean {
  // Check for null bytes in first 512 chars
  for (let i = 0; i < Math.min(content.length, 512); i++) {
    if (content.charCodeAt(i) === 0) return true
  }
  return false
}
