import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listAdmins, createAdmin } from '../../api/auth'
import { disableUser, enableUser } from '../../api/admin'
import type { User } from '../../types/auth'

export function AdminsPage() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', mobile: '', password: '', email: '' })
  const [formError, setFormError] = useState('')

  const { data: admins, isLoading } = useQuery({
    queryKey: ['admin-admins'],
    queryFn: () => listAdmins().then(r => r.data.data),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-admins'] })

  const createMut = useMutation({
    mutationFn: () => createAdmin({
      name: form.name,
      mobile: form.mobile,
      password: form.password,
      email: form.email || undefined,
    }),
    onSuccess: () => {
      setShowModal(false)
      setForm({ name: '', mobile: '', password: '', email: '' })
      setFormError('')
      invalidate()
    },
    onError: (err: any) => setFormError(err.response?.data?.error ?? 'Failed to create admin.'),
  })

  const disableMut = useMutation({ mutationFn: (id: string) => disableUser(id), onSuccess: invalidate })
  const enableMut  = useMutation({ mutationFn: (id: string) => enableUser(id),  onSuccess: invalidate })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!form.name || !form.mobile || !form.password) { setFormError('Name, mobile and password are required.'); return }
    if (form.password.length < 6) { setFormError('Password must be at least 6 characters.'); return }
    createMut.mutate()
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Admins</h1>
        <button onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-blue-700 transition-colors">
          + Create Admin
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="w-7 h-7 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['ID', 'Name', 'Mobile', 'Email', 'Created', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(admins ?? []).map((a: User) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-blue-600">{a.display_id || '—'}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{a.name}</td>
                  <td className="px-4 py-3 text-gray-600">{a.mobile}</td>
                  <td className="px-4 py-3 text-gray-500">{a.email ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(a.created_at).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      a.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>{a.status}</span>
                  </td>
                  <td className="px-4 py-3 flex gap-2">
                    {a.status === 'active' && (
                      <button onClick={() => { if (confirm('Disable this admin?')) disableMut.mutate(a.id) }}
                        className="px-2.5 py-1 bg-red-100 text-red-700 text-xs rounded-lg hover:bg-red-200">Disable</button>
                    )}
                    {a.status === 'disabled' && (
                      <button onClick={() => enableMut.mutate(a.id)}
                        className="px-2.5 py-1 bg-green-100 text-green-700 text-xs rounded-lg hover:bg-green-200">Enable</button>
                    )}
                  </td>
                </tr>
              ))}
              {(admins ?? []).length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No admins found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Admin Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Create Admin</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Full name" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Mobile *</label>
                <input value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Mobile number" type="tel" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Password *</label>
                <input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Min 6 characters" type="password" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email (optional)</label>
                <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="email@example.com" type="email" />
              </div>
              {formError && <p className="text-red-600 text-sm">{formError}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setFormError('') }}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-xl font-medium hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={createMut.isPending}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50">
                  {createMut.isPending ? 'Creating…' : 'Create Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
