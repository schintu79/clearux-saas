// ============================================================
// FTP/SFTP client wrapper
// Supports SFTP (ssh2), FTP, and FTPS (basic-ftp)
//
// The factory is synchronous — dynamic imports of the underlying
// transports happen lazily inside connect(). Callers can do:
//
//   const client = createFtpClient(creds);
//   await client.connect();
// ============================================================

import type { FtpProtocol } from '@/types/database';

export interface FtpCredentials {
  protocol: FtpProtocol;
  host: string;
  port: number;
  username: string;
  password: string;
  remotePath: string;
}

export interface RemoteFile {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  modifiedAt: string | null;
}

export interface FtpClientWrapper {
  connect(): Promise<void>;
  list(dirPath: string): Promise<RemoteFile[]>;
  read(filePath: string): Promise<string>;
  write(filePath: string, content: string): Promise<void>;
  mkdir(dirPath: string): Promise<void>;
  delete(filePath: string): Promise<void>;
  /** Soft disconnect — returns the connection to the pool for reuse.
   *  The pool closes idle connections after 60 seconds automatically. */
  disconnect(): Promise<void>;
}

/* ── Error normalisation ───────────────────────────────────── */
function normalizeSshError(err: Error & { code?: string; level?: string }, creds: FtpCredentials): Error {
  const raw = err?.message || String(err);
  const code = err?.code || '';
  const lvl = err?.level || '';
  let hint = raw;
  if (code === 'ENOTFOUND' || /getaddrinfo/i.test(raw)) {
    hint = `Host not found: ${creds.host}. Check the hostname.`;
  } else if (code === 'ECONNREFUSED') {
    hint = `Connection refused on ${creds.host}:${creds.port}. Check host, port, and firewall.`;
  } else if (code === 'ETIMEDOUT' || /timed?\s*out/i.test(raw)) {
    hint = `Connection to ${creds.host}:${creds.port} timed out. The server may be unreachable or blocking your IP.`;
  } else if (lvl === 'client-authentication' || /authentication|all configured authentication methods failed/i.test(raw)) {
    hint = 'Authentication failed. Check username and password.';
  } else if (/handshake/i.test(raw)) {
    hint = `SSH handshake failed with ${creds.host}. The server may not support our SSH algorithms.`;
  }
  return new Error(hint);
}

function normalizeFtpError(err: Error & { code?: string | number }, creds: FtpCredentials): Error {
  const raw = err?.message || String(err);
  const code = err?.code;
  let hint = raw;
  if (code === 'ENOTFOUND' || /getaddrinfo/i.test(raw)) {
    hint = `Host not found: ${creds.host}. Check the hostname.`;
  } else if (code === 'ECONNREFUSED') {
    hint = `Connection refused on ${creds.host}:${creds.port}. Check host, port, and firewall.`;
  } else if (code === 'ETIMEDOUT' || /timed?\s*out/i.test(raw)) {
    hint = `Connection to ${creds.host}:${creds.port} timed out. The server may be unreachable.`;
  } else if (/530|login|authentication|incorrect/i.test(raw)) {
    hint = 'Authentication failed. Check username and password.';
  } else if (/ssl|tls|certificate/i.test(raw)) {
    hint = `TLS error connecting to ${creds.host}. If using FTPS, make sure the server supports it.`;
  }
  return new Error(hint);
}

/* ── SFTP via ssh2 ─────────────────────────────────────────── */
function createSftpClient(creds: FtpCredentials): FtpClientWrapper {
  // Dynamic import happens inside connect() so the factory stays synchronous.
  let conn: any = null;
  let sftp: any = null;

  return {
    async connect() {
      // If already connected, skip reconnection
      if (conn && sftp) return;
      const { Client } = await import('ssh2');
      return new Promise<void>((resolve, reject) => {
        conn = new Client();
        let settled = false;
        const done = (err: Error | null) => {
          if (settled) return;
          settled = true;
          if (err) { conn = null; sftp = null; reject(normalizeSshError(err, creds)); }
          else resolve();
        };
        conn.on('ready', () => {
          conn!.sftp((err: Error | undefined, sftpStream: any) => {
            if (err) return done(err);
            sftp = sftpStream;
            done(null);
          });
        });
        conn.on('error', (err: Error) => {
          done(err);
          // Mark connection as dead so reconnect is possible
          conn = null;
          sftp = null;
        });
        conn.on('close', () => {
          conn = null;
          sftp = null;
        });
        try {
          conn.connect({
            host: creds.host,
            port: creds.port,
            username: creds.username,
            password: creds.password,
            readyTimeout: 10000,
            keepaliveInterval: 10000,
            keepaliveCountMax: 3,
            algorithms: {
              kex: ['ecdh-sha2-nistp256', 'ecdh-sha2-nistp384', 'ecdh-sha2-nistp521', 'diffie-hellman-group14-sha256', 'diffie-hellman-group14-sha1'],
            },
          });
        } catch (err) {
          done(err as Error);
        }
      });
    },

    async list(dirPath: string): Promise<RemoteFile[]> {
      if (!sftp) throw new Error('Not connected — call connect() first');
      return new Promise((resolve, reject) => {
        sftp.readdir(dirPath, (err: Error | null, list: any[]) => {
          if (err) return reject(err);
          const files: RemoteFile[] = (list || [])
            .filter((f: any) => f.filename !== '.' && f.filename !== '..')
            .map((f: any) => ({
              name: f.filename,
              path: `${dirPath === '/' ? '' : dirPath}/${f.filename}`,
              type: f.attrs.isDirectory() ? 'directory' : 'file',
              size: f.attrs.size || 0,
              modifiedAt: f.attrs.mtime ? new Date(f.attrs.mtime * 1000).toISOString() : null,
            }));
          resolve(files);
        });
      });
    },

    async read(filePath: string): Promise<string> {
      if (!sftp) throw new Error('Not connected — call connect() first');
      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        const stream = sftp.createReadStream(filePath);
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        stream.on('error', reject);
      });
    },

    async write(filePath: string, content: string): Promise<void> {
      if (!sftp) throw new Error('Not connected — call connect() first');
      return new Promise((resolve, reject) => {
        const stream = sftp.createWriteStream(filePath);
        stream.on('close', () => resolve());
        stream.on('error', reject);
        stream.end(content, 'utf8');
      });
    },

    async mkdir(dirPath: string): Promise<void> {
      if (!sftp) throw new Error('Not connected — call connect() first');
      return new Promise((resolve, reject) => {
        sftp.mkdir(dirPath, (err: Error | null) => {
          if (err && (err as any).code !== 4) return reject(err); // 4 = already exists
          resolve();
        });
      });
    },

    async delete(filePath: string): Promise<void> {
      if (!sftp) throw new Error('Not connected — call connect() first');
      return new Promise((resolve, reject) => {
        sftp.unlink(filePath, (err: Error | null) => {
          if (err) return reject(err);
          resolve();
        });
      });
    },

    async disconnect() {
      if (conn) conn.end();
      conn = null;
      sftp = null;
    },
  };
}

/* ── FTP/FTPS via basic-ftp ────────────────────────────────── */
function createFtpBasicClient(creds: FtpCredentials): FtpClientWrapper {
  // Dynamic import happens inside connect() so the factory stays synchronous.
  let client: any = null;

  return {
    async connect() {
      // If already connected, skip reconnection
      if (client && !client.closed) return;
      const basicFtp = await import('basic-ftp');
      client = new basicFtp.Client();
      client.ftp.verbose = false;
      try {
        await client.access({
          host: creds.host,
          port: creds.port,
          user: creds.username,
          password: creds.password,
          secure: creds.protocol === 'ftps',
          secureOptions: creds.protocol === 'ftps' ? { rejectUnauthorized: false } : undefined,
        });
      } catch (err) {
        client = null;
        throw normalizeFtpError(err as Error, creds);
      }
    },

    async list(dirPath: string): Promise<RemoteFile[]> {
      if (!client) throw new Error('Not connected — call connect() first');
      const list = await client.list(dirPath);
      return list
        .filter((f: any) => f.name !== '.' && f.name !== '..')
        .map((f: any) => ({
          name: f.name,
          path: `${dirPath === '/' ? '' : dirPath}/${f.name}`,
          type: f.isDirectory ? 'directory' : 'file',
          size: f.size,
          modifiedAt: f.modifiedAt ? f.modifiedAt.toISOString() : null,
        }));
    },

    async read(filePath: string): Promise<string> {
      if (!client) throw new Error('Not connected — call connect() first');
      const { Writable } = await import('stream');
      const chunks: Buffer[] = [];
      const writable = new Writable({
        write(chunk, _enc, cb) { chunks.push(chunk); cb(); },
      });
      await client.downloadTo(writable, filePath);
      return Buffer.concat(chunks).toString('utf8');
    },

    async write(filePath: string, content: string): Promise<void> {
      if (!client) throw new Error('Not connected — call connect() first');
      const { Readable } = await import('stream');
      const readable = Readable.from(Buffer.from(content, 'utf8'));
      await client.uploadFrom(readable, filePath);
    },

    async mkdir(dirPath: string): Promise<void> {
      if (!client) throw new Error('Not connected — call connect() first');
      await client.ensureDir(dirPath);
    },

    async delete(filePath: string): Promise<void> {
      if (!client) throw new Error('Not connected — call connect() first');
      await client.remove(filePath);
    },

    async disconnect() {
      if (client) client.close();
      client = null;
    },
  };
}

/* ── Connection Pool ──────────────────────────────────────── */

interface PoolEntry {
  wrapper: FtpClientWrapper;
  /** Hard-close the underlying transport — bypasses the soft-disconnect wrapper. */
  hardClose: () => Promise<void>;
  lastUsed: number;
  timer: ReturnType<typeof setTimeout>;
}

/** TTL in ms — idle connections are closed after this period. */
const POOL_TTL = 60_000; // 60 seconds

const pool = new Map<string, PoolEntry>();

function poolKey(creds: FtpCredentials): string {
  return `${creds.protocol}://${creds.username}@${creds.host}:${creds.port}`;
}

function releasePoolEntry(key: string) {
  const entry = pool.get(key);
  if (!entry) return;
  clearTimeout(entry.timer);
  pool.delete(key);
  entry.hardClose().catch(() => {});
}

/* ── Factory ───────────────────────────────────────────────── */
/**
 * Returns a pooled FTP/SFTP client wrapper. Connections are kept alive
 * for 60 seconds after last use, so sequential operations (e.g. read →
 * review → deploy) reuse the same TCP/SSH connection instead of
 * reconnecting each time.
 *
 * The returned wrapper is safe to call connect() on multiple times —
 * it's a no-op if already connected.
 *
 *   const client = createFtpClient(creds);
 *   await client.connect();
 */
export function createFtpClient(creds: FtpCredentials): FtpClientWrapper {
  const key = poolKey(creds);
  const existing = pool.get(key);

  if (existing) {
    // Refresh the idle timer
    clearTimeout(existing.timer);
    existing.lastUsed = Date.now();
    existing.timer = setTimeout(() => releasePoolEntry(key), POOL_TTL);
    return existing.wrapper;
  }

  // Create a new client
  const raw = creds.protocol === 'sftp' ? createSftpClient(creds) : createFtpBasicClient(creds);

  // Retry helper — if an operation fails with a connection error, reconnect once and retry.
  async function withRetry<T>(op: () => Promise<T>): Promise<T> {
    try {
      return await op();
    } catch (err: any) {
      const msg = String(err?.message || '').toLowerCase();
      const isConnError = msg.includes('not connected') || msg.includes('socket') ||
        msg.includes('closed') || msg.includes('end of stream') || msg.includes('econnreset');
      if (!isConnError) throw err;
      // Reconnect and retry once
      await raw.connect();
      return op();
    }
  }

  // Wrap methods — disconnect is a soft release (just refreshes the idle timer).
  // The pool auto-closes the real connection after POOL_TTL of inactivity.
  const wrapper: FtpClientWrapper = {
    connect: () => raw.connect(),
    list: (d) => withRetry(() => raw.list(d)),
    read: (f) => withRetry(() => raw.read(f)),
    write: (f, c) => withRetry(() => raw.write(f, c)),
    mkdir: (d) => withRetry(() => raw.mkdir(d)),
    delete: (f) => withRetry(() => raw.delete(f)),
    async disconnect() {
      // Soft close — just refresh the pool timer so the connection stays
      // alive for reuse by the next API call. The pool will hard-close it
      // after POOL_TTL of inactivity.
      const entry = pool.get(key);
      if (entry) {
        clearTimeout(entry.timer);
        entry.lastUsed = Date.now();
        entry.timer = setTimeout(() => releasePoolEntry(key), POOL_TTL);
      }
    },
  };

  const entry: PoolEntry = {
    wrapper,
    hardClose: () => raw.disconnect(),
    lastUsed: Date.now(),
    timer: setTimeout(() => releasePoolEntry(key), POOL_TTL),
  };
  pool.set(key, entry);

  return wrapper;
}
