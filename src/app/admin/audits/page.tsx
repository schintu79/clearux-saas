'use client'

import { useEffect, useState, useCallback } from 'react'
import { Search, ChevronLeft, ChevronRight, ExternalLink, Globe, Palette, Layers } from 'lucide-react'

interface AdminAudit {
  id: string
  user_id: string
  user_display: string
  status: string
  product_url: string
  product_type: string
  audit_type: 'website' | 'brand_identity' | 'design' | null
  plan: string | null
  pages_crawled: number
  created_at: string
  completed_at: string | null
  reports: Array<{ overall_score: number | null; total_issues: number | null; critical_count: number | null }> | null
}

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending_payment', label: 'Pending Payment' },
  { value: 'payment_received', label: 'Payment Received' },
  { value: 'crawling', label: 'Crawling' },
  { value: 'analysing', label: 'Analysing' },
  { value: 'generating_report', label: 'Generating Report' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
]

export default function AdminAuditsPage() {
  const [audits, setAudits] = useState<AdminAudit[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchAudits = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (search) params.set('search', search)
    if (statusFilter) params.set('status', statusFilter)

    fetch(`/api/admin/audits?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setAudits(d.audits || [])
        setTotal(d.total || 0)
        setTotalPages(d.totalPages || 1)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page, search, statusFilter])

  useEffect(() => { fetchAudits() }, [fetchAudits])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    setSearch(searchInput)
  }

  const statusColors: Record<string, string> = {
    pending_payment: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
    payment_received: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    crawling: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    analysing: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    generating_report: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    completed: 'bg-[var(--ok)]/10 text-[var(--ok)]',
    failed: 'bg-[var(--severe)]/10 text-[var(--severe)]',
  }

  const getScore = (audit: AdminAudit) => {
    const reports = audit.reports
    if (!reports || reports.length === 0) return null
    return reports[0]?.overall_score ?? null
  }

  const scoreColor = (score: number | null) => {
    if (score === null) return 'text-[var(--m-muted)]'
    if (score >= 70) return 'text-[var(--ok)]'
    if (score >= 40) return 'text-[var(--warn)]'
    return 'text-[var(--severe)]'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-medium font-sans" style={{ color: 'var(--ink)' }}>Audits</h1>
        <p className="font-mono text-[10px] tracking-[0.1em] uppercase mt-1" style={{ color: 'var(--m-muted-2)' }}>{total} total audits</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--m-muted)]" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by URL..."
              className="w-full pl-9 pr-4 py-2 rounded-lg text-sm text-[var(--ink)] placeholder:text-[var(--m-muted)]/50 focus:outline-none focus:ring-2"
            style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }}
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'var(--paper)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
          >
            Search
          </button>
        </form>

        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 rounded-lg text-sm text-[var(--ink)] focus:outline-none focus:ring-2"
          style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--rule)]">
                <th className="px-4 py-3 text-[11px] font-medium text-[var(--m-muted)] uppercase tracking-wider">URL</th>
                <th className="px-4 py-3 text-[11px] font-medium text-[var(--m-muted)] uppercase tracking-wider">User</th>
                <th className="px-4 py-3 text-[11px] font-medium text-[var(--m-muted)] uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-[11px] font-medium text-[var(--m-muted)] uppercase tracking-wider">Score</th>
                <th className="px-4 py-3 text-[11px] font-medium text-[var(--m-muted)] uppercase tracking-wider">Pages</th>
                <th className="px-4 py-3 text-[11px] font-medium text-[var(--m-muted)] uppercase tracking-wider">Created</th>
                <th className="px-4 py-3 text-[11px] font-medium text-[var(--m-muted)] uppercase tracking-wider">Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-[var(--paper-2)] rounded w-20" /></td>
                    ))}
                  </tr>
                ))
              ) : audits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-[var(--m-muted)]">No audits found</td>
                </tr>
              ) : (
                audits.map((a) => {
                  const score = getScore(a)
                  let hostname = a.product_url
                  try { hostname = new URL(a.product_url).hostname } catch {}

                  return (
                    <tr key={a.id} className="hover:bg-black/[0.04]/40 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-[13px] text-[var(--ink)] font-medium truncate max-w-[180px]">{hostname}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {a.audit_type === 'brand_identity' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-purple-600 dark:text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded-full">
                              <Palette size={9} /> Brand
                            </span>
                          ) : a.audit_type === 'design' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-full">
                              <Layers size={9} /> Design
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                              <Globe size={9} /> Website
                            </span>
                          )}
                          <span className="text-[11px] text-[var(--m-muted)] truncate max-w-[120px]">{a.product_type}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[12px] text-[var(--ink)] truncate max-w-[150px]">{a.user_display}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${statusColors[a.status] || 'bg-[var(--paper-2)] text-[var(--m-muted)]'}`}>
                          {a.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[13px] font-medium tabular-nums ${scoreColor(score)}`}>
                          {score !== null ? `${score}/100` : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[13px] text-[var(--ink)] tabular-nums">{a.pages_crawled}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[12px] text-[var(--m-muted)]">{new Date(a.created_at).toLocaleDateString()}</span>
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={`/admin/audits/${a.id}`}
                          className="p-1.5 rounded-lg text-[var(--m-muted)] transition-colors inline-flex"
                          style={{ '--hover-bg': 'var(--ink)' } as React.CSSProperties}
                          title="View audit"
                        >
                          <ExternalLink size={14} />
                        </a>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--rule)]">
            <span className="text-[12px] text-[var(--m-muted)]">Page {page} of {totalPages}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-black/[0.04] text-[var(--m-muted)] disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg hover:bg-black/[0.04] text-[var(--m-muted)] disabled:opacity-30 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
