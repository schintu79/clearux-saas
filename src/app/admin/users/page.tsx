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
  audits_remaining: number
  audits_per_month: number
  workspace_count: number
  free_membership: boolean
  free_membership_expiry: string | null
  // Admin quota overrides (null = use plan default)
  max_active_workspaces: number | null
  workspace_creations_per_cycle: number | null
  reaudits_per_cycle: number | null
  deep_audits_per_cycle: number | null
  brand_ai_requests_per_cycle: number | null
  role: string
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
  aiChecksPerMonth: string
  freeMembership: boolean
  expiryDate: string
  // Quota overrides — empty string = use plan default, number = override
  maxActiveWorkspaces: string
  workspaceCreationsPerCycle: string
  reauditsPerCycle: string
  deepAuditsPerCycle: string
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

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
    setErrorMsg(null)
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
      } else {
        const data = await res.json().catch(() => ({}))
        setErrorMsg(data.error || 'Failed to update credits')
      }
    } catch (err) {
      console.error(err)
      setErrorMsg('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  const handlePlanSubmit = async () => {
    if (!planModal) return
    setSubmitting(true)
    setErrorMsg(null)
    try {
      const body: Record<string, any> = { user_id: planModal.user.id }
      if (planModal.plan) body.subscription_plan = planModal.plan === 'none' ? null : planModal.plan
      if (planModal.credits) body.credits = parseInt(planModal.credits, 10)
      if (planModal.aiChecksPerMonth) body.ai_checks_per_month = parseInt(planModal.aiChecksPerMonth, 10)
      body.free_membership = planModal.freeMembership
      if (planModal.expiryDate) body.expiry_date = planModal.expiryDate
      else body.expiry_date = null

      // Quota overrides — empty string = clear override (null), number = set override
      body.max_active_workspaces = planModal.maxActiveWorkspaces ? parseInt(planModal.maxActiveWorkspaces, 10) : null
      body.workspace_creations_per_cycle = planModal.workspaceCreationsPerCycle ? parseInt(planModal.workspaceCreationsPerCycle, 10) : null
      body.reaudits_per_cycle = planModal.reauditsPerCycle ? parseInt(planModal.reauditsPerCycle, 10) : null
      body.deep_audits_per_cycle = planModal.deepAuditsPerCycle ? parseInt(planModal.deepAuditsPerCycle, 10) : null

      const res = await fetch('/api/admin/users/plan', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setPlanModal(null)
        fetchUsers()
      } else {
        const data = await res.json().catch(() => ({}))
        setErrorMsg(data.error || 'Failed to update plan')
      }
    } catch (err) {
      console.error(err)
      setErrorMsg('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
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
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--m-muted)' }} />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by email, name, or company..."
            className="w-full pl-9 pr-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--signal)]/30"
            style={{ background: 'var(--card)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-black/[0.04]"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
        >
          Search
        </button>
      </form>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--rule)' }}>
                <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--m-muted)' }}>User</th>
                <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--m-muted)' }}>Credits</th>
                <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--m-muted)' }}>Audits</th>
                <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--m-muted)' }}>Tier</th>
                <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--m-muted)' }}>Role</th>
                <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--m-muted)' }}>Joined</th>
                <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--m-muted)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse" style={{ borderBottom: '1px solid var(--rule)' }}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 rounded w-24" style={{ background: 'var(--paper-2)' }} /></td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--m-muted)' }}>No users found</td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="transition-colors hover:bg-black/[0.02]" style={{ borderBottom: '1px solid var(--rule)' }}>
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-medium truncate max-w-[200px]" style={{ color: 'var(--ink)' }}>{u.full_name || '—'}</p>
                      <p className="text-[11px] truncate max-w-[200px]" style={{ color: 'var(--m-muted)' }}>{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[13px] font-medium tabular-nums" style={{ color: 'var(--ok)' }}>{u.credits}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[13px] tabular-nums" style={{ color: 'var(--ink)' }}>{u.audit_count}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full capitalize"
                        style={{ background: 'var(--paper-2)', color: 'var(--ink-2)' }}
                      >
                        {u.subscription_plan || u.package_tier || 'free'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.role !== 'user' && (
                        <span
                          className="inline-block text-[10px] font-medium uppercase px-2 py-0.5 rounded-full"
                          style={{
                            background: u.role === 'super_admin' ? 'var(--severe)' : 'var(--warn)',
                            color: '#FFFFFF',
                          }}
                        >
                          {u.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[12px]" style={{ color: 'var(--m-muted)' }}>{new Date(u.created_at).toLocaleDateString()}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setCreditModal({ user: u, amount: '', reason: '', type: 'add' })}
                          className="p-1.5 rounded-lg transition-colors hover:bg-black/[0.04]"
                          style={{ color: 'var(--m-muted)' }}
                          title="Add credits"
                        >
                          <Plus size={14} />
                        </button>
                        <button
                          onClick={() => setCreditModal({ user: u, amount: '', reason: '', type: 'remove' })}
                          className="p-1.5 rounded-lg transition-colors hover:bg-black/[0.04]"
                          style={{ color: 'var(--m-muted)' }}
                          title="Remove credits"
                        >
                          <Minus size={14} />
                        </button>
                        <button
                          onClick={() => setPlanModal({
                            user: u,
                            plan: u.subscription_plan || 'none',
                            credits: String(u.credits),
                            aiChecksPerMonth: '',
                            freeMembership: u.free_membership || false,
                            expiryDate: u.free_membership_expiry || '',
                            maxActiveWorkspaces: u.max_active_workspaces != null ? String(u.max_active_workspaces) : '',
                            workspaceCreationsPerCycle: u.workspace_creations_per_cycle != null ? String(u.workspace_creations_per_cycle) : '',
                            reauditsPerCycle: u.reaudits_per_cycle != null ? String(u.reaudits_per_cycle) : '',
                            deepAuditsPerCycle: u.deep_audits_per_cycle != null ? String(u.deep_audits_per_cycle) : '',
                          })}
                          className="p-1.5 rounded-lg transition-colors hover:bg-black/[0.04]"
                          style={{ color: 'var(--m-muted)' }}
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
          <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid var(--rule)' }}>
            <span className="text-[12px]" style={{ color: 'var(--m-muted)' }}>Page {page} of {totalPages}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg transition-colors disabled:opacity-30 hover:bg-black/[0.04]"
                style={{ color: 'var(--m-muted)' }}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg transition-colors disabled:opacity-30 hover:bg-black/[0.04]"
                style={{ color: 'var(--m-muted)' }}
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
          <div className="rounded-2xl shadow-2xl w-full max-w-md p-6" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-sans font-medium text-lg" style={{ color: 'var(--ink)' }}>
                {creditModal.type === 'add' ? 'Add credits' : 'Remove credits'}
              </h3>
              <button onClick={() => setCreditModal(null)} className="p-1 rounded-lg hover:bg-black/[0.04] transition-colors">
                <X size={18} style={{ color: 'var(--m-muted)' }} />
              </button>
            </div>

            <p className="text-sm mb-4" style={{ color: 'var(--m-muted)' }}>
              {creditModal.type === 'add' ? 'Adding credits to' : 'Removing credits from'}{' '}
              <span className="font-medium" style={{ color: 'var(--ink)' }}>{creditModal.user.full_name || creditModal.user.email}</span>
              <br />
              <span className="text-[12px]">Current balance: <span className="font-medium" style={{ color: 'var(--ok)' }}>{creditModal.user.credits}</span></span>
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[12px] font-medium block mb-1" style={{ color: 'var(--ink)' }}>Amount</label>
                <input
                  type="number"
                  min="1"
                  value={creditModal.amount}
                  onChange={(e) => setCreditModal({ ...creditModal, amount: e.target.value })}
                  placeholder="Enter amount..."
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--signal)]/30"
                  style={{ background: 'var(--paper)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-[12px] font-medium block mb-1" style={{ color: 'var(--ink)' }}>Reason (optional)</label>
                <input
                  type="text"
                  value={creditModal.reason}
                  onChange={(e) => setCreditModal({ ...creditModal, reason: e.target.value })}
                  placeholder="e.g. Bonus, refund, correction..."
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--signal)]/30"
                  style={{ background: 'var(--paper)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
                />
              </div>
            </div>

            {errorMsg && (
              <p className="text-[13px] mt-3 p-2.5 rounded-lg" style={{ color: 'var(--severe)', background: 'var(--severe-bg, rgba(239,68,68,0.08))', border: '1px solid var(--severe)' }}>{errorMsg}</p>
            )}
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={() => { setCreditModal(null); setErrorMsg(null) }}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-black/[0.04]"
                style={{ border: '1px solid var(--rule)', color: 'var(--ink)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreditSubmit}
                disabled={submitting || !creditModal.amount || parseInt(creditModal.amount) <= 0}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-40"
                style={{ background: creditModal.type === 'add' ? 'var(--ok)' : 'var(--severe)' }}
              >
                {submitting ? 'Processing...' : creditModal.type === 'add' ? 'Add credits' : 'Remove credits'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plan override modal */}
      {planModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setPlanModal(null)}>
          <div className="rounded-2xl shadow-2xl w-full max-w-md p-6" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-medium font-sans" style={{ color: 'var(--ink)' }}>
                Manage plan
              </h3>
              <button onClick={() => setPlanModal(null)} className="p-1 rounded-lg hover:bg-black/[0.04] transition-colors">
                <X size={18} style={{ color: 'var(--m-muted)' }} />
              </button>
            </div>

            <p className="text-sm mb-5" style={{ color: 'var(--m-muted)' }}>
              Overriding plan for{' '}
              <span className="font-medium" style={{ color: 'var(--ink)' }}>{planModal.user.full_name || planModal.user.email}</span>
            </p>

            <div className="space-y-4">
              {/* Plan tier */}
              <div>
                <label className="text-[12px] font-medium block mb-1.5" style={{ color: 'var(--ink)' }}>Subscription plan</label>
                <select
                  value={planModal.plan}
                  onChange={(e) => setPlanModal({ ...planModal, plan: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--signal)]/30"
                  style={{ background: 'var(--paper)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
                >
                  <option value="none">No plan</option>
                  <option value="starter">Starter (1 workspace, 4 re-audits/mo)</option>
                  <option value="pro">Pro (3 workspaces, 12 re-audits/mo)</option>
                  <option value="team">Team (10 workspaces, 40 re-audits/mo)</option>
                  <option value="enterprise">Enterprise (25 workspaces, 100 re-audits/mo)</option>
                </select>
              </div>

              {/* Credits */}
              <div>
                <label className="text-[12px] font-medium block mb-1.5" style={{ color: 'var(--ink)' }}>Credits balance</label>
                <input
                  type="number"
                  min="0"
                  value={planModal.credits}
                  onChange={(e) => setPlanModal({ ...planModal, credits: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--signal)]/30"
                  style={{ background: 'var(--paper)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
                />
              </div>

              {/* ── Quota overrides section ── */}
              <div className="pt-2 pb-1">
                <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--m-muted)' }}>Quota overrides</p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--m-muted)' }}>Leave empty to use plan defaults</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Max active workspaces */}
                <div>
                  <label className="text-[12px] font-medium block mb-1.5" style={{ color: 'var(--ink)' }}>Max workspaces</label>
                  <input
                    type="number"
                    min="0"
                    value={planModal.maxActiveWorkspaces}
                    onChange={(e) => setPlanModal({ ...planModal, maxActiveWorkspaces: e.target.value })}
                    placeholder="Plan default"
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--signal)]/30"
                    style={{ background: 'var(--paper)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
                  />
                </div>

                {/* Workspace creations per cycle */}
                <div>
                  <label className="text-[12px] font-medium block mb-1.5" style={{ color: 'var(--ink)' }}>Creations / cycle</label>
                  <input
                    type="number"
                    min="0"
                    value={planModal.workspaceCreationsPerCycle}
                    onChange={(e) => setPlanModal({ ...planModal, workspaceCreationsPerCycle: e.target.value })}
                    placeholder="Plan default"
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--signal)]/30"
                    style={{ background: 'var(--paper)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
                  />
                </div>

                {/* Re-audits per cycle */}
                <div>
                  <label className="text-[12px] font-medium block mb-1.5" style={{ color: 'var(--ink)' }}>Re-audits / month</label>
                  <input
                    type="number"
                    min="0"
                    value={planModal.reauditsPerCycle}
                    onChange={(e) => setPlanModal({ ...planModal, reauditsPerCycle: e.target.value })}
                    placeholder="Plan default"
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--signal)]/30"
                    style={{ background: 'var(--paper)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
                  />
                </div>

                {/* Deep audits per cycle */}
                <div>
                  <label className="text-[12px] font-medium block mb-1.5" style={{ color: 'var(--ink)' }}>Deep audits / month</label>
                  <input
                    type="number"
                    min="0"
                    value={planModal.deepAuditsPerCycle}
                    onChange={(e) => setPlanModal({ ...planModal, deepAuditsPerCycle: e.target.value })}
                    placeholder="Plan default"
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--signal)]/30"
                    style={{ background: 'var(--paper)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
                  />
                </div>
              </div>

              {/* AI checks per month */}
              <div>
                <label className="text-[12px] font-medium block mb-1.5" style={{ color: 'var(--ink)' }}>AI checks / month</label>
                <input
                  type="number"
                  min="0"
                  value={planModal.aiChecksPerMonth}
                  onChange={(e) => setPlanModal({ ...planModal, aiChecksPerMonth: e.target.value })}
                  placeholder="Leave empty to use plan default"
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--signal)]/30"
                  style={{ background: 'var(--paper)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
                />
                <p className="text-[11px] mt-1" style={{ color: 'var(--m-muted)' }}>Starter: 10 · Pro: 30 · Team: 100 · Enterprise: 500</p>
              </div>

              {/* Free membership toggle */}
              <div className="flex items-center justify-between py-2" style={{ borderTop: '1px solid var(--rule)' }}>
                <div>
                  <label className="text-[12px] font-medium block" style={{ color: 'var(--ink)' }}>Free membership</label>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--m-muted)' }}>Grant free access without payment</p>
                </div>
                <button
                  onClick={() => setPlanModal({ ...planModal, freeMembership: !planModal.freeMembership })}
                  className="relative w-10 h-5 rounded-full transition-colors"
                  style={{ background: planModal.freeMembership ? 'var(--ok)' : 'var(--paper-3, var(--rule))' }}
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
                  <label className="text-[12px] font-medium block mb-1.5" style={{ color: 'var(--ink)' }}>Expiry date (optional)</label>
                  <input
                    type="date"
                    value={planModal.expiryDate}
                    onChange={(e) => setPlanModal({ ...planModal, expiryDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--signal)]/30"
                    style={{ background: 'var(--paper)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
                  />
                  <p className="text-[11px] mt-1" style={{ color: 'var(--m-muted)' }}>Leave empty for no expiry</p>
                </div>
              )}
            </div>

            {errorMsg && (
              <p className="text-[13px] mt-3 p-2.5 rounded-lg" style={{ color: 'var(--severe)', background: 'var(--severe-bg, rgba(239,68,68,0.08))', border: '1px solid var(--severe)' }}>{errorMsg}</p>
            )}
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={() => { setPlanModal(null); setErrorMsg(null) }}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-black/[0.04]"
                style={{ border: '1px solid var(--rule)', color: 'var(--ink)' }}
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
