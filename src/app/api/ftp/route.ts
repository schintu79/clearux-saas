// ============================================================
// ClearUX API — /api/ftp
// POST → FTP operations (test, list, read, write, save-connection, delete-connection)
// GET  → list saved connections for current user, plus provisioning status
//
// Provisioning gates:
//  - The `ftp_connections` table comes from migration 032. If it's missing,
//    every persistent action returns a clear 503 with `provisioned: false`
//    instead of a raw Postgres error.
//  - Saving credentials requires `FTP_ENCRYPTION_KEY` to be set. Without it
//    we return 503 with `configured: false`. Test-connection still works so
//    users can verify their server before configuring storage.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';
import { encrypt, decrypt } from '@/lib/ftp-crypto';
import { createFtpClient, type FtpCredentials } from '@/lib/ftp-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MISSING_TABLE_CODE = '42P01';

function isMissingTable(err: any): boolean {
  if (!err) return false;
  if (err.code === MISSING_TABLE_CODE) return true;
  const msg = String(err.message || '').toLowerCase();
  return msg.includes('relation') && msg.includes('does not exist') && msg.includes('ftp_');
}

function notProvisionedResponse() {
  return NextResponse.json(
    {
      error: 'FTP feature not yet provisioned. Apply migration 032_ftp_connections.sql in Supabase.',
      provisioned: false,
    },
    { status: 503 },
  );
}

function encryptionMissingResponse() {
  return NextResponse.json(
    {
      error: 'FTP_ENCRYPTION_KEY env var is not set. Configure it before saving credentials.',
      configured: false,
    },
    { status: 503 },
  );
}

/* ── GET — list user's saved connections ─────────────────── */
export async function GET() {
  try {
    const supabase = await createServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = createServiceSupabase();
    const { data: connections, error } = await db
      .from('ftp_connections')
      .select('id, label, protocol, host, port, username, remote_path, brand_identity_id, last_connected_at, is_active, created_at, updated_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      if (isMissingTable(error)) return notProvisionedResponse();
      throw error;
    }

    return NextResponse.json({
      connections: connections || [],
      provisioned: true,
      configured: !!process.env.FTP_ENCRYPTION_KEY,
    });
  } catch (err: any) {
    if (isMissingTable(err)) return notProvisionedResponse();
    console.error('GET /api/ftp error:', err);
    return NextResponse.json({ error: 'Failed to fetch connections' }, { status: 500 });
  }
}

/* ── POST — FTP operations ───────────────────────────────── */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'test':
        // Test never touches the DB — no provisioning gate required.
        return handleTest(body);
      case 'save':
      case 'update': {
        const enc = !process.env.FTP_ENCRYPTION_KEY;
        if (enc) return encryptionMissingResponse();
        return action === 'save' ? handleSave(body, user.id) : handleUpdate(body, user.id);
      }
      case 'delete':
        return handleDelete(body, user.id);
      case 'list':
        return handleList(body, user.id);
      case 'read':
        return handleRead(body, user.id);
      case 'write':
        return handleWrite(body, user.id);
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    if (isMissingTable(err)) return notProvisionedResponse();
    console.error('POST /api/ftp error:', err);
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}

/* ── Handlers ────────────────────────────────────────────── */

async function handleTest(body: any) {
  const { protocol, host, port, username, password, remotePath } = body;
  if (!host || !username || !password)
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });

  const creds: FtpCredentials = {
    protocol: protocol || 'sftp',
    host,
    port: port || (protocol === 'sftp' ? 22 : 21),
    username,
    password,
    remotePath: remotePath || '/',
  };

  const client = createFtpClient(creds);
  try {
    await client.connect();
    const files = await client.list(creds.remotePath);
    await client.disconnect();
    return NextResponse.json({ success: true, message: 'Connected successfully', fileCount: files.length });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Connection failed' }, { status: 200 });
  }
}

async function handleSave(body: any, userId: string) {
  const { label, protocol, host, port, username, password, remotePath, brandIdentityId } = body;
  if (!host || !username || !password)
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });

  const db = createServiceSupabase();
  const { data, error } = await db
    .from('ftp_connections')
    .insert({
      user_id: userId,
      brand_identity_id: brandIdentityId || null,
      label: label || 'My server',
      protocol: protocol || 'sftp',
      host,
      port: port || (protocol === 'sftp' ? 22 : 21),
      username,
      password_encrypted: encrypt(password),
      remote_path: remotePath || '/',
    } as any)
    .select('id, label, protocol, host, port, username, remote_path, brand_identity_id, created_at')
    .single();

  if (error) {
    if (isMissingTable(error)) return notProvisionedResponse();
    throw error;
  }
  return NextResponse.json({ connection: data });
}

async function handleUpdate(body: any, userId: string) {
  const { connectionId, label, protocol, host, port, username, password, remotePath } = body;
  if (!connectionId)
    return NextResponse.json({ error: 'Missing connectionId' }, { status: 400 });

  const db = createServiceSupabase();

  // Verify ownership
  const { data: existing, error: lookupErr } = await db
    .from('ftp_connections')
    .select('id')
    .eq('id', connectionId)
    .eq('user_id', userId)
    .single();

  if (lookupErr && isMissingTable(lookupErr)) return notProvisionedResponse();
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (label !== undefined) updates.label = label;
  if (protocol !== undefined) updates.protocol = protocol;
  if (host !== undefined) updates.host = host;
  if (port !== undefined) updates.port = port;
  if (username !== undefined) updates.username = username;
  if (password !== undefined && password) updates.password_encrypted = encrypt(password);
  if (remotePath !== undefined) updates.remote_path = remotePath;

  const { error } = await db
    .from('ftp_connections')
    .update(updates as any)
    .eq('id', connectionId);

  if (error) {
    if (isMissingTable(error)) return notProvisionedResponse();
    throw error;
  }
  return NextResponse.json({ success: true });
}

async function handleDelete(body: any, userId: string) {
  const { connectionId } = body;
  if (!connectionId)
    return NextResponse.json({ error: 'Missing connectionId' }, { status: 400 });

  const db = createServiceSupabase();
  const { error } = await db
    .from('ftp_connections')
    .delete()
    .eq('id', connectionId)
    .eq('user_id', userId);

  if (error) {
    if (isMissingTable(error)) return notProvisionedResponse();
    throw error;
  }
  return NextResponse.json({ success: true });
}

async function handleList(body: any, userId: string) {
  const { connectionId, dirPath } = body;
  if (!connectionId)
    return NextResponse.json({ error: 'Missing connectionId' }, { status: 400 });

  const creds = await getCredentials(connectionId, userId);
  if (!creds) return NextResponse.json({ error: 'Connection not found' }, { status: 404 });

  const client = createFtpClient(creds);
  try {
    await client.connect();
    const path = dirPath || creds.remotePath;
    const files = await client.list(path);
    await client.disconnect();

    // Update last_connected_at
    const db = createServiceSupabase();
    await db.from('ftp_connections').update({ last_connected_at: new Date().toISOString() } as any).eq('id', connectionId);

    return NextResponse.json({ files, currentPath: path });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to list files' }, { status: 500 });
  }
}

async function handleRead(body: any, userId: string) {
  const { connectionId, filePath } = body;
  if (!connectionId || !filePath)
    return NextResponse.json({ error: 'Missing connectionId or filePath' }, { status: 400 });

  const creds = await getCredentials(connectionId, userId);
  if (!creds) return NextResponse.json({ error: 'Connection not found' }, { status: 404 });

  const client = createFtpClient(creds);
  try {
    await client.connect();
    const content = await client.read(filePath);
    await client.disconnect();
    return NextResponse.json({ content, filePath });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to read file' }, { status: 500 });
  }
}

async function handleWrite(body: any, userId: string) {
  const { connectionId, filePath, content, auditId, findingId, createBackup } = body;
  if (!connectionId || !filePath || content === undefined)
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });

  const creds = await getCredentials(connectionId, userId);
  if (!creds) return NextResponse.json({ error: 'Connection not found' }, { status: 404 });

  const client = createFtpClient(creds);
  const db = createServiceSupabase();
  let backupContent: string | null = null;

  try {
    await client.connect();

    // Create backup of existing file if requested
    if (createBackup !== false) {
      try {
        backupContent = await client.read(filePath);
      } catch {
        // File might not exist yet — no backup needed
      }
    }

    // Write the new content
    await client.write(filePath, content);
    await client.disconnect();

    // Log the deploy
    await db.from('ftp_deploy_log').insert({
      connection_id: connectionId,
      user_id: userId,
      audit_id: auditId || null,
      finding_id: findingId || null,
      file_path: filePath,
      action: backupContent ? 'update' : 'create',
      backup_content: backupContent,
      new_content: content.substring(0, 50000), // cap at 50KB for storage
      status: 'success',
    } as any);

    return NextResponse.json({ success: true, hadBackup: !!backupContent });
  } catch (err: any) {
    // Log failure
    try {
      await db.from('ftp_deploy_log').insert({
        connection_id: connectionId,
        user_id: userId,
        audit_id: auditId || null,
        finding_id: findingId || null,
        file_path: filePath,
        action: 'update',
        status: 'failed',
        error_message: err?.message || 'Unknown error',
      } as any);
    } catch { /* swallow — deploy log is best-effort */ }

    return NextResponse.json({ error: err?.message || 'Failed to write file' }, { status: 500 });
  }
}

/* ── Helpers ─────────────────────────────────────────────── */

async function getCredentials(connectionId: string, userId: string): Promise<FtpCredentials | null> {
  const db = createServiceSupabase();
  const { data, error } = await db
    .from('ftp_connections')
    .select('*')
    .eq('id', connectionId)
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;

  return {
    protocol: (data as any).protocol,
    host: (data as any).host,
    port: (data as any).port,
    username: (data as any).username,
    password: decrypt((data as any).password_encrypted),
    remotePath: (data as any).remote_path,
  };
}
