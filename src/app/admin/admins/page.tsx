'use client'

import { useEffect, useState } from 'react'
import { ShieldCheck, UserPlus, X, Shield, Crown } from 'lucide-react'

interface Admin {
  id: string
  email: string
  full_name: string | null
  role: 'admin' | 'super_admin'
  created_at: string
}

export default function AdminManagementPage() {
  const [admins, setAdmins] = useState<Admin[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addEmail, setAddEmail] = useState('')
  const [addRole, setAddRole] = useState<'admin' | 'super_admin'>('admin')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const fetchAdmins = () => {
    setLoading(true)
    fetch('/api/admin/admins')
      .then((r) => r.json())
      .then((d) => setAdmins(d.admins || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchAdmins() }, [])

  const handleAddAdmin = async () => {
    if (!addEmail.trim()) return
    setSubmitting(true)
    setError('')

    try {
      // First find the user by email via the users API
      const searchRes = await fetch(`/api/admin/users?search=${encodeURIComponent(addEmail)}&limit=1`)
      const searchData = await searchRes.json()
      const matchedUser = (searchData.users || []).find(
        (u: any) => u.email.toLowerCase() === addEmail.toLowerCase()
      )

      if (!matchedUser) {
        setError('User not found. They must have a ClearUX account first.')
        setSubmitting(false)
        return
      }

      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: matchedUser.id, role: addRole }),
      })

      if (res.ok) {
        setShowAddModal(false)
        setAddEmail('')
        setAddRole('admin')
        fetchAdmins()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to update role')
      }
    } catch (err) {
      setError('Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemoveAdmin = async (userId: string) => {
    if (!confirm('Remove admin privileges from this user?')) return

    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, role: 'user' }),
      })

      if (res.ok) {
        fetchAdmins()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to remove admin')
      }
    } catch {
      alert('Something went wrong')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading font-semibold text-2xl text-text">Admin Management</h1>
          <p className="text-sm text-muted mt-1">Manage who has admin access to the platform</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-brand text-surface dark:text-[#1C1C1C] rounded-lg transition-all hover:brightness-110"
        >
          <UserPlus size={15} />
          Add Admin
        </button>
      </div>

      {/* Admins list */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-[11px] font-semibold text-muted uppercase tracking-wider">Admin</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-muted uppercase tracking-wider">Role</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-muted uppercase tracking-wider">Member Since</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-muted uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-surface-alt rounded w-24" /></td>
                    ))}
                  </tr>
                ))
              ) : admins.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted">No admins found</td>
                </tr>
              ) : (
                admins.map((admin) => (
                  <tr key={admin.id} className="hover:bg-surface-alt/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-surface dark:text-[#1C1C1C] bg-brand flex-shrink-0"
                        >
                          {(admin.full_name || admin.email)[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-[13px] text-text font-medium">{admin.full_name || '—'}</p>
                          <p className="text-[11px] text-muted">{admin.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase px-2.5 py-1 rounded-full ${
                        admin.role === 'super_admin'
                          ? 'bg-[#C0392B]/10 text-[#C0392B] border border-[#C0392B]/20'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                      }`}>
                        {admin.role === 'super_admin' ? <Crown size={12} /> : <Shield size={12} />}
                        {admin.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[12px] text-muted">{new Date(admin.created_at).toLocaleDateString()}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleRemoveAdmin(admin.id)}
                        className="text-[12px] text-[#C0392B] hover:text-[#A93226] font-medium hover:underline transition-colors"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info card */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#6B5B95]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <ShieldCheck size={18} className="text-[#6B5B95]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text mb-1">Role Permissions</h3>
            <div className="text-[13px] text-text/65 space-y-1">
              <p><span className="font-medium text-amber-500">Admin</span> — Can view all users, audits, and manage credits. Cannot promote or demote other admins.</p>
              <p><span className="font-medium text-[#C0392B]">Super Admin</span> — Full access including promoting and demoting admins. Cannot demote themselves.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Add admin modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-heading font-semibold text-lg text-text">Add Admin</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 rounded-lg hover:bg-surface-alt transition-colors">
                <X size={18} className="text-muted" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[12px] font-medium text-text block mb-1">User Email</label>
                <input
                  type="email"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-brand/30"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-[12px] font-medium text-text block mb-1">Role</label>
                <select
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value as 'admin' | 'super_admin')}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text focus:outline-none focus:ring-2 focus:ring-brand/30"
                >
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>

              {error && (
                <p className="text-[13px] text-[#C0392B] bg-[#C0392B]/10 px-3 py-2 rounded-lg">{error}</p>
              )}
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium text-text hover:bg-surface-alt transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAdmin}
                disabled={submitting || !addEmail.trim()}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold bg-brand text-surface dark:text-[#1C1C1C] transition-all disabled:opacity-40 hover:brightness-110"
              >
                {submitting ? 'Adding...' : 'Add Admin'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
