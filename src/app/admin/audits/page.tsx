'use client'

import { useEffect, useState, useCallback } from 'react'
import { Search, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'

interface AdminAudit {
  id: string
  user_id: string
  user_display: string
  status: string
  product_url: string
  product_type: string
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
    completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    failed: 'bg-red-500/10 text-red-600 dark:text-red-400',
  }

  const getScore = (audit: AdminAudit) => {
    const reports = audit.reports
    if (!reports || reports.length === 0) return null
    return reports[0]?.overall_score ?? null
  }

  const scoreColor = (score: number | null) => {
    if (score === null) return 'text-muted'
    if (score >= 80) return 'text-emerald-500'
    if (score >= 60) return 'text-amber-500'
    return 'text-red-500'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading font-semibold text-2xl text-text">Audits</h1>
        <p className="text-sm text-muted mt-1">{total} total audits</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by URL..."
              className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm text-text placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-surface-alt border border-border rounded-lg text-sm text-text font-medium hover:bg-card transition-colors"
          >
            Search
          </button>
        </form>

        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 bg-card border border-border rounded-lg text-sm text-text focus:outline-none focus:ring-2 focus:ring-violet-500/30"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-[11px] font-semibold text-muted uppercase tracking-wider">URL</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-muted uppercase tracking-wider">User</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-muted uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-muted uppercase tracking-wider">Score</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-muted uppercase tracking-wider">Pages</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-muted uppercase tracking-wider">Created</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-muted uppercase tracking-wider">Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-surface-alt rounded w-20" /></td>
                    ))}
                  </tr>
                ))
              ) : audits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted">No audits found</td>
                </tr>
              ) : (
                audits.map((a) => {
                  const score = getScore(a)
                  let hostname = a.product_url
                  try { hostname = new URL(a.product_url).hostname } catch {}

                  return (
                    <tr key={a.id} className="hover:bg-surface-alt/40 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-[13px] text-text font-medium truncate max-w-[180px]">{hostname}</p>
                        <p className="text-[11px] text-muted truncate max-w-[180px]">{a.product_type}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[12px] text-text truncate max-w-[150px]">{a.user_display}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${statusColors[a.status] || 'bg-surface-alt text-muted'}`}>
                          {a.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[13px] font-bold tabular-nums ${scoreColor(score)}`}>
                          {score !== null ? `${score}/100` : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[13px] text-text tabular-nums">{a.pages_crawled}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[12px] text-muted">{new Date(a.created_at).toLocaleDateString()}</span>
                      </td>
                      <td className="px-4 py-3">
                        {a.status === 'completed' && (
                          <a
                            href={`/dashboard/audits/${a.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg hover:bg-violet-500/10 text-muted hover:text-violet-500 transition-colors inline-flex"
                            title="View audit"
                          >
                            <ExternalLink size={14} />
                          </a>
                        )}
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
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-[12px] text-muted">Page {page} of {totalPages}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-surface-alt text-muted disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg hover:bg-surface-alt text-muted disabled:opacity-30 transition-colors"
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
