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

/* ── SFTP via ssh2 ─────────────────────────────────────────── */
async function createSftpClient(creds: FtpCredentials): Promise<FtpClientWrapper> {
  const { Client } = await import('ssh2');

  let conn: InstanceType<typeof Client> | null = null;
  let sftp: any = null;

  return {
    async connect() {
      return new Promise<void>((resolve, reject) => {
        conn = new Client();
        conn.on('ready', () => {
          conn!.sftp((err: Error | undefined, sftpStream: any) => {
            if (err) return reject(err);
            sftp = sftpStream;
            resolve();
          });
        });
        conn.on('error', reject);
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
      await client.access({
        host: creds.host,
        port: creds.port,
        user: creds.username,
        password: creds.password,
        secure: creds.protocol === 'ftps',
        secureOptions: creds.protocol === 'ftps' ? { rejectUnauthorized: false } : undefined,
      });
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
export function createFtpClient(creds: FtpCredentials): FtpClientWrapper {
  if (creds.protocol === 'sftp') return createSftpClient(creds) as unknown as FtpClientWrapper;
  return createFtpBasicClient(creds) as unknown as FtpClientWrapper;
}
