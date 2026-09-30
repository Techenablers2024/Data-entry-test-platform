import logoUrl from '../../assets/logo.png'
import { useSession } from '../../context/SessionContext'
import { useAuth } from '../../context/AuthContext'
import { logout, updateMyBank } from '../../api/auth'
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { WARN_THRESHOLD_SECS, CRITICAL_THRESHOLD_SECS } from '../../lib/constants'
import { formatSeconds } from '../../lib/utils'
import { LogOut, UserCircle, Landmark, X, BadgeCheck, Pencil, CreditCard, Building2, KeyRound, ShieldCheck } from 'lucide-react'

type ModalType = 'privacy' | 'profile' | 'bank' | null

interface BankForm {
  fullName: string
  bankName: string
  accountNo: string
  confirmAccountNo: string
  ifscCode: string
}

const EMPTY_BANK: BankForm = { fullName: '', bankName: '', accountNo: '', confirmAccountNo: '', ifscCode: '' }

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
  const [logoutConfirm, setLogoutConfirm] = useState(false)
  const navigate = useNavigate()

  const handleLogout = async () => {
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

  const [toastVisible, setToastVisible] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const [toastCritical, setToastCritical] = useState(false)
  const shownThresholds = useRef<Set<string>>(new Set())
  const lastSessionId = useRef<string | null>(null)

  useEffect(() => {
    if (!activeSession || remainingSeconds <= 0) return

    // New session loaded — reset thresholds and skip this tick to let data settle
    if (activeSession.id !== lastSessionId.current) {
      lastSessionId.current = activeSession.id
      shownThresholds.current.clear()
      return
    }

    const key = remainingSeconds <= CRITICAL_THRESHOLD_SECS ? 'critical' : remainingSeconds <= WARN_THRESHOLD_SECS ? 'warn' : null
    if (!key || shownThresholds.current.has(key)) return
    shownThresholds.current.add(key)
    setToastMsg(`Only ${Math.ceil(remainingSeconds / 60)} minutes remaining in this session!`)
    setToastCritical(key === 'critical')
    setToastVisible(true)
    const t = setTimeout(() => setToastVisible(false), 6000)
    return () => clearTimeout(t)
  }, [remainingSeconds, activeSession])

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-4 min-h-16 h-auto py-2 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        {/* Left: Logo + Brand */}
        <div className="flex items-center gap-3">
          <img src={logoUrl} alt="MMT" className="w-14 h-14 rounded-xl object-cover shrink-0" />
          <div className="hidden sm:flex items-center">
            <span className="font-bold text-xl lg:text-3xl leading-none text-gray-700 whitespace-nowrap">MMT Associate Software</span>
          </div>
        </div>

        {/* Centre: Session timing widget */}
        <div className="hidden sm:flex">
          {activeSession ? (
            <div className="bg-white border border-teal-400 shadow-sm rounded-xl p-1.5 flex gap-1.5">
              <div className="flex-1 bg-teal-50 border border-teal-300 rounded-lg px-4 py-2.5 text-center">
                <p className="text-teal-600 text-[10px] font-bold uppercase tracking-widest mb-1 whitespace-nowrap">Session Time Left</p>
                <p className={`text-xl font-bold font-mono tabular-nums leading-none ${
                  remainingSeconds <= CRITICAL_THRESHOLD_SECS ? 'text-red-500 animate-pulse' :
                  remainingSeconds <= WARN_THRESHOLD_SECS     ? 'text-amber-500' : 'text-emerald-500'
                }`}>
                  {formatSeconds(remainingSeconds)}
                </p>
              </div>
              <div className="flex-1 bg-teal-50 border border-teal-300 rounded-lg px-4 py-2.5 text-center">
                <p className="text-teal-600 text-[10px] font-bold uppercase tracking-widest mb-1">
                  Session {activeSession.session_number}/2
                </p>
                <p className="text-gray-800 text-base font-bold leading-none">
                  {todaySummary ? `${Math.floor(todaySummary.total_elapsed_seconds / 60)}m used` : '—'}
                </p>
              </div>
            </div>
          ) : todaySummary ? (
            <div className="bg-white border border-teal-200 shadow-sm rounded-xl p-1.5">
              <div className="bg-teal-50 rounded-lg px-4 py-1.5 text-center">
                <p className="text-teal-600 text-[10px] font-bold uppercase tracking-widest mb-1">Used Today</p>
                <p className="text-gray-800 text-base font-bold leading-none">
                  {Math.floor(todaySummary.total_elapsed_seconds / 60)}m
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Right: action buttons */}
        <div className="flex items-center gap-1">
          <HeaderBtn label="Bank Details" icon={<Landmark size={34} />}    color="teal"   onClick={openBankModal} />
          <HeaderBtn label="Profile"      icon={<UserCircle size={34} />}  color="teal"   onClick={() => openModal('profile')} />
          <HeaderBtn label="Privacy"      icon={<ShieldCheck size={34} />} color="teal"   onClick={() => openModal('privacy')} />
          <div className="w-px h-8 bg-gray-200 mx-1" />
          <button
            onClick={() => setLogoutConfirm(true)}
            className="flex flex-col items-center gap-0.5 px-3 sm:px-4 py-1.5 rounded-xl border border-red-300 text-red-400 hover:bg-red-50 hover:text-red-600 transition-all group"
          >
            <LogOut size={34} className="group-hover:translate-x-0.5 transition-transform" />
            <span className="text-sm font-extrabold hidden sm:block">Logout</span>
          </button>
        </div>
      </header>

      {/* Logout confirmation dialog */}
      {logoutConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setLogoutConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl px-8 py-6 w-80 text-center" onClick={e => e.stopPropagation()}>
            <p className="text-lg font-bold text-gray-800 mb-1">Log out?</p>
            <p className="text-sm font-semibold text-gray-800 mb-6">Are you sure you want to log out?</p>
            <div className="flex gap-3">
              <button onClick={() => setLogoutConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleLogout}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors">
                Log out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session warning toast */}
      {toastVisible && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold transition-all animate-bounce-once ${
          toastCritical ? 'bg-red-500 text-white' : 'bg-amber-400 text-amber-900'
        }`}>
          ⚠️ {toastMsg}
          <button onClick={() => setToastVisible(false)} className="ml-2 opacity-60 hover:opacity-100"><X size={14} /></button>
        </div>
      )}

      {/* ── Modals ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={closeModal}>
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full flex flex-col overflow-hidden"
            style={{
              height: undefined,
              maxHeight: '92vh',
              maxWidth: modal === 'profile' ? '1100px' : modal === 'privacy' ? '900px' : '680px',
            }}
            onClick={e => e.stopPropagation()}
          >

            {/* ── Privacy modal ── */}
            {modal === 'privacy' && (
              <>
                {/* Title bar */}
                <div className="bg-slate-800 px-5 py-3 flex items-center justify-between shrink-0">
                  <h2 className="text-white font-bold text-sm tracking-widest uppercase">MMT (Privacy Policy)</h2>
                  <button onClick={closeModal} className="text-white/60 hover:text-white transition-colors">
                    <X size={18} />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 p-3 bg-gray-100 overflow-y-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <PolicyItem number={1}
                      kannada="ವಯಸ್ಸಿನ ಮಿತಿಯು 18 ಅಥವಾ ಹೆಚ್ಚಿನದಾಗಿರಬೇಕು. ಈ ಉದ್ಯೋಗವನ್ನು ಮಾಡಲು ಕಡ್ಡಾಯವಾಗಿ 18 ವಯಸ್ಸು ತುಂಬಿರಬೇಕು. ನೋಂದಣ್ಣಿಯ ಸಂದರ್ಭದಲ್ಲಿ ವಯೋಮಿತಿಯನ್ನು ದೃಢಪಡಿಸಲು ಯಾವುದಾದರೂ ಒಂದು ದಾಖಲಾತಿಯನ್ನು ಸಂಸ್ಥೆಗೆ ಸಲ್ಲಿಸಬೇಕು."
                      english="The age limit must be 18 or more. You must be 18 years of age to do this job and submit a document to the organization to confirm the age limit at the time of registration."
                    />
                    <PolicyItem number={2}
                      kannada="ನೋಂದಣಿ ಉಚಿತವಾಗಿರುತ್ತದೆ. ಈ ಸಂಸ್ಥೆಯಲ್ಲಿ ಕೆಲಸ ಪಡೆಯಲು ಯಾವುದೇ ರೀತಿಯ ನೋಂದಣಿ ಶುಲ್ಕ ಇರುವುದಿಲ್ಲ. ಆದರೆ ಉದ್ಯೋಗ ಮಾಡಲು ಬೇಕಾದ ಸಾಫ್ಟ್‌ವೇರ್ ಅಥವಾ ಅಪ್ಲಿಕೇಶನ್ ಅನ್ನು ನೊಂದಾಯಿತ ವ್ಯಕ್ತಿಯು ಕೆ.ಎಸ್.ಸಲ್ಯೂಷನ್ ಕಂಪನಿಯಿಂದ ಖರೀದಿಸಬೇಕಾಗುತ್ತದೆ. ಈ ಸಾಫ್ಟ್‌ವೇರ್ ಕೇವಲ ಒಂದು ವರ್ಷಕ್ಕೆ ಸೀಮಿತವಾಗಿದ್ದು ಕೇವಲ ನೋಂದಣಿ ಸಂಖ್ಯೆಗೆ ಮಾತ್ರ ಅನ್ವಯಿಸುತ್ತದೆ."
                      english="Registration is free. There is no registration fee to get a job in this organisation. But the required software or application needs to be purchased from K.S. Solutions online or offline. The software is valid for one year only and applies only to the registered member ID."
                    />
                    <PolicyItem number={3}
                      kannada="ನೋಂದಣಿಯು ಒಂದು ವರ್ಷಕ್ಕೆ ಸೀಮಿತವಾಗಿರುತ್ತದೆ. ನೋಂದಣಿಯಾದ ವ್ಯಕ್ತಿಗೆ ಸಂಸ್ಥೆಯು ಒಂದು ವರ್ಷಗಳ ಕಾಲ ಉದ್ಯೋಗವನ್ನು ನೀಡುತ್ತದೆ."
                      english="Registration is valid for one year. The organisation offers jobs to the registered person for a period of one year only."
                    />
                    <PolicyItem number={4}
                      kannada="ಸಾಫ್ಟ್‌ವೇರ್ ಅಥವಾ ಅಪ್ಲಿಕೇಶನ್ ಖರೀದಿಗಾಗಿ ಕೆ.ಎಸ್.ಸಲ್ಯೂಷನ್ ಕಂಪನಿಗೆ ಪಾವತಿಸಿರುವ ಹಣವನ್ನು ಯಾವುದೇ ಕಾರಣಕ್ಕೂ ಮರುಪಾವತಿ ಮಾಡಲಾಗುವುದಿಲ್ಲ."
                      english="The money paid to K.S. Solutions for the purchase of software or application is not refundable for any reason."
                    />
                    <PolicyItem number={5}
                      kannada="ಪರಿಶೀಲನೆ ಅಥವಾ ಸಲ್ಲಿಕೆಗಾಗಿ ನೀವು 2500 ಫಾರ್ಮ್‌ಗಳನ್ನು ಪೂರ್ಣಗೊಳಿಸಬೇಕು. ಸಂಸ್ಥೆಯಿಂದ ಪಡೆದ 2500 ಫಾರ್ಮ್‌ಗಳನ್ನು ಪೂರ್ಣಗೊಳಿಸಿದಲ್ಲಿ ಮಾತ್ರ ಪರಿಶೀಲನೆಗೆ ಒಳಪಡುತ್ತದೆ. 2500 ಕ್ಕಿಂತ ಕಡಿಮೆ ಫಾರ್ಮ್ ಭರ್ತಿ ಮಾಡಿದಲ್ಲಿ ಅದು ಪರಿಶೀಲನೆಗೆ ಮಾನ್ಯವಾಗುವುದಿಲ್ಲ."
                      english="For verification you must complete all 2500 forms. Only after completing all 2500 forms will it be eligible for verification. Less than 2500 forms will not be valid for verification."
                    />
                    <PolicyItem number={6}
                      kannada="ಪೂರ್ಣಗೊಂಡ ಫಾರ್ಮ್‌ನಲ್ಲಿ ಒಂದೇ ಒಂದು ತಪ್ಪನ್ನು ಹೊಂದಿದರೆ ಅದನ್ನು ಪರಿಗಣಿಸಲಾಗುವುದಿಲ್ಲ ಮತ್ತು ಆ ಫಾರ್ಮ್ ಅನ್ನು ತಿರಸ್ಕರಿಸಲಾಗುತ್ತದೆ."
                      english="If the completed form contains even a single mistake, it will not be counted and that form will be rejected."
                    />
                    <PolicyItem number={7}
                      kannada="ಪಾವತಿಯು ಸರಿಯಾದ ಫಾರ್ಮ್‌ಗಳು ಮತ್ತು ದೋಷಮಟ್ಟವನ್ನು ಅವಲಂಬಿಸಿದೆ, ಒಟ್ಟು ಅಪ್‌ಲೋಡ್ ಮಾಡಿದ ಫಾರ್ಮ್‌ಗಳ ಮೇಲೆ ಅಲ್ಲ."
                      english="Payment depends on correct forms and error level, not on total uploaded forms."
                    />
                    <PolicyItem number={8}
                      kannada="ಫಾರ್ಮ್‌ಗಳನ್ನು ಡೌನ್‌ಲೋಡ್ ಮಾಡಲು ಮತ್ತು ಅಪ್‌ಲೋಡ್ ಮಾಡಲು ನಮ್ಮ ಸಾಫ್ಟ್‌ವೇರ್ ಅಥವಾ ಅಪ್ಲಿಕೇಶನ್‌ಗೆ 15 ರಿಂದ 60 ಸೆಕೆಂಡುಗಳ ಅಗತ್ಯವಿದೆ."
                      english="Our application requires 15 to 60 seconds to download and upload forms."
                    />
                    <PolicyItem number={9}
                      kannada="2500 ಫಾರ್ಮ್‌ಗಳನ್ನು ಪೂರ್ಣಗೊಳಿಸಲು ಅನುಮತಿಸಲಾದ ಕನಿಷ್ಠ 15 ದಿನಗಳು ಹಾಗೂ ಗರಿಷ್ಠ ಸಮಯದ ಮಿತಿ 40 ದಿನಗಳು. 40ನೇ ದಿನದ ಮಧ್ಯರಾತ್ರಿ ನಿಮ್ಮ ಪ್ರಾಜೆಕ್ಟ್ ವರ್ಕ್ ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಅಂತ್ಯಗೊಳ್ಳುತ್ತದೆ."
                      english="The minimum time to complete 2500 forms is 15 days and the maximum is 40 days. Your project work will automatically end at midnight on the 40th day."
                    />
                    <PolicyItem number={10}
                      kannada="ಪ್ರತಿ ದಿನ ಕೆಲಸ ಮಾಡಲು 8 ಗಂಟೆಗಳ ಕಾಲ ಮಾತ್ರ ಅವಕಾಶವಿರುತ್ತದೆ. ಈ 8 ಗಂಟೆಯನ್ನು ಎರಡು ಶಿಫ್ಟ್‌ಗಳಾಗಿ (4hrs + 4hrs) ವಿಂಗಡಿಸಲಾಗಿದೆ. ಒಮ್ಮೆ ಶಿಫ್ಟ್ ಶುರು ಮಾಡಿದ ನಂತರ ನೀವು ನಿರಂತರವಾಗಿ 4 ಗಂಟೆಗಳ ಕಾಲ ಕೆಲಸ ಮಾಡಬೇಕು. 4 ಗಂಟೆಗಳ ನಂತರ ನಿಮ್ಮ ಶಿಫ್ಟ್ ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಕೊನೆಗೊಳ್ಳುತ್ತದೆ. ಪ್ರತಿದಿನ ಎರಡು ಶಿಫ್ಟ್‌ಗಳನ್ನು ಯಾವುದೇ ಸಮಯದಲ್ಲಿ ಮಾಡಬಹುದು."
                      english="Only 8 hours are allowed to work every day, divided into two shifts (4hrs + 4hrs). Once a shift starts you must work continuously for 4 hours. Your shift will automatically end after 4 hours. You can do two shifts daily at any time."
                    />
                    <PolicyItem number={11}
                      kannada="ಮೊದಲಿನ 500 ಫಾರ್ಮ್‌ಗಳನ್ನು ಪೂರ್ಣಗೊಳಿಸಿದ ನಂತರ ರಿಪೋರ್ಟ್ ನಿಮಗೆ ನೀಡಲಾಗುವುದು, ಇದರಿಂದ ನಿಮ್ಮ ಪ್ರಾಜೆಕ್ಟ್ ನಿಖರತೆಯನ್ನು ತಿಳಿಯಲು ಸಹಾಯವಾಗುತ್ತದೆ. ಈ ರಿಪೋರ್ಟ್‌ನಲ್ಲಿ ತಪ್ಪುಗಳು ಹೆಚ್ಚಾಗಿ ಕಂಡು ಬಂದಲ್ಲಿ ನೀವು ಪ್ರಸ್ತುತ ಪ್ರಾಜೆಕ್ಟ್ ಅನ್ನು ಕೊನೆಗೊಳಿಸಿ ಹೊಸ ಪ್ರಾಜೆಕ್ಟ್ ಅನ್ನು ಪ್ರಾರಂಭಿಸಬಹುದು."
                      english="After completing the first 500 forms, a report will be given to help you know your project accuracy. If there are too many errors, you can end the current project and start a new one."
                    />
                    <PolicyItem number={12}
                      kannada="ಕಂಪನಿಯು ಪಾರದರ್ಶಕತೆಯನ್ನು ಹೊಂದಿರುವುದರಿಂದ ನೀವು ಮಾಡುವ ಪ್ರಾಜೆಕ್ಟ್ ಅನ್ನು ನಿಮ್ಮ ಕಂಪ್ಯೂಟರ್ ಅಥವಾ ಮೊಬೈಲ್ ಮೂಲಕ ಸ್ಕ್ರೀನ್ ರೆಕಾರ್ಡಿಂಗ್ ಮಾಡಿಕೊಳ್ಳಬಹುದು."
                      english="Since the company maintains transparency, you can screen record the project you are doing through your computer or mobile using the software or application."
                    />
                    <PolicyItem number={13}
                      kannada="ಸಾಫ್ಟ್‌ವೇರ್ ಮತ್ತು ಅಪ್ಲಿಕೇಶನ್ ಕೇವಲ ಒಂದು ಕಂಪ್ಯೂಟರ್ ಅಥವಾ ಒಂದು ಮೊಬೈಲ್‌ಗೆ ಮಾತ್ರ ಸೀಮಿತವಾಗಿರುತ್ತದೆ. ಒಂದೇ ಡಿವೈಸ್ ಅನ್ನು ಬಳಸಿ ಎಷ್ಟು ಜನ ಬೇಕಾದರೂ ಉದ್ಯೋಗವನ್ನು ಮಾಡಬಹುದು."
                      english="Software or application is limited to only one computer or one mobile. Using a single device, multiple users can work."
                    />
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
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-gray-100 flex justify-end shrink-0">
                  <button onClick={closeModal} className="px-5 py-2 bg-teal-700 text-white text-sm font-medium rounded-xl hover:bg-teal-800 transition-colors">
                    Close
                  </button>
                </div>
              </>
            )}

            {/* ── Profile modal ── */}
            {modal === 'profile' && (
              <>
                {/* Title bar */}
                <div className="bg-slate-800 px-5 py-3 flex items-center justify-between shrink-0">
                  <h2 className="text-white font-bold text-sm tracking-widest uppercase">MMT (Member Profile)</h2>
                  <button onClick={closeModal} className="text-white/60 hover:text-white transition-colors">
                    <X size={18} />
                  </button>
                </div>

                {/* Card body */}
                <div className="flex-1 p-3 bg-gray-100 flex flex-col overflow-y-auto">
                  <div className="flex gap-3 flex-1 text-sm">

                    {/* ── Left column ── */}
                    <div className="flex-1 flex flex-col gap-3">

                      {/* Member Details box */}
                      <div className="border border-teal-400 rounded overflow-hidden shadow-sm bg-white">
                        <div className="bg-teal-600 text-white text-center py-1.5 font-bold tracking-wide">
                          Member Details
                        </div>
                        {[
                          { label: 'Mem ID',    value: user?.display_id },
                          { label: 'Name',      value: user?.name },
                          { label: 'Mobile No', value: user?.mobile ? 'X'.repeat(Math.max(0, user.mobile.length - 4)) + user.mobile.slice(-4) : '—' },
                          { label: 'Email ID',  value: user?.email || '—' },
                          { label: 'DOB',       value: fmtDate(user?.dob) },
                        ].map(r => (
                          <div key={r.label} className="flex border-b border-gray-100 last:border-b-0">
                            <span className="w-24 shrink-0 px-3 py-2 font-bold text-gray-900 bg-gray-50 border-r border-gray-100">{r.label}</span>
                            <span className="flex-1 px-3 py-2 text-gray-900 font-bold">{r.value ?? '—'}</span>
                          </div>
                        ))}
                      </div>

                      {/* Address Details box */}
                      <div className="border border-teal-400 rounded overflow-hidden shadow-sm bg-white">
                        <div className="bg-teal-600 text-white text-center py-1.5 font-bold tracking-wide">
                          Address Details
                        </div>
                        {[
                          { label: 'Pincode',  value: user?.pincode  || '—' },
                          { label: 'State',    value: user?.state    || '—' },
                          { label: 'District', value: user?.district || '—' },
                          { label: 'Taluk',    value: user?.taluk    || '—' },
                        ].map(r => (
                          <div key={r.label} className="flex border-b border-gray-100 last:border-b-0">
                            <span className="w-24 shrink-0 px-3 py-2 font-bold text-gray-900 bg-gray-50 border-r border-gray-100">{r.label}</span>
                            <span className="flex-1 px-3 py-2 text-gray-900 font-bold">{r.value}</span>
                          </div>
                        ))}
                      </div>

                      {/* Red warning box */}
                      <div className="border border-red-200 rounded bg-red-50 px-3 py-2.5 shadow-sm">
                        <p className="text-red-600 italic text-center leading-relaxed text-[11px]">
                          Name and mobile number cannot be changed. If there is any mistake in other details, please contact your admin if required.
                        </p>
                      </div>

                    </div>

                    {/* ── Right column ── */}
                    <div className="w-2/5 shrink-0 flex flex-col gap-3">

                      {/* Logo box */}
                      <div className="border border-teal-400 rounded overflow-hidden shadow-sm bg-white flex justify-center items-center py-5">
                        <img src={logoUrl} alt="MMT" className="w-20 h-20 rounded-xl object-cover shadow" />
                      </div>

                      {/* Registration Details box */}
                      <div className="border border-teal-400 rounded overflow-hidden shadow-sm bg-white flex-1 flex flex-col">
                        <div className="bg-teal-600 text-white text-center py-1.5 font-bold tracking-wide shrink-0">
                          Registration Details
                        </div>
                        {(() => {
                          const vs = validityStatus(user?.credential_valid_until)
                          return [
                            { label: 'DOR',        value: fmtDate(user?.created_at) },
                            { label: 'TOR',        value: fmtTime(user?.created_at) },
                            { label: 'Ref ID',     value: user?.reference_name || '0' },
                            { label: 'Admin ID',   value: user?.approved_by_name || '—' },
                            { label: 'R Status',   value: user?.status === 'active' ? 'Approved' : (user?.status ?? '—') },
                            { label: 'Valid Until', value: vs.label },
                            { label: 'Pro Days',   value: '40 days' },
                            { label: 'Min Qty',    value: '2500' },
                            { label: 'Max Qty',    value: '2500' },
                            { label: 'Version',    value: '1' },
                          ].map(r => (
                            <div key={r.label} className="flex border-b border-gray-100 last:border-b-0">
                              <span className="w-24 shrink-0 px-3 py-2 font-bold text-gray-900 bg-gray-50 border-r border-gray-100">{r.label}</span>
                              <span className="flex-1 px-3 py-2 text-gray-900 font-bold">{r.value}</span>
                            </div>
                          ))
                        })()}
                      </div>

                    </div>

                  </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-gray-100 flex justify-end shrink-0">
                  <button onClick={closeModal} className="px-5 py-2 bg-teal-700 text-white text-sm font-medium rounded-xl hover:bg-teal-800 transition-colors">
                    Close
                  </button>
                </div>
              </>
            )}

            {/* ── Bank Details modal ── */}
            {modal === 'bank' && (
              <>
                {/* Title bar */}
                <div className="bg-slate-800 px-5 py-3 flex items-center justify-between shrink-0">
                  <h2 className="text-white font-bold text-sm tracking-widest uppercase">MMT (Bank Details)</h2>
                  <button onClick={closeModal} className="text-white/60 hover:text-white transition-colors">
                    <X size={18} />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 p-3 bg-gray-100 overflow-y-auto flex flex-col gap-3">
                  {bankSaved && (
                    <div className="border border-green-300 rounded overflow-hidden bg-green-50 px-4 py-2.5 flex items-center gap-2 text-xs shadow-sm">
                      <BadgeCheck size={14} className="text-green-500 shrink-0" />
                      <p className="text-green-700 font-medium">Bank details saved successfully!</p>
                    </div>
                  )}

                  {!bankEditing ? (
                    /* VIEW mode */
                    user?.account_number ? (
                      <div className="border border-teal-400 rounded overflow-hidden shadow-sm bg-white text-sm font-medium">
                        <div className="bg-teal-600 text-white text-center py-2 font-bold tracking-wide text-sm">
                          Account Details
                        </div>
                        {[
                          { label: 'Account Name', value: user.account_holder_name || '—' },
                          { label: 'Bank Name',    value: user.bank_name || '—' },
                          { label: 'Account No',   value: '•'.repeat(Math.max(0, (user.account_number?.length ?? 0) - 4)) + user.account_number.slice(-4) },
                          { label: 'IFSC Code',    value: user.ifsc_code || '—' },
                        ].map(r => (
                          <div key={r.label} className="flex border-b border-gray-100 last:border-b-0">
                            <span className="w-36 shrink-0 px-4 py-3 font-bold text-gray-700 bg-gray-50 border-r border-gray-100">{r.label}</span>
                            <span className="flex-1 px-4 py-3 text-gray-900 font-bold font-mono">{r.value}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="border border-teal-300 rounded overflow-hidden bg-white px-4 py-8 text-center shadow-sm">
                        <Landmark size={28} className="text-teal-300 mx-auto mb-3" />
                        <p className="text-gray-700 font-medium text-sm">No bank details found</p>
                        <p className="text-xs text-gray-400 mt-1">Click Add Details to link your account.</p>
                      </div>
                    )
                  ) : (
                    /* EDIT mode */
                    <div className="border border-teal-400 rounded overflow-hidden shadow-sm bg-white text-sm">
                      <div className="bg-teal-600 text-white text-center py-2 font-bold tracking-wide">
                        {user?.account_number ? 'Edit Bank Details' : 'Add Bank Details'}
                      </div>
                      <div className="p-4 space-y-3">
                        <BankField icon={<UserCircle size={14} />}  label="Full Name"              value={bank.fullName}         onChange={v => setBank(b => ({ ...b, fullName: v }))}         placeholder="As per bank records" />
                        <BankField icon={<Building2 size={14} />}   label="Bank Name"              value={bank.bankName}         onChange={v => setBank(b => ({ ...b, bankName: v }))}         placeholder="e.g. State Bank of India" />
                        <BankField icon={<CreditCard size={14} />}  label="Account Number"         value={bank.accountNo}        onChange={v => setBank(b => ({ ...b, accountNo: v }))}        placeholder="Enter account number" type="password" />
                        <BankField icon={<CreditCard size={14} />}  label="Confirm Account Number" value={bank.confirmAccountNo} onChange={v => setBank(b => ({ ...b, confirmAccountNo: v }))} placeholder="Re-enter account number" />
                        <BankField icon={<KeyRound size={14} />}    label="IFSC Code"              value={bank.ifscCode}         onChange={v => setBank(b => ({ ...b, ifscCode: v.toUpperCase() }))} placeholder="e.g. SBIN0001234" />
                        {bankError && (
                          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded px-3 py-2">
                            <X size={13} className="text-red-500 shrink-0" />
                            <p className="text-red-600 text-xs">{bankError}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2 shrink-0">
                  {!bankEditing ? (
                    <>
                      <button onClick={closeModal} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors">
                        Close
                      </button>
                      <button onClick={handleBankEdit} className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-xl hover:bg-teal-700 transition-colors">
                        {user?.account_number ? <><Pencil size={13} /> Edit</> : <><Landmark size={13} /> Add Details</>}
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={handleBankCancel} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors">
                        Cancel
                      </button>
                      <button onClick={handleBankSave} disabled={bankSaving} className="px-5 py-2 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-colors">
                        {bankSaving ? 'Saving…' : 'Save Details'}
                      </button>
                    </>
                  )}
                </div>
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
      className={`flex flex-col items-center gap-0.5 px-3 sm:px-4 py-1.5 rounded-xl border border-teal-300 transition-all group ${colorMap[color]}`}
    >
      <span className="group-hover:scale-110 transition-transform">{icon}</span>
      <span className="text-sm font-extrabold hidden sm:block">{label}</span>
    </button>
  )
}

function BankField({ icon, label, value, onChange, placeholder, type = 'text' }: {  icon: React.ReactNode; label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string
}) {
  return (
    <div className="flex items-center gap-4">
      <label className="text-sm font-extrabold text-gray-900 shrink-0 w-48">{label}</label>
      <div className="relative flex-1">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</span>
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-gray-50 focus:bg-white transition-colors"
        />
      </div>
    </div>
  )
}

function PolicyItem({ number, kannada, english }: { number: number; kannada: string; english: string }) {
  return (
    <div className="border border-teal-400 rounded overflow-hidden shadow-sm bg-white text-sm">
      <div className="bg-teal-600 text-white px-4 py-2 font-bold tracking-wide">
        Point {number}
      </div>
      <div className="p-4 space-y-3">
        <p className="text-gray-900 leading-relaxed font-extrabold text-[15px]">{kannada}</p>
        <p className="text-gray-800 leading-relaxed border-t border-gray-200 pt-3 italic font-bold text-[14px]">{english}</p>
      </div>
    </div>
  )
}
