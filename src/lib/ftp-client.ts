// ============================================================
// FTP/SFTP client wrapper
// Supports SFTP (ssh2), FTP, and FTPS (basic-ftp)
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
  const out = new Error(hint);
  return out;
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
async function createSftpClient(creds: FtpCredentials): Promise<FtpClientWrapper> {
  const { Client } = await import('ssh2');

  let conn: InstanceType<typeof Client> | null = null;
  let sftp: any = null;

  return {
    async connect() {
      return new Promise<void>((resolve, reject) => {
        conn = new Client();
        let settled = false;
        const done = (err: Error | null) => {
          if (settled) return;
          settled = true;
          if (err) reject(normalizeSshError(err, creds));
          else resolve();
        };
        conn.on('ready', () => {
          conn!.sftp((err: Error | undefined, sftpStream: any) => {
            if (err) return done(err);
            sftp = sftpStream;
            done(null);
          });
        });
        conn.on('error', (err: Error) => done(err));
        try {
          conn.connect({
            host: creds.host,
            port: creds.port,
            username: creds.username,
            password: creds.password,
            readyTimeout: 10000,
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
      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        const stream = sftp.createReadStream(filePath);
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        stream.on('error', reject);
      });
    },

    async write(filePath: string, content: string): Promise<void> {
      return new Promise((resolve, reject) => {
        const stream = sftp.createWriteStream(filePath);
        stream.on('close', () => resolve());
        stream.on('error', reject);
        stream.end(content, 'utf8');
      });
    },

    async mkdir(dirPath: string): Promise<void> {
      return new Promise((resolve, reject) => {
        sftp.mkdir(dirPath, (err: Error | null) => {
          if (err && (err as any).code !== 4) return reject(err); // 4 = already exists
          resolve();
        });
      });
    },

    async delete(filePath: string): Promise<void> {
      return new Promise((resolve, reject) => {
        sftp.unlink(filePath, (err: Error | null) => {
          if (err) return reject(err);
          resolve();
        });
      });
    },

    async disconnect() {
      if (conn) conn.end();
    },
  };
}

/* ── FTP/FTPS via basic-ftp ────────────────────────────────── */
async function createFtpBasicClient(creds: FtpCredentials): Promise<FtpClientWrapper> {
  const { Client } = await import('basic-ftp');

  const client = new Client();
  client.ftp.verbose = false;

  return {
    async connect() {
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
        throw normalizeFtpError(err as Error, creds);
      }
    },

    async list(dirPath: string): Promise<RemoteFile[]> {
      const list = await client.list(dirPath);
      return list
        .filter((f) => f.name !== '.' && f.name !== '..')
        .map((f) => ({
          name: f.name,
          path: `${dirPath === '/' ? '' : dirPath}/${f.name}`,
          type: f.isDirectory ? 'directory' : 'file',
          size: f.size,
          modifiedAt: f.modifiedAt ? f.modifiedAt.toISOString() : null,
        }));
    },

    async read(filePath: string): Promise<string> {
      const { Writable } = await import('stream');
      const chunks: Buffer[] = [];
      const writable = new Writable({
        write(chunk, _enc, cb) { chunks.push(chunk); cb(); },
      });
      await client.downloadTo(writable, filePath);
      return Buffer.concat(chunks).toString('utf8');
    },

    async write(filePath: string, content: string): Promise<void> {
      const { Readable } = await import('stream');
      const readable = Readable.from(Buffer.from(content, 'utf8'));
      await client.uploadFrom(readable, filePath);
    },

    async mkdir(dirPath: string): Promise<void> {
      await client.ensureDir(dirPath);
    },

    async delete(filePath: string): Promise<void> {
      await client.remove(filePath);
    },

    async disconnect() {
      client.close();
    },
  };
}

/* ── Factory ───────────────────────────────────────────────── */
/**
 * Async factory — the underlying transports use dynamic imports, so the
 * wrapper itself is built asynchronously. Callers MUST `await` this:
 *
 *   const client = await createFtpClient(creds);
 *   await client.connect();
 */
export async function createFtpClient(creds: FtpCredentials): Promise<FtpClientWrapper> {
  if (creds.protocol === 'sftp') return createSftpClient(creds);
  return createFtpBasicClient(creds);
}
