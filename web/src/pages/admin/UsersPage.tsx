import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { listUsers, approveUser, disableUser, enableUser, resetPassword } from '../../api/admin'
import { ReceiptModal } from './ReceiptModal'
import type { User } from '../../types/auth'

export function UsersPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [resetTarget, setResetTarget] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetMsg, setResetMsg] = useState('')
  const [receiptUser, setReceiptUser] = useState<User | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', statusFilter],
    queryFn: () => listUsers(statusFilter || undefined).then((r) => r.data.data),
  })

  // Client-side search filter — exclude admins (shown in Admins tab)
  const filtered = useMemo(() => {
    if (!data) return []
    const nonAdmins = data.filter(u => !u.is_admin)
    const q = search.toLowerCase().trim()
    if (!q) return nonAdmins
    return nonAdmins.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.mobile.includes(q) ||
      (u.email ?? '').toLowerCase().includes(q)
    )
  }, [data, search])

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-users'] })
  const approve = useMutation({ mutationFn: (id: string) => approveUser(id), onSuccess: invalidate })
  const disable = useMutation({ mutationFn: (id: string) => disableUser(id), onSuccess: invalidate })
  const enable  = useMutation({ mutationFn: (id: string) => enableUser(id),  onSuccess: invalidate })
  const reset   = useMutation({
    mutationFn: ({ id, pw }: { id: string; pw: string }) => resetPassword(id, pw),
    onSuccess: () => {
      setResetTarget(null)
      setNewPassword('')
      setResetMsg('Password reset!')
      setTimeout(() => setResetMsg(''), 3000)
    },
  })

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      active:   'bg-green-100 text-green-700',
      pending:  'bg-amber-100 text-amber-700',
      disabled: 'bg-red-100 text-red-700',
    }
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[s] ?? ''}`}>{s}</span>
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-900">Users</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {resetMsg && <span className="text-green-600 text-sm font-medium">{resetMsg}</span>}

          {/* Search */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name or mobile…"
              className="border border-gray-300 rounded-lg pl-8 pr-3 py-1.5 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status filter */}
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
      </div>

      {/* Result count */}
      {search && (
        <p className="text-sm text-gray-500 mb-3">
          {filtered.length} result{filtered.length !== 1 ? 's' : ''} for "{search}"
        </p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['ID', 'Name', 'Mobile', 'Email', 'Status', 'Registered', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-blue-600">{u.display_id || '—'}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                  <td className="px-4 py-3 text-gray-600">{u.mobile}</td>
                  <td className="px-4 py-3 text-gray-500">{u.email ?? '—'}</td>
                  <td className="px-4 py-3">{statusBadge(u.status)}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(u.created_at).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 flex-wrap">
                      {u.status === 'pending' && !u.is_admin && (
                        <button onClick={() => approve.mutate(u.id)}
                          className="px-2.5 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700">Approve</button>
                      )}
                      {u.status === 'active' && !u.is_admin && (
                        <button onClick={() => disable.mutate(u.id)}
                          className="px-2.5 py-1 bg-red-100 text-red-700 text-xs rounded-lg hover:bg-red-200">Disable</button>
                      )}
                      {u.status === 'disabled' && (
                        <button onClick={() => enable.mutate(u.id)}
                          className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs rounded-lg hover:bg-blue-200">Enable</button>
                      )}
                      {!u.is_admin && (
                        <button onClick={() => setResetTarget(u)}
                          className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs rounded-lg hover:bg-gray-200">Reset PW</button>
                      )}
                      {!u.is_admin && (
                        <>
                          <button onClick={() => navigate(`/admin/reports/${u.id}?name=${encodeURIComponent(u.name)}`)}
                            className="px-2.5 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-lg hover:bg-indigo-200">📈 Report</button>
                          <button onClick={() => setReceiptUser(u)}
                            className="px-2.5 py-1 bg-purple-100 text-purple-700 text-xs rounded-lg hover:bg-purple-200">🧾 Receipt</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  {search ? 'No users match your search' : 'No users found'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Reset password modal */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <h2 className="text-lg font-semibold mb-1">Reset Password</h2>
            <p className="text-sm text-gray-500 mb-4">
              Set a new password for <span className="font-medium text-gray-800">{resetTarget.name}</span>
            </p>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
              placeholder="New password (min 6 chars)"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <div className="flex gap-3">
              <button onClick={() => setResetTarget(null)}
                className="flex-1 border border-gray-300 rounded-xl py-2.5 text-sm">Cancel</button>
              <button onClick={() => reset.mutate({ id: resetTarget.id, pw: newPassword })}
                disabled={newPassword.length < 6 || reset.isPending}
                className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50">
                {reset.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
      {receiptUser && <ReceiptModal user={receiptUser} onClose={() => setReceiptUser(null)} />}
    </div>
  )
}
