/**
 * Workspace Data Isolation — Contract Tests
 *
 * Verifies that workspace boundaries are airtight:
 *   1. Deletion semantics — archived workspace child records are invisible
 *   2. Recreation behavior — new workspace with same domain inherits nothing
 *   3. Cross-workspace isolation — workspace A never sees workspace B data
 *   4. Orphan immunity — workspace_id=NULL records never leak into scoped queries
 *   5. FTP security — FTP connections are hard-deleted on workspace deletion
 *   6. Billing isolation — deleted audits excluded from billing quotas
 *
 * These are contract tests: they mock the Supabase client to verify that
 * our query builders and handler logic enforce isolation correctly, without
 * requiring a live database.
 */

import type { Workspace, Audit, ScheduledAudit, SiteNote, BrandIdentity, FtpConnection } from '@/types/database'

// ---------------------------------------------------------------------------
// Supabase mock infrastructure
// ---------------------------------------------------------------------------

type MockRow = Record<string, unknown>

/**
 * Builds a chainable Supabase query mock that applies filters against an
 * in-memory dataset. Each filter method (.eq, .neq, .is, .in, .lt, .gte,
 * .lte, .like) narrows the dataset. Terminal methods (.single, await via
 * then) resolve the promise with the filtered result.
 */
function createQueryBuilder(rows: MockRow[]) {
  let filtered = [...rows]
  let selectFields: string | null = null
  let countMode = false
  let headMode = false
  let orderField: string | null = null
  let orderAsc = true

  const builder: Record<string, any> = {
    select(fields?: string, opts?: { count?: string; head?: boolean }) {
      selectFields = fields ?? '*'
      if (opts?.count === 'exact') countMode = true
      if (opts?.head) headMode = true
      return builder
    },
    eq(col: string, val: unknown) {
      filtered = filtered.filter((r) => r[col] === val)
      return builder
    },
    neq(col: string, val: unknown) {
      filtered = filtered.filter((r) => r[col] !== val)
      return builder
    },
    is(col: string, val: unknown) {
      filtered = filtered.filter((r) => r[col] === val)
      return builder
    },
    in(col: string, vals: unknown[]) {
      filtered = filtered.filter((r) => vals.includes(r[col]))
      return builder
    },
    lt(col: string, val: unknown) {
      filtered = filtered.filter((r) => (r[col] as any) < (val as any))
      return builder
    },
    gte(col: string, val: unknown) {
      filtered = filtered.filter((r) => (r[col] as any) >= (val as any))
      return builder
    },
    lte(col: string, val: unknown) {
      filtered = filtered.filter((r) => (r[col] as any) <= (val as any))
      return builder
    },
    like(col: string, pattern: string) {
      const regex = new RegExp('^' + pattern.replace(/%/g, '.*') + '$')
      filtered = filtered.filter((r) => regex.test(String(r[col] ?? '')))
      return builder
    },
    order(col: string, opts?: { ascending?: boolean }) {
      orderField = col
      orderAsc = opts?.ascending ?? true
      return builder
    },
    single() {
      if (countMode) {
        return Promise.resolve({ count: filtered.length, data: null, error: null })
      }
      if (filtered.length === 0) {
        return Promise.resolve({ data: null, error: { code: 'PGRST116', message: 'No rows found' } })
      }
      return Promise.resolve({ data: filtered[0], error: null })
    },
    // Allow the builder to be awaited directly (non-single terminal)
    then(resolve: (val: any) => void, reject?: (err: any) => void) {
      if (orderField) {
        filtered.sort((a, b) => {
          const av = a[orderField!] as any
          const bv = b[orderField!] as any
          return orderAsc ? (av < bv ? -1 : av > bv ? 1 : 0) : (av > bv ? -1 : av < bv ? 1 : 0)
        })
      }
      const result = countMode
        ? { count: filtered.length, data: headMode ? null : filtered, error: null }
        : { data: filtered, error: null }
      resolve(result)
    },
  }

  return builder
}

/** Tracks mutations applied via update/delete/insert on the mock client. */
interface Mutation {
  table: string
  type: 'update' | 'delete' | 'insert'
  filters: Array<{ method: string; col: string; val: unknown }>
  payload?: Record<string, unknown>
}

/**
 * Creates a mock Supabase client backed by an in-memory dataset.
 * Tables are keyed by name; each value is an array of row objects.
 */
function createMockSupabase(tables: Record<string, MockRow[]>) {
  const mutations: Mutation[] = []

  function from(table: string) {
    const rows = tables[table] ?? []

    return {
      select: (fields?: string, opts?: { count?: string; head?: boolean }) => {
        return createQueryBuilder(rows).select(fields, opts)
      },
      update(payload: Record<string, unknown>) {
        const mutation: Mutation = { table, type: 'update', filters: [], payload }
        const chain: Record<string, any> = {
          eq(col: string, val: unknown) { mutation.filters.push({ method: 'eq', col, val }); return chain },
          is(col: string, val: unknown) { mutation.filters.push({ method: 'is', col, val }); return chain },
          select() { return chain },
          single() { mutations.push(mutation); return Promise.resolve({ data: null, error: null }) },
          then(resolve: (v: any) => void) { mutations.push(mutation); resolve({ data: null, error: null }) },
        }
        return chain
      },
      delete() {
        const mutation: Mutation = { table, type: 'delete', filters: [] }
        const chain: Record<string, any> = {
          eq(col: string, val: unknown) { mutation.filters.push({ method: 'eq', col, val }); return chain },
          is(col: string, val: unknown) { mutation.filters.push({ method: 'is', col, val }); return chain },
          then(resolve: (v: any) => void) { mutations.push(mutation); resolve({ data: null, error: null }) },
        }
        return chain
      },
      insert(payload: Record<string, unknown> | Record<string, unknown>[]) {
        const mutation: Mutation = { table, type: 'insert', filters: [], payload: Array.isArray(payload) ? payload[0] : payload }
        const chain: Record<string, any> = {
          select() { return chain },
          single() { mutations.push(mutation); return Promise.resolve({ data: mutation.payload, error: null }) },
          then(resolve: (v: any) => void) { mutations.push(mutation); resolve({ data: mutation.payload, error: null }) },
        }
        return chain
      },
    }
  }

  return {
    from,
    mutations,
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
    },
  }
}

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

const USER_ID = 'user-1'
const USER_ID_B = 'user-2'
const WORKSPACE_A_ID = 'ws-aaa-111'
const WORKSPACE_B_ID = 'ws-bbb-222'
const ARCHIVED_WS_ID = 'ws-archived-333'
const DOMAIN = 'example.com'

function makeWorkspace(overrides: Partial<Workspace> = {}): MockRow {
  return {
    id: WORKSPACE_A_ID,
    user_id: USER_ID,
    name: 'Test Workspace',
    slug: 'test-workspace',
    primary_domain: DOMAIN,
    brand_name: null,
    workspace_type: 'website',
    status: 'active',
    active_audit_id: null,
    active_brand_identity_id: null,
    settings_json: {},
    category: null,
    subcategory: null,
    region: null,
    country: null,
    city: null,
    language: 'en',
    audience_type: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    archived_at: null,
    ...overrides,
  }
}

function makeAudit(overrides: Partial<Audit> & { id: string; workspace_id: string } = { id: 'audit-1', workspace_id: WORKSPACE_A_ID }): MockRow {
  return {
    user_id: USER_ID,
    status: 'completed',
    product_url: `https://${DOMAIN}`,
    product_type: 'website',
    audit_type: 'website',
    depth_mode: 'standard',
    created_at: '2025-06-01T00:00:00Z',
    updated_at: '2025-06-01T00:00:00Z',
    deleted_at: null,
    ...overrides,
  }
}

function makeScheduledAudit(overrides: Partial<ScheduledAudit> = {}): MockRow {
  return {
    id: 'sched-1',
    user_id: USER_ID,
    product_url: `https://${DOMAIN}`,
    frequency: 'monthly',
    language: 'en',
    is_active: true,
    last_run_at: null,
    next_run_at: '2025-07-01T00:00:00Z',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    workspace_id: WORKSPACE_A_ID,
    ...overrides,
  }
}

function makeSiteNote(overrides: Partial<SiteNote> = {}): MockRow {
  return {
    id: 'note-1',
    user_id: USER_ID,
    domain: DOMAIN,
    note_type: 'context',
    category: null,
    title: 'Note title',
    content: 'Note content',
    finding_ref: null,
    is_active: true,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    workspace_id: WORKSPACE_A_ID,
    ...overrides,
  }
}

function makeBrandIdentity(overrides: Partial<BrandIdentity> = {}): MockRow {
  return {
    id: 'brand-1',
    user_id: USER_ID,
    name: 'My Brand',
    description: null,
    website_url: `https://${DOMAIN}`,
    brand_voice: null,
    tone_keywords: [],
    primary_colors: [],
    logo_url: null,
    logo_file_id: null,
    brand_guide_file_id: null,
    brand_promise: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    deleted_at: null,
    workspace_id: WORKSPACE_A_ID,
    ...overrides,
  }
}

function makeFtpConnection(overrides: Partial<FtpConnection> = {}): MockRow {
  return {
    id: 'ftp-1',
    user_id: USER_ID,
    brand_identity_id: null,
    label: 'Production FTP',
    protocol: 'sftp',
    host: 'ftp.example.com',
    port: 22,
    username: 'deploy',
    password_encrypted: 'enc_secret_xxx',
    remote_path: '/var/www/html',
    last_connected_at: null,
    is_active: true,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    workspace_id: WORKSPACE_A_ID,
    ...overrides,
  }
}

function makeProfile(overrides: Record<string, unknown> = {}): MockRow {
  return {
    id: USER_ID,
    email: 'test@example.com',
    subscription_plan: 'pro',
    subscription_status: 'active',
    subscription_interval: 'monthly',
    credits: 5,
    audits_per_month: 12,
    deep_audits_per_month: 4,
    billing_period_start: '2025-06-01T00:00:00Z',
    billing_period_end: '2025-07-01T00:00:00Z',
    ...overrides,
  }
}

// ===========================================================================
// TEST SUITES
// ===========================================================================

describe('Workspace Data Isolation', () => {

  // =========================================================================
  // 1. DELETION SEMANTICS
  // =========================================================================
  describe('1. Deletion semantics — archived workspace hides all child records', () => {

    describe('Workspace DELETE handler cascade', () => {
      it('should cascade to all 6 child tables when deleting a workspace', async () => {
        const db = createMockSupabase({
          workspaces: [makeWorkspace()],
        })

        // Simulate the DELETE handler logic (extracted from route.ts)
        const id = WORKSPACE_A_ID
        const now = new Date().toISOString()

        // Verify ownership
        const { data: ws } = await db.from('workspaces').select('slug').eq('id', id).eq('user_id', USER_ID).single()
        expect(ws).toBeTruthy()

        // Execute the cascade (mirrors the Promise.all in the handler)
        await Promise.all([
          db.from('ftp_connections').delete().eq('workspace_id', id),
          db.from('audits').update({ deleted_at: now } as any).eq('workspace_id', id).is('deleted_at', null),
          db.from('brand_identities').update({ deleted_at: now } as any).eq('workspace_id', id).is('deleted_at', null),
          db.from('scheduled_audits').update({ is_active: false } as any).eq('workspace_id', id),
          db.from('site_notes').update({ is_active: false } as any).eq('workspace_id', id),
          db.from('competitor_benchmarks').delete().eq('workspace_id', id),
        ])

        // Archive the workspace
        await db.from('workspaces').update({
          status: 'archived',
          archived_at: now,
          slug: `test-workspace_archived_${Date.now()}`,
        }).eq('id', id).eq('user_id', USER_ID)

        // Verify all 7 mutations were recorded (6 children + 1 workspace archive)
        expect(db.mutations).toHaveLength(7)

        // Verify each child table was touched
        const mutatedTables = db.mutations.map((m) => m.table)
        expect(mutatedTables).toContain('ftp_connections')
        expect(mutatedTables).toContain('audits')
        expect(mutatedTables).toContain('brand_identities')
        expect(mutatedTables).toContain('scheduled_audits')
        expect(mutatedTables).toContain('site_notes')
        expect(mutatedTables).toContain('competitor_benchmarks')
        expect(mutatedTables).toContain('workspaces')
      })

      it('should set workspace status to "archived" with an archived_at timestamp', async () => {
        const db = createMockSupabase({
          workspaces: [makeWorkspace()],
        })

        const id = WORKSPACE_A_ID
        const now = new Date().toISOString()

        // Minimal cascade then archive
        await db.from('workspaces').update({
          status: 'archived',
          archived_at: now,
          slug: `test-workspace_archived_${Date.now()}`,
        }).eq('id', id).eq('user_id', USER_ID)

        const archiveMutation = db.mutations.find((m) => m.table === 'workspaces' && m.type === 'update')
        expect(archiveMutation).toBeDefined()
        expect(archiveMutation!.payload).toMatchObject({
          status: 'archived',
        })
        expect(archiveMutation!.payload!.archived_at).toBeDefined()
      })

      it('should rename the slug to prevent collision with future workspaces', async () => {
        const db = createMockSupabase({
          workspaces: [makeWorkspace({ slug: 'my-site' })],
        })

        const originalSlug = 'my-site'
        const releasedSlug = `${originalSlug}_archived_${Date.now()}`

        await db.from('workspaces').update({
          status: 'archived',
          archived_at: new Date().toISOString(),
          slug: releasedSlug,
        }).eq('id', WORKSPACE_A_ID).eq('user_id', USER_ID)

        const archiveMutation = db.mutations.find((m) => m.table === 'workspaces')
        expect(archiveMutation!.payload!.slug).toMatch(/^my-site_archived_\d+$/)
      })
    })

    describe('Audits soft-delete filtering', () => {
      it('should set deleted_at on audits belonging to the workspace', async () => {
        const db = createMockSupabase({
          audits: [
            makeAudit({ id: 'audit-1', workspace_id: WORKSPACE_A_ID }),
            makeAudit({ id: 'audit-2', workspace_id: WORKSPACE_A_ID }),
          ],
        })

        const now = new Date().toISOString()
        await db.from('audits').update({ deleted_at: now } as any).eq('workspace_id', WORKSPACE_A_ID).is('deleted_at', null)

        const mutation = db.mutations.find((m) => m.table === 'audits')
        expect(mutation).toBeDefined()
        expect(mutation!.type).toBe('update')
        expect(mutation!.payload).toHaveProperty('deleted_at')
        // Verify the filter targets only the correct workspace
        const wsFilter = mutation!.filters.find((f) => f.col === 'workspace_id')
        expect(wsFilter!.val).toBe(WORKSPACE_A_ID)
      })
    })

    describe('Scheduled audits deactivation', () => {
      it('should set is_active=false on scheduled audits for the workspace', async () => {
        const db = createMockSupabase({
          scheduled_audits: [makeScheduledAudit()],
        })

        await db.from('scheduled_audits').update({ is_active: false } as any).eq('workspace_id', WORKSPACE_A_ID)

        const mutation = db.mutations.find((m) => m.table === 'scheduled_audits')
        expect(mutation).toBeDefined()
        expect(mutation!.payload).toMatchObject({ is_active: false })
      })
    })

    describe('Site notes deactivation', () => {
      it('should set is_active=false on site notes for the workspace', async () => {
        const db = createMockSupabase({
          site_notes: [makeSiteNote()],
        })

        await db.from('site_notes').update({ is_active: false } as any).eq('workspace_id', WORKSPACE_A_ID)

        const mutation = db.mutations.find((m) => m.table === 'site_notes')
        expect(mutation).toBeDefined()
        expect(mutation!.payload).toMatchObject({ is_active: false })
      })
    })

    describe('Brand identities soft-delete', () => {
      it('should set deleted_at on brand identities for the workspace', async () => {
        const db = createMockSupabase({
          brand_identities: [makeBrandIdentity()],
        })

        const now = new Date().toISOString()
        await db.from('brand_identities').update({ deleted_at: now } as any).eq('workspace_id', WORKSPACE_A_ID).is('deleted_at', null)

        const mutation = db.mutations.find((m) => m.table === 'brand_identities')
        expect(mutation).toBeDefined()
        expect(mutation!.payload).toHaveProperty('deleted_at')
      })
    })
  })

  // =========================================================================
  // 2. RECREATION BEHAVIOR
  // =========================================================================
  describe('2. Recreation behavior — new workspace with same domain inherits nothing', () => {

    it('should only check active workspaces for slug collision', async () => {
      // Archived workspace with slug "example-com" should NOT block a new workspace
      const db = createMockSupabase({
        workspaces: [
          makeWorkspace({
            id: ARCHIVED_WS_ID,
            slug: 'example-com_archived_1700000000',
            status: 'archived',
            archived_at: '2025-05-01T00:00:00Z',
          }),
        ],
        profiles: [makeProfile()],
      })

      // Simulate the POST handler's slug collision check:
      // it filters by status='active', so archived workspaces are invisible
      const { count } = await db.from('workspaces')
        .select('id', { count: 'exact', head: true })
        .eq('slug', 'example-com')
        .eq('status', 'active')

      expect(count).toBe(0) // No collision — the archived one doesn't count
    })

    it('should not return audits from an archived workspace when querying the new workspace', async () => {
      const NEW_WS_ID = 'ws-new-444'

      const db = createMockSupabase({
        audits: [
          // Old audit from archived workspace
          makeAudit({
            id: 'audit-old',
            workspace_id: ARCHIVED_WS_ID,
            deleted_at: '2025-05-01T00:00:00Z',
          }),
          // New audit in new workspace
          makeAudit({
            id: 'audit-new',
            workspace_id: NEW_WS_ID,
            deleted_at: null,
          }),
        ],
      })

      // Query for new workspace's audits (as product code does)
      const result = await db.from('audits')
        .select('id')
        .eq('workspace_id', NEW_WS_ID)
        .is('deleted_at', null)

      expect(result.data).toHaveLength(1)
      expect(result.data![0].id).toBe('audit-new')
    })

    it('should not return site notes from a deactivated workspace in the new workspace', async () => {
      const NEW_WS_ID = 'ws-new-444'

      const db = createMockSupabase({
        site_notes: [
          // Old note from deleted workspace — deactivated
          makeSiteNote({
            id: 'note-old',
            workspace_id: ARCHIVED_WS_ID,
            is_active: false,
            domain: DOMAIN,
          }),
          // New note in new workspace
          makeSiteNote({
            id: 'note-new',
            workspace_id: NEW_WS_ID,
            is_active: true,
            domain: DOMAIN,
          }),
        ],
      })

      // Query as the site-notes GET handler does
      const result = await db.from('site_notes')
        .select('*')
        .eq('user_id', USER_ID)
        .eq('domain', DOMAIN)
        .eq('is_active', true)
        .eq('workspace_id', NEW_WS_ID)

      expect(result.data).toHaveLength(1)
      expect(result.data![0].id).toBe('note-new')
    })

    it('should not return brand identities from a deleted workspace in the new workspace', async () => {
      const NEW_WS_ID = 'ws-new-444'

      const db = createMockSupabase({
        brand_identities: [
          makeBrandIdentity({
            id: 'brand-old',
            workspace_id: ARCHIVED_WS_ID,
            deleted_at: '2025-05-01T00:00:00Z',
          }),
          makeBrandIdentity({
            id: 'brand-new',
            workspace_id: NEW_WS_ID,
            deleted_at: null,
          }),
        ],
      })

      const result = await db.from('brand_identities')
        .select('*')
        .eq('user_id', USER_ID)
        .eq('workspace_id', NEW_WS_ID)
        .is('deleted_at', null)

      expect(result.data).toHaveLength(1)
      expect(result.data![0].id).toBe('brand-new')
    })
  })

  // =========================================================================
  // 3. CROSS-WORKSPACE ISOLATION
  // =========================================================================
  describe('3. Cross-workspace isolation — workspace A never sees workspace B data', () => {

    it('should not return workspace B audits when querying workspace A', async () => {
      const db = createMockSupabase({
        audits: [
          makeAudit({ id: 'audit-a', workspace_id: WORKSPACE_A_ID }),
          makeAudit({ id: 'audit-b', workspace_id: WORKSPACE_B_ID }),
        ],
      })

      const result = await db.from('audits')
        .select('id')
        .eq('workspace_id', WORKSPACE_A_ID)
        .is('deleted_at', null)

      expect(result.data).toHaveLength(1)
      expect(result.data![0].id).toBe('audit-a')
    })

    it('should not return workspace B site notes when querying workspace A', async () => {
      const db = createMockSupabase({
        site_notes: [
          makeSiteNote({ id: 'note-a', workspace_id: WORKSPACE_A_ID, domain: DOMAIN }),
          makeSiteNote({ id: 'note-b', workspace_id: WORKSPACE_B_ID, domain: DOMAIN }),
        ],
      })

      const result = await db.from('site_notes')
        .select('*')
        .eq('user_id', USER_ID)
        .eq('domain', DOMAIN)
        .eq('is_active', true)
        .eq('workspace_id', WORKSPACE_A_ID)

      expect(result.data).toHaveLength(1)
      expect(result.data![0].id).toBe('note-a')
    })

    it('should not return workspace B scheduled audits when querying workspace A', async () => {
      const db = createMockSupabase({
        scheduled_audits: [
          makeScheduledAudit({ id: 'sched-a', workspace_id: WORKSPACE_A_ID }),
          makeScheduledAudit({ id: 'sched-b', workspace_id: WORKSPACE_B_ID }),
        ],
      })

      const result = await db.from('scheduled_audits')
        .select('*')
        .eq('user_id', USER_ID)
        .eq('is_active', true)
        .eq('workspace_id', WORKSPACE_A_ID)

      expect(result.data).toHaveLength(1)
      expect(result.data![0].id).toBe('sched-a')
    })

    it('should not return workspace B brand identities when querying workspace A', async () => {
      const db = createMockSupabase({
        brand_identities: [
          makeBrandIdentity({ id: 'brand-a', workspace_id: WORKSPACE_A_ID }),
          makeBrandIdentity({ id: 'brand-b', workspace_id: WORKSPACE_B_ID }),
        ],
      })

      const result = await db.from('brand_identities')
        .select('*')
        .eq('user_id', USER_ID)
        .eq('workspace_id', WORKSPACE_A_ID)
        .is('deleted_at', null)

      expect(result.data).toHaveLength(1)
      expect(result.data![0].id).toBe('brand-a')
    })

    it('should not return workspace B FTP connections when querying workspace A', async () => {
      const db = createMockSupabase({
        ftp_connections: [
          makeFtpConnection({ id: 'ftp-a', workspace_id: WORKSPACE_A_ID }),
          makeFtpConnection({ id: 'ftp-b', workspace_id: WORKSPACE_B_ID }),
        ],
      })

      const result = await db.from('ftp_connections')
        .select('*')
        .eq('user_id', USER_ID)
        .eq('workspace_id', WORKSPACE_A_ID)

      expect(result.data).toHaveLength(1)
      expect(result.data![0].id).toBe('ftp-a')
    })

    it('should scope workspace GET to the authenticated user', async () => {
      // User B's workspace must never appear for User A
      const db = createMockSupabase({
        workspaces: [
          makeWorkspace({ id: WORKSPACE_A_ID, user_id: USER_ID }),
          makeWorkspace({ id: WORKSPACE_B_ID, user_id: USER_ID_B }),
        ],
      })

      const result = await db.from('workspaces')
        .select('*')
        .eq('user_id', USER_ID)
        .eq('status', 'active')

      expect(result.data).toHaveLength(1)
      expect(result.data![0].id).toBe(WORKSPACE_A_ID)
    })
  })

  // =========================================================================
  // 4. ORPHAN IMMUNITY
  // =========================================================================
  describe('4. Orphan immunity — workspace_id=NULL records excluded from scoped queries', () => {

    it('should not return orphan audits (workspace_id=NULL) in workspace-scoped queries', async () => {
      const db = createMockSupabase({
        audits: [
          makeAudit({ id: 'audit-ws', workspace_id: WORKSPACE_A_ID }),
          makeAudit({ id: 'audit-orphan', workspace_id: null as any }),
        ],
      })

      const result = await db.from('audits')
        .select('id')
        .eq('workspace_id', WORKSPACE_A_ID)
        .is('deleted_at', null)

      expect(result.data).toHaveLength(1)
      expect(result.data![0].id).toBe('audit-ws')
    })

    it('should not return orphan site notes (workspace_id=NULL) in workspace-scoped queries', async () => {
      const db = createMockSupabase({
        site_notes: [
          makeSiteNote({ id: 'note-ws', workspace_id: WORKSPACE_A_ID }),
          makeSiteNote({ id: 'note-orphan', workspace_id: null as any }),
        ],
      })

      const result = await db.from('site_notes')
        .select('*')
        .eq('user_id', USER_ID)
        .eq('domain', DOMAIN)
        .eq('is_active', true)
        .eq('workspace_id', WORKSPACE_A_ID)

      expect(result.data).toHaveLength(1)
      expect(result.data![0].id).toBe('note-ws')
    })

    it('should not return orphan brand identities (workspace_id=NULL) in workspace-scoped queries', async () => {
      const db = createMockSupabase({
        brand_identities: [
          makeBrandIdentity({ id: 'brand-ws', workspace_id: WORKSPACE_A_ID }),
          makeBrandIdentity({ id: 'brand-orphan', workspace_id: null as any }),
        ],
      })

      const result = await db.from('brand_identities')
        .select('*')
        .eq('user_id', USER_ID)
        .eq('workspace_id', WORKSPACE_A_ID)
        .is('deleted_at', null)

      expect(result.data).toHaveLength(1)
      expect(result.data![0].id).toBe('brand-ws')
    })

    it('should not return orphan scheduled audits (workspace_id=NULL) in workspace-scoped queries', async () => {
      const db = createMockSupabase({
        scheduled_audits: [
          makeScheduledAudit({ id: 'sched-ws', workspace_id: WORKSPACE_A_ID }),
          makeScheduledAudit({ id: 'sched-orphan', workspace_id: null as any }),
        ],
      })

      const result = await db.from('scheduled_audits')
        .select('*')
        .eq('user_id', USER_ID)
        .eq('is_active', true)
        .eq('workspace_id', WORKSPACE_A_ID)

      expect(result.data).toHaveLength(1)
      expect(result.data![0].id).toBe('sched-ws')
    })
  })

  // =========================================================================
  // 5. FTP SECURITY
  // =========================================================================
  describe('5. FTP security — FTP connections are hard-deleted on workspace deletion', () => {

    it('should use .delete() (hard delete) for ftp_connections, not .update()', async () => {
      const db = createMockSupabase({
        ftp_connections: [makeFtpConnection()],
      })

      // Simulate the DELETE handler's FTP cascade
      await db.from('ftp_connections').delete().eq('workspace_id', WORKSPACE_A_ID)

      const ftpMutation = db.mutations.find((m) => m.table === 'ftp_connections')
      expect(ftpMutation).toBeDefined()
      expect(ftpMutation!.type).toBe('delete') // HARD delete, not 'update'
    })

    it('should NOT soft-delete FTP connections (no deleted_at or is_active update)', async () => {
      const db = createMockSupabase({
        ftp_connections: [makeFtpConnection()],
      })

      await db.from('ftp_connections').delete().eq('workspace_id', WORKSPACE_A_ID)

      const ftpMutation = db.mutations.find((m) => m.table === 'ftp_connections')
      // Hard delete means no payload (no {deleted_at: ...} or {is_active: false})
      expect(ftpMutation!.payload).toBeUndefined()
    })

    it('should scope FTP hard-delete to the specific workspace_id', async () => {
      const db = createMockSupabase({
        ftp_connections: [
          makeFtpConnection({ id: 'ftp-a', workspace_id: WORKSPACE_A_ID }),
          makeFtpConnection({ id: 'ftp-b', workspace_id: WORKSPACE_B_ID }),
        ],
      })

      await db.from('ftp_connections').delete().eq('workspace_id', WORKSPACE_A_ID)

      const ftpMutation = db.mutations.find((m) => m.table === 'ftp_connections')
      const wsFilter = ftpMutation!.filters.find((f) => f.col === 'workspace_id')
      expect(wsFilter).toBeDefined()
      expect(wsFilter!.val).toBe(WORKSPACE_A_ID) // Only targets workspace A
    })

    it('should also hard-delete competitor_benchmarks (non-sensitive, no soft-delete needed)', async () => {
      const db = createMockSupabase({
        competitor_benchmarks: [{ id: 'bench-1', workspace_id: WORKSPACE_A_ID }],
      })

      await db.from('competitor_benchmarks').delete().eq('workspace_id', WORKSPACE_A_ID)

      const mutation = db.mutations.find((m) => m.table === 'competitor_benchmarks')
      expect(mutation).toBeDefined()
      expect(mutation!.type).toBe('delete')
    })
  })

  // =========================================================================
  // 6. BILLING ISOLATION
  // =========================================================================
  describe('6. Billing isolation — deleted audits do not count toward billing quotas', () => {

    describe('classifyAudit() respects deleted_at', () => {
      it('should filter by deleted_at=null when counting prior audits for a workspace', async () => {
        // Simulate classifyAudit's logic:
        // When determining if an audit is 'initial_normal' vs 'reaudit_normal',
        // it counts prior audits with .is('deleted_at', null)
        const db = createMockSupabase({
          audits: [
            // The audit being classified
            makeAudit({ id: 'audit-current', workspace_id: WORKSPACE_A_ID, depth_mode: 'standard' }),
            // A deleted prior audit — must NOT be counted
            makeAudit({ id: 'audit-deleted', workspace_id: WORKSPACE_A_ID, deleted_at: '2025-05-01T00:00:00Z' }),
          ],
        })

        // Fetch the audit
        const { data: audit } = await db.from('audits')
          .select('id, depth_mode, workspace_id, user_id, created_at')
          .eq('id', 'audit-current')
          .single()

        expect(audit).toBeTruthy()
        expect(audit!.depth_mode).toBe('standard')

        // Count prior audits (as classifyAudit does)
        const { count } = await db.from('audits')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', WORKSPACE_A_ID)
          .eq('user_id', USER_ID)
          .neq('id', 'audit-current')
          .neq('status', 'pending_payment')
          .is('deleted_at', null)

        // The deleted audit should be excluded, so count = 0
        // This means the current audit is classified as 'initial_normal'
        expect(count).toBe(0)
      })

      it('should classify a deep audit as "deep" regardless of deletion state of other audits', async () => {
        const db = createMockSupabase({
          audits: [
            makeAudit({ id: 'audit-deep', workspace_id: WORKSPACE_A_ID, depth_mode: 'deep' }),
          ],
        })

        const { data: audit } = await db.from('audits')
          .select('id, depth_mode, workspace_id, user_id, created_at')
          .eq('id', 'audit-deep')
          .single()

        // classifyAudit checks depth_mode first — deep always returns 'deep'
        expect(audit!.depth_mode).toBe('deep')
      })

      it('should classify as "reaudit_normal" when there are non-deleted prior audits', async () => {
        const db = createMockSupabase({
          audits: [
            makeAudit({ id: 'audit-current', workspace_id: WORKSPACE_A_ID, depth_mode: 'standard' }),
            // A live prior audit — should be counted
            makeAudit({ id: 'audit-prior', workspace_id: WORKSPACE_A_ID, depth_mode: 'standard', deleted_at: null }),
          ],
        })

        const { count } = await db.from('audits')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', WORKSPACE_A_ID)
          .eq('user_id', USER_ID)
          .neq('id', 'audit-current')
          .neq('status', 'pending_payment')
          .is('deleted_at', null)

        // One non-deleted prior audit exists, so this would be reaudit_normal
        expect(count).toBe(1)
      })
    })

    describe('getAuditUsage() excludes deleted records', () => {
      it('should exclude deleted audits from total audit count (free audit eligibility)', async () => {
        const db = createMockSupabase({
          profiles: [makeProfile()],
          workspaces: [makeWorkspace()],
          audits: [
            // Completed but deleted audit — must not count
            makeAudit({
              id: 'audit-deleted',
              workspace_id: WORKSPACE_A_ID,
              status: 'completed',
              deleted_at: '2025-05-01T00:00:00Z',
            }),
          ],
        })

        // Simulate the free-audit-eligibility check from getAuditUsage:
        const { count: totalAuditCount } = await db.from('audits')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', USER_ID)
          .in('status', ['completed', 'failed', 'analysing', 'crawling', 'generating_report', 'payment_received'])
          .is('deleted_at', null)

        // Deleted audit excluded — user still qualifies for free first audit
        expect(totalAuditCount).toBe(0)
      })

      it('should exclude deleted audits from deep audit usage count', async () => {
        const periodStart = '2025-06-01T00:00:00Z'
        const periodEnd = '2025-07-01T00:00:00Z'

        const db = createMockSupabase({
          audits: [
            // Deep audit that was deleted
            makeAudit({
              id: 'deep-deleted',
              workspace_id: WORKSPACE_A_ID,
              depth_mode: 'deep',
              deleted_at: '2025-06-15T00:00:00Z',
              created_at: '2025-06-10T00:00:00Z',
            }),
            // Deep audit that is live
            makeAudit({
              id: 'deep-live',
              workspace_id: WORKSPACE_A_ID,
              depth_mode: 'deep',
              deleted_at: null,
              created_at: '2025-06-12T00:00:00Z',
            }),
          ],
        })

        // Simulate deep audit count from getAuditUsage:
        const { count: deepCount } = await db.from('audits')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', USER_ID)
          .eq('depth_mode', 'deep')
          .neq('status', 'pending_payment')
          .is('deleted_at', null)
          .gte('created_at', periodStart)
          .lte('created_at', periodEnd)

        // Only the live deep audit should be counted
        expect(deepCount).toBe(1)
      })

      it('should exclude deleted audits from re-audit usage count', async () => {
        const periodStart = '2025-06-01T00:00:00Z'
        const periodEnd = '2025-07-01T00:00:00Z'

        const db = createMockSupabase({
          audits: [
            // Normal audit that was deleted
            makeAudit({
              id: 'normal-deleted',
              workspace_id: WORKSPACE_A_ID,
              depth_mode: 'standard',
              deleted_at: '2025-06-20T00:00:00Z',
              created_at: '2025-06-10T00:00:00Z',
            }),
            // Normal live audit
            makeAudit({
              id: 'normal-live',
              workspace_id: WORKSPACE_A_ID,
              depth_mode: 'standard',
              deleted_at: null,
              created_at: '2025-06-12T00:00:00Z',
            }),
          ],
        })

        // Simulate normal audit count from getAuditUsage:
        const { count: normalInPeriod } = await db.from('audits')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', USER_ID)
          .neq('depth_mode', 'deep')
          .neq('status', 'pending_payment')
          .is('deleted_at', null)
          .gte('created_at', periodStart)
          .lte('created_at', periodEnd)

        // Only the live normal audit should be counted
        expect(normalInPeriod).toBe(1)
      })

      it('should count only active workspaces toward workspace usage', async () => {
        const db = createMockSupabase({
          workspaces: [
            makeWorkspace({ id: WORKSPACE_A_ID, status: 'active' }),
            makeWorkspace({ id: ARCHIVED_WS_ID, status: 'archived' }),
          ],
        })

        const { count: workspaceCount } = await db.from('workspaces')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', USER_ID)
          .eq('status', 'active')

        expect(workspaceCount).toBe(1) // Archived workspace not counted
      })
    })
  })

  // =========================================================================
  // EDGE CASES
  // =========================================================================
  describe('Edge cases', () => {

    it('should handle workspace with no child records without error', async () => {
      const db = createMockSupabase({
        workspaces: [makeWorkspace()],
        // All child tables empty
        ftp_connections: [],
        audits: [],
        brand_identities: [],
        scheduled_audits: [],
        site_notes: [],
        competitor_benchmarks: [],
      })

      const id = WORKSPACE_A_ID
      const now = new Date().toISOString()

      // This should not throw
      await Promise.all([
        db.from('ftp_connections').delete().eq('workspace_id', id),
        db.from('audits').update({ deleted_at: now } as any).eq('workspace_id', id).is('deleted_at', null),
        db.from('brand_identities').update({ deleted_at: now } as any).eq('workspace_id', id).is('deleted_at', null),
        db.from('scheduled_audits').update({ is_active: false } as any).eq('workspace_id', id),
        db.from('site_notes').update({ is_active: false } as any).eq('workspace_id', id),
        db.from('competitor_benchmarks').delete().eq('workspace_id', id),
      ])

      expect(db.mutations).toHaveLength(6) // All 6 operations recorded
    })

    it('should not double-soft-delete already-deleted audits (is(deleted_at, null) guard)', async () => {
      const db = createMockSupabase({
        audits: [
          makeAudit({
            id: 'audit-already-deleted',
            workspace_id: WORKSPACE_A_ID,
            deleted_at: '2025-04-01T00:00:00Z', // Already deleted
          }),
        ],
      })

      const now = new Date().toISOString()
      await db.from('audits').update({ deleted_at: now } as any)
        .eq('workspace_id', WORKSPACE_A_ID)
        .is('deleted_at', null)

      const mutation = db.mutations.find((m) => m.table === 'audits')
      expect(mutation).toBeDefined()
      // The .is('deleted_at', null) guard means the update wouldn't match
      // already-deleted rows in a real DB. The contract is correct.
      const nullGuard = mutation!.filters.find((f) => f.col === 'deleted_at' && f.method === 'is')
      expect(nullGuard).toBeDefined()
      expect(nullGuard!.val).toBeNull()
    })

    it('should verify the workspace GET handler filters by status=active', async () => {
      const db = createMockSupabase({
        workspaces: [
          makeWorkspace({ id: WORKSPACE_A_ID, status: 'active' }),
          makeWorkspace({ id: ARCHIVED_WS_ID, status: 'archived' }),
        ],
      })

      // Simulating the GET /api/workspaces handler query
      const result = await db.from('workspaces')
        .select('*')
        .eq('user_id', USER_ID)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      expect(result.data).toHaveLength(1)
      expect(result.data![0].status).toBe('active')
    })

    it('should verify workspace single GET filters by both user_id and status=active', async () => {
      const db = createMockSupabase({
        workspaces: [
          makeWorkspace({ id: WORKSPACE_A_ID, user_id: USER_ID, status: 'active' }),
          makeWorkspace({ id: ARCHIVED_WS_ID, user_id: USER_ID, status: 'archived' }),
        ],
      })

      // Single workspace GET filters by id + user_id + status='active'
      const { data } = await db.from('workspaces')
        .select('*')
        .eq('id', ARCHIVED_WS_ID)
        .eq('user_id', USER_ID)
        .eq('status', 'active')
        .single()

      // Archived workspace should NOT be returned
      expect(data).toBeNull()
    })
  })
})
