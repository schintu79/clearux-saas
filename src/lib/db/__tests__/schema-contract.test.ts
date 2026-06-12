// ============================================================
// Schema contract tests (Plan §0.3)
// ============================================================
// Acceptance criterion: re-introducing the viewport-column bug
// class FAILS CI before deploy. Every insert/update payload key
// the codebase writes must exist as a column in the live-schema
// snapshot. Eight June 2026 incidents are pinned below by name.

import {
  INSERT_CONTRACTS,
  UPDATE_CONTRACTS,
  snapshotColumns,
  snapshotRequired,
  filterRowsToContract,
} from '../insert-contracts'
import snapshot from '../schema-snapshot.json'

const insertTables = Object.keys(INSERT_CONTRACTS) as Array<keyof typeof INSERT_CONTRACTS>
const updateTables = Object.keys(UPDATE_CONTRACTS) as Array<keyof typeof UPDATE_CONTRACTS>

describe('snapshot integrity', () => {
  it('covers every contracted table', () => {
    for (const table of [...insertTables, ...updateTables]) {
      expect(snapshotColumns(table).length).toBeGreaterThan(0)
    }
  })
  it('snapshot metadata names the refresh procedure', () => {
    expect((snapshot as any)._meta.description).toContain('schema-snapshot.sql')
  })
})

describe('INSERT contracts ⊆ live schema (the viewport-class firewall)', () => {
  it.each(insertTables)('%s: every contract key is a real column', (table) => {
    const columns = new Set(snapshotColumns(table))
    const missing = INSERT_CONTRACTS[table].filter((k) => !columns.has(k))
    // If this fails: a payload key was added without a migration —
    // write the migration, apply it live, refresh schema-snapshot.json
    // (scripts/schema-snapshot.sql) in the SAME commit.
    expect(missing).toEqual([])
  })

  it.each(insertTables)('%s: every NOT NULL column without default is in the contract', (table) => {
    const contract = new Set<string>(INSERT_CONTRACTS[table])
    const absent = snapshotRequired(table).filter((k) => !contract.has(k))
    // If this fails: the DB demands a column our writers never send —
    // every insert into this table is being rejected.
    expect(absent).toEqual([])
  })
})

describe('UPDATE contracts ⊆ live schema', () => {
  it.each(updateTables)('%s: every update key is a real column', (table) => {
    const columns = new Set(snapshotColumns(table))
    const missing = UPDATE_CONTRACTS[table].filter((k) => !columns.has(k))
    expect(missing).toEqual([])
  })
})

describe('REGRESSION pins — June 2026 silent-write incidents', () => {
  it('2026-06-10 viewport: audit_findings.viewport exists and is contracted (3 days of fabricated scores)', () => {
    expect(snapshotColumns('audit_findings')).toContain('viewport')
    expect(INSERT_CONTRACTS.audit_findings).toContain('viewport')
  })
  it('2026-06-10 question_text_snapshot: the column is the snapshot name, not question_text', () => {
    expect(snapshotColumns('workspace_ai_interrogations')).toContain('question_text_snapshot')
    expect(snapshotColumns('workspace_ai_interrogations')).not.toContain('question_text')
  })
  it('2026-06-10 accuracy grades: persisted columns exist on interrogation results', () => {
    expect(snapshotColumns('workspace_ai_interrogation_results')).toEqual(
      expect.arrayContaining(['accuracy', 'accuracy_note']),
    )
  })
  it('2026-06-11 excluded_from_score: per-page exclusion column exists', () => {
    expect(snapshotColumns('audit_pages')).toContain('excluded_from_score')
  })
  it('2026-06-12 pagespeed: `category` and `position` are NOT audit_findings columns — payloads must use category_index/sort_order', () => {
    const cols = snapshotColumns('audit_findings')
    expect(cols).not.toContain('category')
    expect(cols).not.toContain('position')
    expect(INSERT_CONTRACTS.audit_findings).not.toContain('category' as never)
    expect(INSERT_CONTRACTS.audit_findings).not.toContain('position' as never)
  })
  it('2026-06-12 WCAG/code-quality: audit_pages columns exist for wcag_checklist, wcag_score, code_quality', () => {
    expect(snapshotColumns('audit_pages')).toEqual(
      expect.arrayContaining(['wcag_checklist', 'wcag_score', 'code_quality']),
    )
    expect(UPDATE_CONTRACTS.audit_pages).toEqual(
      expect.arrayContaining(['wcag_checklist', 'wcag_score']),
    )
  })
})

describe('filterRowsToContract — runtime strip net', () => {
  it('SIMULATED viewport-class bug: unknown key is stripped and reported, batch survives', () => {
    const rows = [
      { audit_id: 'a', severity: 'high', title: 't', description: 'd', recommendation: 'r', not_a_column: 'x' },
      { audit_id: 'a', severity: 'low', title: 't2', description: 'd2', recommendation: 'r2', not_a_column: 'y' },
    ]
    const { rows: filtered, unknownKeys } = filterRowsToContract('audit_findings', rows as any)
    expect(unknownKeys).toEqual(['not_a_column'])
    expect(filtered).toHaveLength(2)
    expect(Object.keys(filtered[0])).not.toContain('not_a_column')
    expect(filtered[0]).toMatchObject({ audit_id: 'a', severity: 'high', title: 't' })
  })
  it('clean payloads pass through untouched', () => {
    const rows = [{ audit_id: 'a', url: 'https://x.io', title: 'Home' }]
    const { rows: filtered, unknownKeys } = filterRowsToContract('audit_pages', rows as any)
    expect(unknownKeys).toEqual([])
    expect(filtered[0]).toEqual(rows[0])
  })
  it('preserves null and false values (stripping must not become a sanitizer)', () => {
    const rows = [{ audit_id: 'a', event: 'x', status: null, message: '', metadata: false }]
    const { rows: filtered } = filterRowsToContract('audit_logs', rows as any)
    expect(filtered[0]).toEqual({ audit_id: 'a', event: 'x', status: null, message: '', metadata: false })
  })
})
