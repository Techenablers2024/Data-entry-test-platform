import { useSession } from '../../context/SessionContext'
import { useAuth } from '../../context/AuthContext'
import { SessionTimer } from '../session/SessionTimer'
import { logout, updateMyBank } from '../../api/auth'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { WARN_THRESHOLD_SECS } from '../../lib/constants'
import { LogOut, ShieldCheck, UserCircle, Landmark, X, Phone, Mail, Hash, Calendar, BadgeCheck, Pencil, CreditCard, Building2, KeyRound, MapPin, Clock, FileText, Info } from 'lucide-react'

type ModalType = 'privacy' | 'profile' | 'bank' | null

interface BankForm {
  fullName: string
  bankName: string
  accountNo: string
  confirmAccountNo: string
  ifscCode: string
}

const EMPTY_BANK: BankForm = { fullName: '', bankName: '', accountNo: '', confirmAccountNo: '', ifscCode: '' }

function getInitials(name: string | undefined) {
  if (!name) return 'U'
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

function fmtDate(iso: string | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
}

function validityStatus(iso: string | undefined): { label: string; badge: 'green' | 'amber' | 'red' } {
  if (!iso) return { label: '—', badge: 'red' }
  const days = Math.floor((new Date(iso).getTime() - Date.now()) / 86400000)
  if (days < 0) return { label: `Expired ${fmtDate(iso)}`, badge: 'red' }
  if (days <= 30) return { label: `${fmtDate(iso)} (${days}d left)`, badge: 'red' }
  if (days <= 90) return { label: `${fmtDate(iso)} (${days}d left)`, badge: 'amber' }
  return { label: `${fmtDate(iso)} (${days}d left)`, badge: 'green' }
}

function fmtTime(iso: string | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`
}

export function AppHeader() {
  const { user, token, setAuth, clearAuth } = useAuth()
  const { activeSession, remainingSeconds, todaySummary } = useSession()
  const [modal, setModal] = useState<ModalType>(null)
  const [bankEditing, setBankEditing] = useState(false)
  const [bank, setBank] = useState<BankForm>(EMPTY_BANK)
  const [bankError, setBankError] = useState('')
  const [bankSaved, setBankSaved] = useState(false)
  const [bankSaving, setBankSaving] = useState(false)
  const navigate = useNavigate()

  const handleLogout = async () => {
    if (!window.confirm('Are you sure you want to logout?')) return
    try { await logout() } catch {}
    clearAuth()
    navigate('/login')
  }

  const openBankModal = () => {
    setBank({
      fullName: user?.account_holder_name ?? '',
      bankName: user?.bank_name ?? '',
      accountNo: user?.account_number ?? '',
      confirmAccountNo: '',
      ifscCode: user?.ifsc_code ?? '',
    })
    setBankEditing(false)
    setBankError('')
    setBankSaved(false)
    setModal('bank')
  }

  const handleBankEdit = () => { setBankError(''); setBankEditing(true) }

  const handleBankCancel = () => {
    setBank({
      fullName: user?.account_holder_name ?? '',
      bankName: user?.bank_name ?? '',
      accountNo: user?.account_number ?? '',
      confirmAccountNo: '',
      ifscCode: user?.ifsc_code ?? '',
    })
    setBankError('')
    setBankEditing(false)
  }

  const handleBankSave = async () => {
    setBankError('')
    if (!bank.fullName || !bank.bankName || !bank.accountNo || !bank.confirmAccountNo || !bank.ifscCode) {
      setBankError('All fields are required.')
      return
    }
    if (bank.accountNo !== bank.confirmAccountNo) {
      setBankError('Account numbers do not match.')
      return
    }
    setBankSaving(true)
    try {
      const res = await updateMyBank({
        account_holder_name: bank.fullName,
        bank_name: bank.bankName,
        account_number: bank.accountNo,
        ifsc_code: bank.ifscCode,
      })
      setAuth(token!, res.data.data)
      setBankSaved(true)
      setBankEditing(false)
      setTimeout(() => setBankSaved(false), 2000)
    } catch {
      setBankError('Failed to save. Please try again.')
    } finally {
      setBankSaving(false)
    }
  }

  const openModal = (m: ModalType) => setModal(m)
  const closeModal = () => { setModal(null); setBankError(''); setBankSaved(false); setBankEditing(false) }

  const showWarning = activeSession && remainingSeconds <= WARN_THRESHOLD_SECS && remainingSeconds > 0

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-4 h-14 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        {/* Left: Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-[9px] tracking-tighter">
            MMT
          </div>
          <span className="font-semibold text-gray-800 hidden sm:block">MMT Associate Software</span>
        </div>

        {/* Centre: Session info */}
        <div className="flex items-center gap-3 text-sm">
          {activeSession && <SessionTimer />}
          {todaySummary && (
            <>
              <span className="text-gray-300 hidden md:block">|</span>
              <span className="text-gray-500 hidden md:block">
                {Math.floor(todaySummary.total_elapsed_seconds / 60)}m used today
              </span>
            </>
          )}
        </div>

        {/* Right: action buttons */}
        <div className="flex items-center gap-0.5">
          <HeaderBtn label="Bank Details" icon={<Landmark size={15} />}  color="blue"   onClick={openBankModal} />
          <HeaderBtn label="Profile"      icon={<UserCircle size={15} />} color="violet" onClick={() => openModal('profile')} />
          <HeaderBtn label="Privacy"      icon={<ShieldCheck size={15} />} color="teal"  onClick={() => openModal('privacy')} />
          <div className="w-px h-6 bg-gray-200 mx-0.5 sm:mx-1" />
          <button
            onClick={handleLogout}
            className="flex flex-col items-center gap-0.5 px-2 sm:px-3 py-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-all group"
          >
            <LogOut size={15} className="group-hover:translate-x-0.5 transition-transform" />
            <span className="text-[10px] font-semibold hidden sm:block">Logout</span>
          </button>
        </div>
      </header>

      {/* Session warning banner */}
      {showWarning && (
        <div className={`px-4 py-2 text-center text-sm font-medium ${
          remainingSeconds <= 5 * 60 ? 'bg-red-500 text-white' : 'bg-amber-400 text-amber-900'
        }`}>
          ⚠️ Only {Math.ceil(remainingSeconds / 60)} minutes remaining in this session!
        </div>
      )}

      {/* ── Modals ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={closeModal}>
          <div className={`bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full flex flex-col ${modal === 'profile' ? 'sm:max-w-3xl' : modal === 'privacy' ? 'sm:max-w-2xl' : 'sm:max-w-md'} max-h-[90vh] overflow-hidden`} onClick={e => e.stopPropagation()}>

            {/* ── Privacy modal ── */}
            {modal === 'privacy' && (
              <>
                <div className="bg-gradient-to-br from-teal-500 to-teal-700 px-6 py-6 relative">
                  <button onClick={closeModal} className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors">
                    <X size={18} />
                  </button>
                  <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-3">
                    <ShieldCheck size={24} className="text-white" />
                  </div>
                  <h2 className="text-white text-lg font-bold">Privacy Policy</h2>
                  <p className="text-teal-100 text-xs mt-0.5">Your data protection rights</p>
                </div>
                <div className="px-6 py-5 text-sm text-gray-600 leading-relaxed grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <PolicyItem number={14}
                    kannada="ಪರಿಶೀಲನೆಗಿ ನಮಗೆ 2 ದಿನಗಳ ಅಗತ್ಯವಿದೆ. ಪರಿಶೀಲನೆಯ ನಂತರ ಪೇಮೆಂಟ್ ಗಾಗಿ ನಮಗೆ 1 ವಾರದ ಕಾಲವಕಾಶ ಬೇಕಾಗುತದೆ."
                    english="For verification we require 2 days. After verification, we require 1 week for payment processing."
                  />
                  <PolicyItem number={15}
                    kannada="ಡಿವೈಸ್ ರಿಸೇಟ್ ಅಥವ ಡಿವೈಸ್ ರೆಜಿಸ್ಟೇಷನ್ ಅಪ್ರುವಲ್ ಮಾಡಲು ನಮಗೆ ಕನಿಷ್ಠ 3 ದಿನಗಳ ಅಗತ್ಯವಿದೆ ಮತ್ತು ನಾವು ಕೇವಲ್ 3 ಬಾರಿ ಮಾತ್ರ ಡಿವೈಸ್ ರಿಸೇಟ್ ಅಥವ ರಿಜಿಸ್ಟೇಶನ್ ಅಪ್ರೂವಲ್ ಮಾಡಿಕೊಡಲಾಗುವುದು."
                    english="For device reset or device registration approval we require a minimum of 3 days. We will only process device reset or registration approval a maximum of 3 times."
                  />
                  <PolicyItem number={16}
                    kannada="ಹೊಸ ಪ್ರಾಜೆಕ್ಟ್ ಅನ್ನು ಸಂಜೆ 6 ರಿಂದ ರಾತ್ರಿ 9:00 ರ ಒಳಗಡೆ ಕಳುಹಿಸಲಾಗುತ್ತದೆ."
                    english="The new project will be sent between 6:00 PM to 9:00 PM (same day, if the new project request is received before 6:00 PM)."
                  />
                  <PolicyItem number={17}
                    kannada="ನೀವು ಸಂಜೆ 6:00 ಗಂಟೆಗಿಂತ ಮೊದಲು ಹೊಸ ಪ್ರಾಜೆಕ್ಟ್ ವರ್ಕ್ ವಿನಂತಿಯನ್ನು ಕಳುಹಿಸಬೇಕು. ಸಂಜೆ 6:00 ಗಂಟೆ ನಂತರ ಹೊಸ ಪ್ರಾಜೆಕ್ಟ್ ವಿನಂತಿ ಕಳುಹಿಸಿದರೆ, ಮರುದಿನ ಸಂಜೆ 6:00 ರಿಂದ ರಾತ್ರಿ 9:00 ರ ಒಳಗೆ ಹೊಸ ಪ್ರಾಜೆಕ್ಟ್ ವರ್ಕ್ ಕಳುಹಿಸಲಾಗುತ್ತದೆ."
                    english="You must send a new project work request before 6:00 PM. If you send a new project request after 6:00 PM, the new project will be sent the next day between 6:00 PM to 9:00 PM."
                  />
                </div>
                <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
                  <button onClick={closeModal} className="px-5 py-2 bg-teal-600 text-white text-sm font-medium rounded-xl hover:bg-teal-700 transition-colors">
                    Close
                  </button>
                </div>
              </>
            )}

            {/* ── Profile modal ── */}
            {modal === 'profile' && (
              <>
                <div className="bg-gradient-to-br from-violet-500 to-violet-700 px-6 py-5 relative">
                  <button onClick={closeModal} className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors">
                    <X size={18} />
                  </button>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-white/20 ring-2 ring-white/30 flex items-center justify-center text-white font-bold text-xl select-none">
                      {getInitials(user?.name)}
                    </div>
                    <div>
                      <h2 className="text-white text-lg font-bold leading-tight">{user?.name ?? '—'}</h2>
                      <span className="inline-flex items-center gap-1 bg-white/20 text-white text-[11px] font-semibold px-2 py-0.5 rounded-full mt-1">
                        <Hash size={10} />{user?.display_id ?? '—'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="px-6 py-4 overflow-y-auto flex-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <ProfileSection title="Member Details" color="text-violet-500">
                      <ProfileRow icon={<Hash size={13} />}       label="Member ID"     value={user?.display_id} />
                      <ProfileRow icon={<UserCircle size={13} />} label="Name"          value={user?.name} />
                      <ProfileRow icon={<Phone size={13} />}      label="Mobile"        value={user?.mobile} />
                      <ProfileRow icon={<Mail size={13} />}       label="Email"         value={user?.email ?? '—'} />
                      <ProfileRow icon={<Calendar size={13} />}   label="Date of Birth" value={fmtDate(user?.dob)} />
                    </ProfileSection>
                    <ProfileSection title="Address Details" color="text-teal-500">
                      <ProfileRow icon={<MapPin size={13} />}     label="Pincode"       value={user?.pincode || '—'} />
                      <ProfileRow icon={<MapPin size={13} />}     label="State"         value={user?.state || '—'} />
                      <ProfileRow icon={<MapPin size={13} />}     label="District"      value={user?.district || '—'} />
                      <ProfileRow icon={<MapPin size={13} />}     label="Taluk"         value={user?.taluk || '—'} />
                    </ProfileSection>
                    <ProfileSection title="Registration Details" color="text-slate-500">
                      <ProfileRow icon={<Calendar size={13} />}   label="Reg Date"      value={fmtDate(user?.created_at)} />
                      <ProfileRow icon={<Clock size={13} />}      label="Reg Time"      value={fmtTime(user?.created_at)} />
                      <ProfileRow icon={<UserCircle size={13} />} label="Reference"     value={user?.reference_name || '—'} />
                      <ProfileRow icon={<BadgeCheck size={13} />} label="Admin ID"      value={user?.approved_by_name || '—'} />
                      <ProfileRow icon={<BadgeCheck size={13} />} label="Reg Status"    value={user?.status === 'active' ? 'Approved' : (user?.status ?? '—')}
                        badge={user?.status === 'active' ? 'green' : user?.status === 'pending' ? 'amber' : 'red'} />
                      {(() => {
                        const vs = validityStatus(user?.credential_valid_until)
                        return <ProfileRow icon={<FileText size={13} />} label="Valid Until" value={vs.label} badge={vs.badge} />
                      })()}
                      <ProfileRow icon={<FileText size={13} />}   label="Proc Days"     value="40" />
                      <ProfileRow icon={<FileText size={13} />}   label="Max"           value="2500" />
                      <ProfileRow icon={<FileText size={13} />}   label="Min"           value="2500" />
                      <ProfileRow icon={<FileText size={13} />}   label="Version"       value="1" />
                    </ProfileSection>
                    <ProfileSection title="Bank Details" color="text-blue-500">
                      {user?.account_number ? (
                        <>
                          <ProfileRow icon={<UserCircle size={13} />} label="Account Name" value={user.account_holder_name || '—'} />
                          <ProfileRow icon={<Building2 size={13} />}  label="Bank Name"    value={user.bank_name || '—'} />
                          <ProfileRow icon={<CreditCard size={13} />} label="Account No"   value={`****${user.account_number.slice(-4)}`} />
                          <ProfileRow icon={<KeyRound size={13} />}   label="IFSC Code"    value={user.ifsc_code || '—'} />
                        </>
                      ) : (
                        <p className="text-xs text-gray-400 py-4 text-center">Not added yet. Use Bank Details to add.</p>
                      )}
                    </ProfileSection>
                  </div>
                  <div className="flex items-start gap-2 bg-blue-50 rounded-xl px-4 py-3 mt-4">
                    <Info size={13} className="text-blue-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-blue-600">To update profile details, please contact your admin.</p>
                  </div>
                </div>
                <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
                  <button onClick={closeModal} className="px-5 py-2 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 transition-colors">
                    Close
                  </button>
                </div>
              </>
            )}

            {/* ── Bank Details modal ── */}
            {modal === 'bank' && (
              <>
                <div className="bg-gradient-to-br from-blue-600 to-blue-800 px-6 py-6 relative">
                  <button onClick={closeModal} className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors">
                    <X size={18} />
                  </button>
                  <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-3">
                    <Landmark size={24} className="text-white" />
                  </div>
                  <h2 className="text-white text-lg font-bold">Bank Details</h2>
                  <p className="text-blue-200 text-xs mt-0.5">Your linked bank account</p>
                </div>

                {/* VIEW mode */}
                {!bankEditing && (() => {
                  const hasBank = !!user?.account_number
                  return hasBank ? (
                    <>
                      {bankSaved && (
                        <div className="mx-6 mt-4 flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
                          <BadgeCheck size={15} className="text-green-500 shrink-0" />
                          <p className="text-green-700 text-xs font-medium">Bank details saved successfully!</p>
                        </div>
                      )}
                      {/* Bank card */}
                      <div className="mx-6 mt-4 bg-gradient-to-br from-slate-700 to-slate-900 rounded-2xl p-5 text-white shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <Building2 size={16} className="text-slate-300" />
                            <span className="text-slate-300 text-xs font-semibold uppercase tracking-wider">{user?.bank_name}</span>
                          </div>
                          <CreditCard size={20} className="text-slate-400" />
                        </div>
                        <p className="text-lg font-mono tracking-widest text-white/90 mb-4">
                          {'•'.repeat(Math.max(0, (user?.account_number?.length ?? 0) - 4)).replace(/(.{4})/g, '$1 ').trim()} {user?.account_number?.slice(-4)}
                        </p>
                        <div className="flex items-end justify-between">
                          <div>
                            <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-0.5">Account Holder</p>
                            <p className="text-white text-sm font-semibold">{user?.account_holder_name}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-0.5">IFSC</p>
                            <p className="text-white text-sm font-mono font-semibold">{user?.ifsc_code}</p>
                          </div>
                        </div>
                      </div>
                      <div className="px-6 py-4 flex justify-end gap-2 border-t border-gray-100 mt-4">
                        <button onClick={closeModal} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200">
                          Close
                        </button>
                        <button onClick={handleBankEdit} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
                          <Pencil size={13} /> Edit
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="px-6 py-8 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
                          <Landmark size={28} className="text-blue-300" />
                        </div>
                        <p className="text-gray-700 font-medium">No bank details found</p>
                        <p className="text-xs text-gray-400 mt-1">Add your bank details to get started.</p>
                      </div>
                      <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
                        <button onClick={closeModal} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors">
                          Close
                        </button>
                        <button onClick={handleBankEdit} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
                          <Landmark size={13} /> Add Details
                        </button>
                      </div>
                    </>
                  )
                })()}

                {/* EDIT mode */}
                {bankEditing && (
                  <>
                    <div className="px-6 py-5 space-y-3">
                      <BankField icon={<UserCircle size={14} />}  label="Full Name"              value={bank.fullName}         onChange={v => setBank(b => ({ ...b, fullName: v }))}         placeholder="As per bank records" />
                      <BankField icon={<Building2 size={14} />}   label="Bank Name"              value={bank.bankName}         onChange={v => setBank(b => ({ ...b, bankName: v }))}         placeholder="e.g. State Bank of India" />
                      <BankField icon={<CreditCard size={14} />}  label="Account Number"         value={bank.accountNo}        onChange={v => setBank(b => ({ ...b, accountNo: v }))}        placeholder="Enter account number" type="password" />
                      <BankField icon={<CreditCard size={14} />}  label="Confirm Account Number" value={bank.confirmAccountNo} onChange={v => setBank(b => ({ ...b, confirmAccountNo: v }))} placeholder="Re-enter account number" />
                      <BankField icon={<KeyRound size={14} />}    label="IFSC Code"              value={bank.ifscCode}         onChange={v => setBank(b => ({ ...b, ifscCode: v.toUpperCase() }))} placeholder="e.g. SBIN0001234" />
                      {bankError && (
                        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                          <X size={13} className="text-red-500 shrink-0" />
                          <p className="text-red-600 text-xs">{bankError}</p>
                        </div>
                      )}
                    </div>
                    <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
                      <button onClick={handleBankCancel} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors">
                        Cancel
                      </button>
                      <button onClick={handleBankSave} disabled={bankSaving} className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm">
                        {bankSaving ? 'Saving…' : 'Save Details'}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

          </div>
        </div>
      )}
    </>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

const colorMap = {
  blue:   'text-blue-500 hover:bg-blue-50 hover:text-blue-700',
  violet: 'text-violet-500 hover:bg-violet-50 hover:text-violet-700',
  teal:   'text-teal-500 hover:bg-teal-50 hover:text-teal-700',
}

function HeaderBtn({ label, icon, color, onClick }: { label: string; icon: React.ReactNode; color: keyof typeof colorMap; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 px-2 sm:px-3 py-1.5 rounded-lg transition-all group ${colorMap[color]}`}
    >
      <span className="group-hover:scale-110 transition-transform">{icon}</span>
      <span className="text-[10px] font-semibold hidden sm:block">{label}</span>
    </button>
  )
}

function ProfileRow({ icon, label, value, badge }: { icon: React.ReactNode; label: string; value: string | undefined; badge?: 'green' | 'amber' | 'red' }) {
  const badgeColors = { green: 'bg-green-100 text-green-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-600' }
  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
      <span className="text-gray-400 shrink-0">{icon}</span>
      <span className="text-xs text-gray-400 w-24 shrink-0">{label}</span>
      {badge ? (
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${badgeColors[badge]}`}>{value ?? '—'}</span>
      ) : (
        <span className="text-sm font-medium text-gray-800">{value ?? '—'}</span>
      )}
    </div>
  )
}

function ProfileSection({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div>
      <p className={`text-[10px] font-bold uppercase tracking-widest ${color} mb-2`}>{title}</p>
      <div className="bg-gray-50 rounded-xl px-4 py-1">{children}</div>
    </div>
  )
}

function BankField({ icon, label, value, onChange, placeholder, type = 'text' }: {  icon: React.ReactNode; label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1.5">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</span>
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 focus:bg-white transition-colors"
        />
      </div>
    </div>
  )
}

function PolicyItem({ number, kannada, english }: { number: number; kannada: string; english: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 text-xs font-bold flex items-center justify-center shrink-0">
          {number}
        </span>
        <span className="text-xs font-semibold text-teal-700 uppercase tracking-wide">Point {number}</span>
      </div>
      <p className="text-sm text-gray-700 leading-relaxed">{kannada}</p>
      <p className="text-xs text-gray-500 leading-relaxed border-t border-gray-200 pt-2 italic">{english}</p>
    </div>
  )
}
