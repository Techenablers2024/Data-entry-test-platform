import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { listUsers, approveUser, disableUser, enableUser, resetPassword, updateUser, extendValidity } from '../../api/admin'
import { ReceiptModal } from './ReceiptModal'
import type { User } from '../../types/auth'
import { X, Hash, Pencil, ShieldCheck } from 'lucide-react'

interface PendingExtension {
  days?: number
  date?: string
  label: string
  newDate: string  // ISO string
  daysText: string // display like "+183 days"
}

function computeExtendedDate(currentValidUntil: string | undefined | null, addDays: number): Date {
  const base = currentValidUntil && new Date(currentValidUntil) > new Date()
    ? new Date(currentValidUntil)
    : new Date()
  const result = new Date(base)
  result.setDate(result.getDate() + addDays)
  return result
}

export function UsersPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [resetTarget, setResetTarget] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetMsg, setResetMsg] = useState('')
  const [receiptUser, setReceiptUser] = useState<User | null>(null)
  const [profileUser, setProfileUser] = useState<User | null>(null)
  const [profileEditing, setProfileEditing] = useState(false)
  const [profileForm, setProfileForm] = useState({
    dob: '', pincode: '', state: '', district: '', taluk: '', reference_name: '',
    account_holder_name: '', bank_name: '', account_number: '', ifsc_code: '',
  })
  const [profileError, setProfileError] = useState('')
  const [extendingValidity, setExtendingValidity] = useState(false)
  const [extendCustomDate, setExtendCustomDate] = useState('')
  const [extendError, setExtendError] = useState('')
  const [pendingExtension, setPendingExtension] = useState<PendingExtension | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', statusFilter],
    queryFn: () => listUsers(statusFilter || undefined).then((r) => r.data.data),
  })

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

  const openProfile = (u: User) => {
    setProfileForm({
      dob: u.dob ? u.dob.substring(0, 10) : '',
      pincode: u.pincode ?? '',
      state: u.state ?? '',
      district: u.district ?? '',
      taluk: u.taluk ?? '',
      reference_name: u.reference_name ?? '',
      account_holder_name: u.account_holder_name ?? '',
      bank_name: u.bank_name ?? '',
      account_number: u.account_number ?? '',
      ifsc_code: u.ifsc_code ?? '',
    })
    setProfileEditing(false)
    setProfileError('')
    setExtendingValidity(false)
    setPendingExtension(null)
    setProfileUser(u)
  }

  const updateProfile = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof profileForm }) =>
      updateUser(id, {
        dob: data.dob || null,
        pincode: data.pincode,
        state: data.state,
        district: data.district,
        taluk: data.taluk,
        reference_name: data.reference_name,
        account_holder_name: data.account_holder_name,
        bank_name: data.bank_name,
        account_number: data.account_number,
        ifsc_code: data.ifsc_code,
      }),
    onSuccess: (res) => {
      setProfileUser(prev => prev ? { ...prev, ...res.data.data } : res.data.data)
      setProfileEditing(false)
      setProfileError('')
      invalidate()
    },
    onError: () => setProfileError('Failed to save. Please try again.'),
  })

  const extendValidityMutation = useMutation({
    mutationFn: ({ id, days, date }: { id: string; days?: number; date?: string }) =>
      extendValidity(id, days ? { extend_days: days } : { valid_until: date }),
    onSuccess: (res) => {
      setProfileUser(prev => prev ? { ...prev, ...res.data.data } : res.data.data)
      setExtendingValidity(false)
      setExtendCustomDate('')
      setExtendError('')
      setPendingExtension(null)
      invalidate()
    },
    onError: () => setExtendError('Failed to extend validity. Please try again.'),
  })

  const handlePresetExtend = (days: number, label: string) => {
    if (!profileUser) return
    const newDate = computeExtendedDate(profileUser.credential_valid_until, days)
    setPendingExtension({ days, label, newDate: newDate.toISOString(), daysText: `+${days} days` })
  }

  const handleCustomExtend = () => {
    if (!extendCustomDate || !profileUser) return
    const newDt = new Date(extendCustomDate + 'T00:00:00')
    const base = profileUser.credential_valid_until && new Date(profileUser.credential_valid_until) > new Date()
      ? new Date(profileUser.credential_valid_until) : new Date()
    const diff = Math.round((newDt.getTime() - base.getTime()) / 86400000)
    const daysText = diff > 0 ? `+${diff} days` : `${diff} days`
    setPendingExtension({ date: extendCustomDate, label: extendCustomDate, newDate: newDt.toISOString(), daysText })
  }

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      active:   'bg-green-100 text-green-700',
      pending:  'bg-amber-100 text-amber-700',
      disabled: 'bg-red-100 text-red-700',
    }
    return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${map[s] ?? ''}`}>{s}</span>
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {resetMsg && <span className="text-green-600 text-sm font-semibold">{resetMsg}</span>}

          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name or mobile…"
              className="border border-gray-300 rounded-lg pl-8 pr-3 py-1.5 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
      </div>

      {search && (
        <p className="text-sm text-gray-500 mb-3">
          {filtered.length} result{filtered.length !== 1 ? 's' : ''} for "{search}"
        </p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-teal-700">
              <tr>
                {['ID', 'Name', 'Mobile', 'Email', 'Status', 'Registered', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-white text-xs uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-teal-600 font-semibold">{u.display_id || '—'}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{u.name}</td>
                  <td className="px-4 py-3 text-gray-600 font-medium">{u.mobile}</td>
                  <td className="px-4 py-3 text-gray-500 font-medium">{u.email ?? '—'}</td>
                  <td className="px-4 py-3">{statusBadge(u.status)}</td>
                  <td className="px-4 py-3 text-gray-500 font-medium">{new Date(u.created_at).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 flex-wrap">
                      {u.status === 'pending' && !u.is_admin && (
                        <button onClick={() => approve.mutate(u.id)}
                          className="px-2.5 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 font-medium">Approve</button>
                      )}
                      {u.status === 'active' && !u.is_admin && (
                        <button onClick={() => disable.mutate(u.id)}
                          className="px-2.5 py-1 bg-red-100 text-red-700 text-xs rounded-lg hover:bg-red-200 font-medium">Disable</button>
                      )}
                      {u.status === 'disabled' && (
                        <button onClick={() => enable.mutate(u.id)}
                          className="px-2.5 py-1 bg-teal-100 text-teal-700 text-xs rounded-lg hover:bg-teal-200 font-medium">Enable</button>
                      )}
                      {!u.is_admin && (
                        <button onClick={() => setResetTarget(u)}
                          className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs rounded-lg hover:bg-gray-200 font-medium">Reset PW</button>
                      )}
                      {!u.is_admin && (
                        <>
                          <button onClick={() => navigate(`/admin/reports/${u.id}?name=${encodeURIComponent(u.name)}`)}
                            className="px-2.5 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-lg hover:bg-indigo-200 font-medium">📈 Report</button>
                          <button onClick={() => setReceiptUser(u)}
                            className="px-2.5 py-1 bg-purple-100 text-purple-700 text-xs rounded-lg hover:bg-purple-200 font-medium">🧾 Receipt</button>
                          <button onClick={() => openProfile(u)}
                            className="px-2.5 py-1 bg-teal-100 text-teal-700 text-xs rounded-lg hover:bg-teal-200 font-medium">👤 Profile</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 font-medium">
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
            <h2 className="text-lg font-bold mb-1">Reset Password</h2>
            <p className="text-sm text-gray-500 mb-4">
              Set a new password for <span className="font-semibold text-gray-800">{resetTarget.name}</span>
            </p>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
              placeholder="New password (min 6 chars)"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-teal-500" />
            <div className="flex gap-3">
              <button onClick={() => setResetTarget(null)}
                className="flex-1 border border-gray-300 rounded-xl py-2.5 text-sm font-medium">Cancel</button>
              <button onClick={() => reset.mutate({ id: resetTarget.id, pw: newPassword })}
                disabled={newPassword.length < 6 || reset.isPending}
                className="flex-1 bg-teal-600 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50">
                {reset.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
      {receiptUser && <ReceiptModal user={receiptUser} onClose={() => setReceiptUser(null)} />}

      {/* Profile modal */}
      {profileUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => { if (!profileEditing) setProfileUser(null) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>

            {/* Teal header */}
            <div className="bg-gradient-to-br from-teal-600 to-teal-800 px-6 py-5 relative">
              <button onClick={() => setProfileUser(null)} className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors">
                <X size={18} />
              </button>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/20 ring-2 ring-white/30 flex items-center justify-center text-white font-bold text-xl select-none">
                  {getInitials(profileUser.name)}
                </div>
                <div>
                  <h2 className="text-white text-lg font-bold leading-tight">{profileUser.name}</h2>
                  <span className="inline-flex items-center gap-1 bg-white/20 text-white text-[11px] font-semibold px-2 py-0.5 rounded-full mt-1">
                    <Hash size={10} />{profileUser.display_id}
                  </span>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto flex-1">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-teal-600 mb-2">Member Details</p>
                <div className="bg-gray-50 rounded-xl px-4 py-1">
                  <PRow label="Member ID"     value={profileUser.display_id} />
                  <PRow label="Name"          value={profileUser.name} />
                  <PRow label="Mobile"        value={profileUser.mobile} />
                  <PRow label="Email"         value={profileUser.email ?? '—'} />
                  <PRow label="Date of Birth" value={
                    profileEditing
                      ? <input type="date" value={profileForm.dob}
                          onChange={e => setProfileForm(f => ({ ...f, dob: e.target.value }))}
                          className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500" />
                      : fmtDate(profileUser.dob)
                  } />
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-teal-600 mb-2">Address Details</p>
                <div className="bg-gray-50 rounded-xl px-4 py-1">
                  <PRow label="Pincode"  value={profileEditing ? <input value={profileForm.pincode}  onChange={e => setProfileForm(f => ({ ...f, pincode: e.target.value }))}  placeholder="Pincode"  className="border border-gray-300 rounded-lg px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-teal-500" /> : (profileUser.pincode || '—')} />
                  <PRow label="State"    value={profileEditing ? <input value={profileForm.state}    onChange={e => setProfileForm(f => ({ ...f, state: e.target.value }))}    placeholder="State"    className="border border-gray-300 rounded-lg px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-teal-500" /> : (profileUser.state || '—')} />
                  <PRow label="District" value={profileEditing ? <input value={profileForm.district} onChange={e => setProfileForm(f => ({ ...f, district: e.target.value }))} placeholder="District" className="border border-gray-300 rounded-lg px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-teal-500" /> : (profileUser.district || '—')} />
                  <PRow label="Taluk"    value={profileEditing ? <input value={profileForm.taluk}    onChange={e => setProfileForm(f => ({ ...f, taluk: e.target.value }))}    placeholder="Taluk"    className="border border-gray-300 rounded-lg px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-teal-500" /> : (profileUser.taluk || '—')} />
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-teal-600 mb-2">Registration Details</p>
                <div className="bg-gray-50 rounded-xl px-4 py-1">
                  <PRow label="Reg Date"   value={fmtDate(profileUser.created_at)} />
                  <PRow label="Reg Time"   value={fmtTime(profileUser.created_at)} />
                  <PRow label="Reference"  value={profileEditing ? <input value={profileForm.reference_name} onChange={e => setProfileForm(f => ({ ...f, reference_name: e.target.value }))} placeholder="Reference name" className="border border-gray-300 rounded-lg px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-teal-500" /> : (profileUser.reference_name || '—')} />
                  <PRow label="Admin ID"   value={profileUser.approved_by_name || '—'} />
                  <PRow label="Reg Status" value={profileUser.status === 'active' ? 'Approved' : profileUser.status}
                    badge={profileUser.status === 'active' ? 'green' : profileUser.status === 'pending' ? 'amber' : 'red'} />
                  {(() => {
                    const vd = profileUser.credential_valid_until
                    if (!vd) return <PRow label="Valid Until" value="—" />
                    const days = Math.floor((new Date(vd).getTime() - Date.now()) / 86400000)
                    const badge: 'green' | 'amber' | 'red' = days < 0 ? 'red' : days <= 90 ? 'amber' : 'green'
                    const label = days < 0 ? `Expired ${fmtDate(vd)}` : `${fmtDate(vd)} (${days}d left)`
                    return <PRow label="Valid Until" value={label} badge={badge} />
                  })()}
                  <PRow label="Proc Days"  value="40" />
                  <PRow label="Max"        value="2500" />
                  <PRow label="Min"        value="2500" />
                  <PRow label="Version"    value="1" />
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-teal-600 mb-2">Bank Details</p>
                <div className="bg-gray-50 rounded-xl px-4 py-1">
                  <PRow label="Acct Name"  value={profileEditing ? <input value={profileForm.account_holder_name} onChange={e => setProfileForm(f => ({ ...f, account_holder_name: e.target.value }))} placeholder="Account holder name" className="border border-gray-300 rounded-lg px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-teal-500" /> : (profileUser.account_holder_name || '—')} />
                  <PRow label="Bank Name"  value={profileEditing ? <input value={profileForm.bank_name}          onChange={e => setProfileForm(f => ({ ...f, bank_name: e.target.value }))}          placeholder="Bank name"           className="border border-gray-300 rounded-lg px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-teal-500" /> : (profileUser.bank_name || '—')} />
                  <PRow label="Acct No"    value={profileEditing ? <input value={profileForm.account_number}     onChange={e => setProfileForm(f => ({ ...f, account_number: e.target.value }))}     placeholder="Account number"      className="border border-gray-300 rounded-lg px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-teal-500" /> : (profileUser.account_number || '—')} />
                  <PRow label="IFSC"       value={profileEditing ? <input value={profileForm.ifsc_code}          onChange={e => setProfileForm(f => ({ ...f, ifsc_code: e.target.value.toUpperCase() }))} placeholder="IFSC code"        className="border border-gray-300 rounded-lg px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-teal-500" /> : (profileUser.ifsc_code || '—')} />
                </div>
              </div>
              {profileError && (
                <div className="md:col-span-2 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  <X size={13} className="text-red-500 shrink-0" />
                  <p className="text-red-600 text-xs">{profileError}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex flex-col gap-3">
              {extendingValidity && (
                <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 flex flex-col gap-3">
                  <p className="text-sm font-bold text-teal-700">Extend Credential Validity</p>

                  {pendingExtension ? (
                    /* Confirmation step */
                    <div className="space-y-3">
                      <div className="bg-white rounded-lg border border-teal-200 divide-y divide-teal-100 text-sm">
                        <div className="flex items-center gap-3 px-3 py-2.5">
                          <span className="text-gray-500 font-medium w-40 shrink-0">Currently valid until</span>
                          <span className="font-semibold text-gray-800">
                            {profileUser.credential_valid_until
                              ? (() => {
                                  const d = Math.floor((new Date(profileUser.credential_valid_until).getTime() - Date.now()) / 86400000)
                                  return `${fmtDate(profileUser.credential_valid_until)} ${d < 0 ? '(Expired)' : `(${d}d left)`}`
                                })()
                              : 'Not set'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 px-3 py-2.5 bg-teal-50/60">
                          <span className="text-gray-500 font-medium w-40 shrink-0">Will be extended to</span>
                          <span className="font-bold text-teal-700">
                            {fmtDate(pendingExtension.newDate)}
                            <span className="ml-2 text-teal-500 font-semibold text-xs">({pendingExtension.daysText})</span>
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setPendingExtension(null)}
                          className="flex-1 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors">
                          ← Back
                        </button>
                        <button
                          onClick={() => extendValidityMutation.mutate({
                            id: profileUser.id,
                            ...(pendingExtension.days ? { days: pendingExtension.days } : { date: pendingExtension.date! })
                          })}
                          disabled={extendValidityMutation.isPending}
                          className="flex-[2] px-3 py-2 text-sm font-bold bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors">
                          {extendValidityMutation.isPending ? 'Extending…' : '✓ Confirm Extension'}
                        </button>
                      </div>
                      {extendError && <p className="text-xs text-red-500">{extendError}</p>}
                    </div>
                  ) : (
                    /* Preset + custom date selection */
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {[{ label: '+6 months', days: 183 }, { label: '+1 year', days: 365 }, { label: '+2 years', days: 730 }].map(({ label, days }) => (
                          <button key={days}
                            onClick={() => handlePresetExtend(days, label)}
                            className="px-4 py-2 text-sm font-semibold bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors">
                            {label}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="date" value={extendCustomDate}
                          onChange={e => setExtendCustomDate(e.target.value)}
                          className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 flex-1" />
                        <button
                          onClick={handleCustomExtend}
                          disabled={!extendCustomDate}
                          className="px-3 py-1.5 text-sm font-semibold bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors">
                          Set Date
                        </button>
                        <button onClick={() => { setExtendingValidity(false); setExtendCustomDate(''); setExtendError(''); setPendingExtension(null) }}
                          className="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2">
                {profileEditing ? (
                  <>
                    <button onClick={() => { setProfileEditing(false); setProfileError('') }}
                      className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors">
                      Cancel
                    </button>
                    <button
                      onClick={() => updateProfile.mutate({ id: profileUser.id, data: profileForm })}
                      disabled={updateProfile.isPending}
                      className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-colors">
                      {updateProfile.isPending ? 'Saving…' : 'Save'}
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setProfileUser(null)}
                      className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors">
                      Close
                    </button>
                    <button onClick={() => { setExtendingValidity(v => !v); setExtendError(''); setPendingExtension(null) }}
                      className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 transition-colors">
                      <ShieldCheck size={13} /> Extend Validity
                    </button>
                    <button onClick={() => setProfileEditing(true)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 transition-colors">
                      <Pencil size={13} /> Edit Profile
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function getInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

function fmtDate(iso: string | undefined | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
}

function fmtTime(iso: string | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`
}

function PRow({ label, value, badge }: {
  label: string
  value: React.ReactNode
  badge?: 'green' | 'amber' | 'red'
}) {
  const badgeColors = { green: 'bg-green-100 text-green-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-600' }
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0 min-h-[36px]">
      <span className="text-sm text-gray-500 font-medium w-28 shrink-0">{label}</span>
      {badge ? (
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${badgeColors[badge]}`}>{value}</span>
      ) : (
        <span className="text-[15px] font-semibold text-gray-800 flex-1 min-w-0">{value ?? '—'}</span>
      )}
    </div>
  )
}
