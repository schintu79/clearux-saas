'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Users, FileSearch, Coins, Activity, ArrowRight } from 'lucide-react'

interface Stats {
  totalUsers: number
  totalAudits: number
  totalCreditsInCirculation: number
  auditsByStatus: Record<string, number>
  recentUsers: Array<{ id: string; email: string; full_name: string | null; created_at: string; credits: number; role: string }>
  recentAudits: Array<{ id: string; product_url: string; status: string; created_at: string; user_id: string }>
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/stats')
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-surface rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-card border border-border rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (!stats) return <p className="text-muted">Failed to load stats.</p>

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-[#6B5B95]', bg: 'bg-[#6B5B95]/10', href: '/admin/users' },
    { label: 'Total Audits', value: stats.totalAudits, icon: FileSearch, color: 'text-pink-500', bg: 'bg-pink-500/10', href: '/admin/audits' },
    { label: 'Credits in Circulation', value: stats.totalCreditsInCirculation, icon: Coins, color: 'text-[#2D7A4F]', bg: 'bg-[#2D7A4F]/10', href: '/admin/users' },
    { label: 'Completed Audits', value: stats.auditsByStatus['completed'] || 0, icon: Activity, color: 'text-amber-500', bg: 'bg-amber-500/10', href: '/admin/audits' },
  ]

  const statusColors: Record<string, string> = {
    pending_payment: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
    payment_received: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    crawling: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    analysing: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    generating_report: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    completed: 'bg-[#2D7A4F]/10 text-[#2D7A4F]',
    failed: 'bg-[#C0392B]/10 text-[#C0392B]',
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading font-semibold text-2xl text-text">Admin Dashboard</h1>
        <p className="text-sm text-muted mt-1">Platform overview and quick actions</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <Link
              key={card.label}
              href={card.href}
              className="group bg-card border border-border rounded-xl p-5 hover:shadow-lg hover:shadow-black/[0.04] hover:-translate-y-0.5 transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center`}>
                  <Icon size={18} className={card.color} />
                </div>
                <ArrowRight size={14} className="text-muted/40 group-hover:text-muted transition-colors" />
              </div>
              <p className="text-2xl font-bold text-text tabular-nums">{card.value.toLocaleString()}</p>
              <p className="text-[12px] text-muted mt-0.5">{card.label}</p>
            </Link>
          )
        })}
      </div>

      {/* Audits by status */}
      {Object.keys(stats.auditsByStatus).length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-heading font-semibold text-sm text-text mb-4">Audits by Status</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.auditsByStatus).map(([status, count]) => (
              <span
                key={status}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium ${statusColors[status] || 'bg-surface-alt text-muted'}`}
              >
                {status.replace(/_/g, ' ')}
                <span className="font-bold">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent users */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-semibold text-sm text-text">Recent Users</h2>
            <Link href="/admin/users" className="text-[12px] text-brand hover:underline font-medium">View all</Link>
          </div>
          <div className="space-y-2.5">
            {stats.recentUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between py-1.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-text font-medium truncate">{u.full_name || u.email}</p>
                  <p className="text-[11px] text-muted truncate">{u.email}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-[11px] text-[#2D7A4F] font-medium tabular-nums">{u.credits} cr</span>
                  {(u.role === 'admin' || u.role === 'super_admin') && (
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-500/10 text-red-500">{u.role === 'super_admin' ? 'Super' : 'Admin'}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent audits */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-semibold text-sm text-text">Recent Audits</h2>
            <Link href="/admin/audits" className="text-[12px] text-brand hover:underline font-medium">View all</Link>
          </div>
          <div className="space-y-2.5">
            {stats.recentAudits.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-1.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-text font-medium truncate">
                    {(() => { try { return new URL(a.product_url).hostname } catch { return a.product_url } })()}
                  </p>
                  <p className="text-[11px] text-muted">{new Date(a.created_at).toLocaleDateString()}</p>
                </div>
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusColors[a.status] || 'bg-surface-alt text-muted'}`}>
                  {a.status.replace(/_/g, ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
