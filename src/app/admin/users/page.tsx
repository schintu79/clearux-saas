'use client'

import { useEffect, useState, useCallback } from 'react'
import { Search, ChevronLeft, ChevronRight, Plus, Minus, X, Settings2 } from 'lucide-react'

interface User {
  id: string
  email: string
  full_name: string | null
  company: string | null
  credits: number
  audit_count: number
  package_tier: string
  subscription_plan: string | null
  subscription_status: string | null
  free_membership: boolean
  free_membership_expiry: string | null
  role: string
  white_label: boolean
  created_at: string
  updated_at: string
}

interface CreditModal {
  user: User
  amount: string
  reason: string
  type: 'add' | 'remove'
}

interface PlanModal {
  user: User
  plan: string
  credits: string
  freeMembership: boolean
  expiryDate: string
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [creditModal, setCreditModal] = useState<CreditModal | null>(null)
  const [planModal, setPlanModal] = useState<PlanModal | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const fetchUsers = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (search) params.set('search', search)

    fetch(`/api/admin/users?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setUsers(d.users || [])
        setTotal(d.total || 0)
        setTotalPages(d.totalPages || 1)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page, search])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    setSearch(searchInput)
  }

  const handleCreditSubmit = async () => {
    if (!creditModal) return
    const amount = parseInt(creditModal.amount, 10)
    if (isNaN(amount) || amount <= 0) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: creditModal.user.id,
          amount: creditModal.type === 'remove' ? -amount : amount,
          reason: creditModal.reason || `Admin ${creditModal.type}`,
        }),
      })
      if (res.ok) {
        setCreditModal(null)
        fetchUsers()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  const handlePlanSubmit = async () => {
    if (!planModal) return
    setSubmitting(true)
    try {
      const body: Record<string, any> = { user_id: planModal.user.id }
      if (planModal.plan) body.subscription_plan = planModal.plan === 'none' ? null : planModal.plan
      if (planModal.credits) body.credits = parseInt(planModal.credits, 10)
      body.free_membership = planModal.freeMembership
      if (planModal.expiryDate) body.expiry_date = planModal.expiryDate
      else body.expiry_date = null

      const res = await fetch('/api/admin/users/plan', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setPlanModal(null)
        fetchUsers()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  const tierColors: Record<string, string> = {
    starter: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
    growth: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    agency: 'bg-[#6366F1]/10 text-[#6366F1]',
    scale: 'bg-[var(--ok)]/10 text-[var(--ok)]',
  }

  const roleColors: Record<string, string> = {
    user: '',
    admin: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    super_admin: 'bg-[var(--severe)]/10 text-[var(--severe)]',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-medium font-sans" style={{ color: 'var(--ink)' }}>Users</h1>
        <p className="font-mono text-[10px] tracking-[0.1em] uppercase mt-1" style={{ color: 'var(--m-muted-2)' }}>{total} total users</p>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by email, name, or company..."
            className="w-full pl-9 pr-4 py-2 rounded-lg text-sm text-text placeholder:text-muted/50 focus:outline-none focus:ring-2"
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

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-[11px] font-medium text-muted uppercase tracking-wider">User</th>
                <th className="px-4 py-3 text-[11px] font-medium text-muted uppercase tracking-wider">Credits</th>
                <th className="px-4 py-3 text-[11px] font-medium text-muted uppercase tracking-wider">Audits</th>
                <th className="px-4 py-3 text-[11px] font-medium text-muted uppercase tracking-wider">Tier</th>
                <th className="px-4 py-3 text-[11px] font-medium text-muted uppercase tracking-wider">Role</th>
                <th className="px-4 py-3 text-[11px] font-medium text-muted uppercase tracking-wider">Joined</th>
                <th className="px-4 py-3 text-[11px] font-medium text-muted uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-surface-alt rounded w-24" /></td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted">No users found</td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-surface-alt/40 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-[13px] text-text font-medium truncate max-w-[200px]">{u.full_name || '—'}</p>
                      <p className="text-[11px] text-muted truncate max-w-[200px]">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[13px] font-medium tabular-nums" style={{ color: 'var(--ok)' }}>{u.credits}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[13px] text-text tabular-nums">{u.audit_count}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${tierColors[u.package_tier] || tierColors.starter}`}>
                        {u.package_tier || 'starter'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.role !== 'user' && (
                        <span className={`inline-block text-[10px] font-medium uppercase px-2 py-0.5 rounded-full ${roleColors[u.role] || ''}`}>
                          {u.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[12px] text-muted">{new Date(u.created_at).toLocaleDateString()}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setCreditModal({ user: u, amount: '', reason: '', type: 'add' })}
                          className="p-1.5 rounded-lg hover:bg-[var(--ok)]/10 text-muted transition-colors"
                          style={{ '--hover-color': 'var(--ok)' } as React.CSSProperties}
                          title="Add credits"
                        >
                          <Plus size={14} />
                        </button>
                        <button
                          onClick={() => setCreditModal({ user: u, amount: '', reason: '', type: 'remove' })}
                          className="p-1.5 rounded-lg hover:bg-[var(--severe)]/10 text-muted transition-colors"
                          title="Remove credits"
                        >
                          <Minus size={14} />
                        </button>
                        <button
                          onClick={() => setPlanModal({
                            user: u,
                            plan: u.subscription_plan || 'none',
                            credits: String(u.credits),
                            freeMembership: u.free_membership || false,
                            expiryDate: u.free_membership_expiry || '',
                          })}
                          className="p-1.5 rounded-lg hover:bg-[var(--signal)]/10 text-muted transition-colors"
                          title="Manage plan"
                        >
                          <Settings2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
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

      {/* Credit adjustment modal */}
      {creditModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setCreditModal(null)}>
          <div className="rounded-2xl shadow-2xl w-full max-w-md p-6" style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-sans font-normal text-lg" style={{ color: 'var(--ink)' }}>
                {creditModal.type === 'add' ? 'Add Credits' : 'Remove Credits'}
              </h3>
              <button onClick={() => setCreditModal(null)} className="p-1 rounded-lg hover:bg-surface-alt transition-colors">
                <X size={18} className="text-muted" />
              </button>
            </div>

            <p className="text-sm text-muted mb-4">
              {creditModal.type === 'add' ? 'Adding credits to' : 'Removing credits from'}{' '}
              <span className="font-medium text-text">{creditModal.user.full_name || creditModal.user.email}</span>
              <br />
              <span className="text-[12px]">Current balance: <span className="font-medium" style={{ color: 'var(--ok)' }}>{creditModal.user.credits}</span></span>
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[12px] font-medium text-text block mb-1">Amount</label>
                <input
                  type="number"
                  min="1"
                  value={creditModal.amount}
                  onChange={(e) => setCreditModal({ ...creditModal, amount: e.target.value })}
                  placeholder="Enter amount..."
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-brand/30"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-[12px] font-medium text-text block mb-1">Reason (optional)</label>
                <input
                  type="text"
                  value={creditModal.reason}
                  onChange={(e) => setCreditModal({ ...creditModal, reason: e.target.value })}
                  placeholder="e.g. Bonus, refund, correction..."
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => setCreditModal(null)}
                className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium text-text hover:bg-surface-alt transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreditSubmit}
                disabled={submitting || !creditModal.amount || parseInt(creditModal.amount) <= 0}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-40"
                style={{ background: creditModal.type === 'add' ? 'var(--ok)' : 'var(--severe)' }}
              >
                {submitting ? 'Processing...' : creditModal.type === 'add' ? 'Add Credits' : 'Remove Credits'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Plan override modal */}
      {planModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setPlanModal(null)}>
          <div className="rounded-2xl shadow-2xl w-full max-w-md p-6" style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-medium font-sans" style={{ color: 'var(--ink)' }}>
                Manage plan
              </h3>
              <button onClick={() => setPlanModal(null)} className="p-1 rounded-lg hover:bg-surface-alt transition-colors">
                <X size={18} className="text-muted" />
              </button>
            </div>

            <p className="text-sm text-muted mb-5">
              Overriding plan for{' '}
              <span className="font-medium text-text">{planModal.user.full_name || planModal.user.email}</span>
            </p>

            <div className="space-y-4">
              {/* Plan tier */}
              <div>
                <label className="text-[12px] font-medium text-text block mb-1.5">Subscription plan</label>
                <select
                  value={planModal.plan}
                  onChange={(e) => setPlanModal({ ...planModal, plan: e.target.value })}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text focus:outline-none focus:ring-2 focus:ring-brand/30"
                >
                  <option value="none">No plan</option>
                  <option value="starter">Starter (3 audits/mo)</option>
                  <option value="pro">Pro (10 audits/mo)</option>
                  <option value="agency">Agency (30 audits/mo)</option>
                </select>
              </div>

              {/* Credits */}
              <div>
                <label className="text-[12px] font-medium text-text block mb-1.5">Credits balance</label>
                <input
                  type="number"
                  min="0"
                  value={planModal.credits}
                  onChange={(e) => setPlanModal({ ...planModal, credits: e.target.value })}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </div>

              {/* Free membership toggle */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <label className="text-[12px] font-medium text-text block">Free membership</label>
                  <p className="text-[11px] text-muted mt-0.5">Grant free access without payment</p>
                </div>
                <button
                  onClick={() => setPlanModal({ ...planModal, freeMembership: !planModal.freeMembership })}
                  className="relative w-10 h-5 rounded-full transition-colors"
                  style={{ background: planModal.freeMembership ? 'var(--ok)' : 'var(--paper-3)' }}
                >
                  <span
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform"
                    style={{ left: planModal.freeMembership ? '22px' : '2px' }}
                  />
                </button>
              </div>

              {/* Expiry date */}
              {planModal.freeMembership && (
                <div>
                  <label className="text-[12px] font-medium text-text block mb-1.5">Expiry date (optional)</label>
                  <input
                    type="date"
                    value={planModal.expiryDate}
                    onChange={(e) => setPlanModal({ ...planModal, expiryDate: e.target.value })}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text focus:outline-none focus:ring-2 focus:ring-brand/30"
                  />
                  <p className="text-[11px] text-muted mt-1">Leave empty for no expiry</p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => setPlanModal(null)}
                className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium text-text hover:bg-surface-alt transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePlanSubmit}
                disabled={submitting}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-40"
                style={{ background: 'var(--ink)' }}
              >
                {submitting ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
