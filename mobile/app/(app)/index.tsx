import { useState, useEffect, useRef } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator,
  StyleSheet, Modal, TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { getTodaySummary, startSession, getActiveSession, takeover } from '../../api/sessions'
import { getRecordProgress } from '../../api/data'
import { useSession } from '../../context/SessionContext'
import { getDeviceName } from '../../lib/deviceId'
import { formatSeconds } from '../../lib/utils'
import { useAuth } from '../../context/AuthContext'
import { logout, updateMyBank } from '../../api/auth'

const MAX_DAILY = 8 * 60 * 60

type ModalType = 'profile' | 'bank' | 'privacy' | 'account' | null

interface BankForm {
  fullName: string
  bankName: string
  accountNo: string
  confirmAccountNo: string
  ifscCode: string
}

const EMPTY_BANK: BankForm = {
  fullName: '', bankName: '', accountNo: '', confirmAccountNo: '', ifscCode: '',
}

function getInitials(name: string | null | undefined) {
  if (!name) return '?'
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  const date = `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`
  const time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  return `${date}  ${time}`
}

function addDays(iso: string | null | undefined, days: number): string | null {
  if (!iso) return null
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

function computeTestPeriod(approvedAt: string | null | undefined) {
  if (!approvedAt) return null
  const start = new Date(approvedAt); start.setHours(0, 0, 0, 0)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const daysSince = Math.floor((today.getTime() - start.getTime()) / 86400000)
  const period = Math.floor(daysSince / 40) + 1
  const pStart = new Date(start.getTime() + (period - 1) * 40 * 86400000)
  const pEnd   = new Date(start.getTime() + period * 40 * 86400000 - 86400000)
  const daysRemaining = Math.max(0, Math.floor((pEnd.getTime() - today.getTime()) / 86400000) + 1)
  const dayOfPeriod   = daysSince - (period - 1) * 40 + 1
  return { period, pStart: pStart.toISOString(), pEnd: pEnd.toISOString(), daysRemaining, dayOfPeriod }
}

function sessionOrdinal(n: number) {
  if (n === 1) return '1st'
  if (n === 2) return '2nd (Last)'
  return `${n}th`
}

function shiftEndTime(startedAt: string) {
  const start   = new Date(startedAt)
  const fourHrs = new Date(start.getTime() + 4 * 60 * 60 * 1000)
  const midnight = new Date(start); midnight.setDate(midnight.getDate() + 1); midnight.setHours(0,0,0,0)
  return new Date(Math.min(fourHrs.getTime(), midnight.getTime())).toISOString()
}

export default function SessionGateScreen() {
  const router = useRouter()
  const { user, clearAuth, updateUser } = useAuth()
  const { activeSession, setActiveSession, remainingSeconds } = useSession()
  const [starting, setStarting] = useState(false)
  const [dailyRemaining, setDailyRemaining] = useState<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Modal state
  const [modal, setModal] = useState<ModalType>(null)
  const [bankEditing, setBankEditing] = useState(false)
  const [bank, setBank] = useState<BankForm>(EMPTY_BANK)
  const [bankError, setBankError] = useState('')
  const [bankSaving, setBankSaving] = useState(false)
  const [bankSaved, setBankSaved] = useState(false)

  const { data: summary, isLoading } = useQuery({
    queryKey: ['today-summary'],
    queryFn: () => getTodaySummary().then(r => r.data.data),
    staleTime: 0,
    refetchOnMount: true,
  })

  const { data: progress } = useQuery({
    queryKey: ['record-progress'],
    queryFn: () => getRecordProgress().then(r => r.data.data),
    staleTime: 0,
    refetchOnMount: true,
  })

  useEffect(() => {
    if (summary?.remaining_daily_seconds === undefined) return
    setDailyRemaining(summary.remaining_daily_seconds)
    if (timerRef.current) clearInterval(timerRef.current)
    if (summary.remaining_daily_seconds < MAX_DAILY) {
      timerRef.current = setInterval(() => {
        setDailyRemaining(prev => (prev !== null && prev > 0 ? prev - 1 : 0))
      }, 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [summary?.remaining_daily_seconds])

  const dailyRemainingValue = dailyRemaining ?? summary?.remaining_daily_seconds ?? null

  const canStart = summary
    ? summary.sessions_used < summary.sessions_allowed && (dailyRemainingValue ?? 0) > 0
    : false

  const handleStart = async () => {
    setStarting(true)
    try {
      const res = await startSession(getDeviceName())
      const sess = res.data.data
      setActiveSession(sess)
      const action = sess.elapsed_seconds > 0 ? 'resumed' : 'started'
      Alert.alert(
        `Session ${sess.session_number} of 2 ${action}!`,
        'Taking you to the test…',
        [{ text: 'OK', onPress: () => router.push('/(app)/data-entry') }]
      )
    } catch (err: any) {
      const msg: string = err.response?.data?.error ?? ''
      if (msg.toLowerCase().includes('different device')) {
        // Active session exists on another device — offer takeover
        try {
          const activeRes = await getActiveSession()
          const activeSess = activeRes.data.data
          Alert.alert(
            'Session active on another device',
            `Session ${activeSess.session_number} of 2 is running on "${activeSess.device_name ?? 'another device'}". Switch to this device?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Switch here', onPress: async () => {
                  setStarting(true)
                  try {
                    await takeover(activeSess.id, getDeviceName())
                    setActiveSession(activeSess)
                    router.push('/(app)/data-entry')
                  } catch {
                    Alert.alert('Error', 'Failed to switch device. Please try again.')
                  } finally {
                    setStarting(false)
                  }
                },
              },
            ]
          )
        } catch {
          Alert.alert('Cannot start session', msg || 'Please try again.')
        }
      } else {
        Alert.alert('Cannot start session', msg || 'Please try again.')
      }
    } finally {
      setStarting(false)
    }
  }

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive', onPress: async () => {
          try { await logout() } catch {}
          await clearAuth()
          router.replace('/(auth)/login')
        }
      },
    ])
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

  const handleBankSave = async () => {
    setBankError('')
    if (!bank.fullName || !bank.bankName || !bank.accountNo || !bank.confirmAccountNo || !bank.ifscCode) {
      setBankError('All fields are required.'); return
    }
    if (bank.accountNo !== bank.confirmAccountNo) {
      setBankError('Account numbers do not match.'); return
    }
    setBankSaving(true)
    try {
      const res = await updateMyBank({
        account_holder_name: bank.fullName,
        bank_name: bank.bankName,
        account_number: bank.accountNo,
        ifsc_code: bank.ifscCode,
      })
      updateUser(res.data.data)
      setBankSaved(true)
      setBankEditing(false)
      setTimeout(() => setBankSaved(false), 3000)
    } catch {
      setBankError('Failed to save. Please try again.')
    } finally {
      setBankSaving(false)
    }
  }

  const closeModal = () => {
    setModal(null)
    setBankEditing(false)
    setBankError('')
    setBankSaved(false)
  }

  const timerColor = remainingSeconds <= 5 * 60 ? '#dc2626'
    : remainingSeconds <= 30 * 60 ? '#d97706' : '#16a34a'

  const containerPadding = { paddingTop: 10 }

  const renderHeader = (subtitle: string) => (
    <View style={s.header}>
      <View>
        <Text style={s.greeting}>Hello, {user?.name} 👋</Text>
        <Text style={{ color: '#6b7280', fontSize: 13 }}>{subtitle}</Text>
      </View>
      <TouchableOpacity onPress={() => setModal('account')} style={s.avatarBtn}>
        <Text style={s.avatarBtnText}>{getInitials(user?.name)}</Text>
      </TouchableOpacity>
    </View>
  )

  // ── Account Sheet ────────────────────────────────────────────────────────
  const renderAccountSheet = () => (
    <Modal visible={modal === 'account'} animationType="slide" transparent onRequestClose={closeModal}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={closeModal} />
      <View style={[s.sheet, { position: 'absolute', bottom: 0, left: 0, right: 0 }]}>
        {/* Avatar header */}
        <View style={{ alignItems: 'center', paddingVertical: 24, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
          <View style={[s.avatarBtn, { width: 60, height: 60, borderRadius: 30, marginBottom: 10 }]}>
            <Text style={[s.avatarBtnText, { fontSize: 22 }]}>{getInitials(user?.name)}</Text>
          </View>
          <Text style={{ fontWeight: '700', fontSize: 16, color: '#111827' }}>{user?.name}</Text>
          <Text style={{ color: '#6b7280', fontSize: 13, marginTop: 2 }}>{user?.display_id}</Text>
        </View>

        {/* Menu items */}
        {[
          { icon: '👤', label: 'Profile', sub: 'View your details', onPress: () => { closeModal(); setTimeout(() => setModal('profile'), 300) } },
          { icon: '🏦', label: 'Bank Details', sub: 'Manage bank account', onPress: () => { closeModal(); setTimeout(() => openBankModal(), 300) } },
          { icon: '🔒', label: 'Privacy Policy', sub: 'Your data rights', onPress: () => { closeModal(); setTimeout(() => setModal('privacy'), 300) } },
        ].map((item, i, arr) => (
          <TouchableOpacity key={item.label} onPress={item.onPress}
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16,
              borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: '#f3f4f6' }}>
            <Text style={{ fontSize: 22, width: 40 }}>{item.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827' }}>{item.label}</Text>
              <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>{item.sub}</Text>
            </View>
            <Text style={{ color: '#d1d5db', fontSize: 18 }}>›</Text>
          </TouchableOpacity>
        ))}

        {/* Logout */}
        <TouchableOpacity onPress={() => { closeModal(); setTimeout(handleLogout, 300) }}
          style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16,
            marginTop: 8, borderTopWidth: 1, borderTopColor: '#fee2e2', backgroundColor: '#fff9f9' }}>
          <Text style={{ fontSize: 22, width: 40 }}>🚪</Text>
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#dc2626' }}>Logout</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </View>
    </Modal>
  )

  // ── Profile Modal ────────────────────────────────────────────────────────
  const renderProfileModal = () => (
    <Modal visible={modal === 'profile'} animationType="slide" transparent onRequestClose={closeModal}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={[s.sheetHeader, { backgroundColor: '#7c3aed' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{getInitials(user?.name)}</Text>
              </View>
              <View>
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>{user?.name}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{user?.display_id}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={closeModal}>
              <Text style={s.closeX}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
            <ModalSection title="Member Details" color="#7c3aed">
              <ModalRow label="Member ID"     value={user?.display_id} />
              <ModalRow label="Name"          value={user?.name} />
              <ModalRow label="Mobile"        value={user?.mobile} />
              <ModalRow label="Email"         value={user?.email || '—'} />
              <ModalRow label="Date of Birth" value={fmtDate(user?.dob)} />
            </ModalSection>

            <ModalSection title="Address" color="#0d9488">
              <ModalRow label="State"    value={user?.state    || '—'} />
              <ModalRow label="District" value={user?.district || '—'} />
              <ModalRow label="Taluk"    value={user?.taluk    || '—'} />
              <ModalRow label="Pincode"  value={user?.pincode  || '—'} />
            </ModalSection>

            <ModalSection title="Registration" color="#6b7280">
              <ModalRow label="Reg Date"    value={fmtDate(user?.created_at)} />
              <ModalRow label="Reference"   value={user?.reference_name   || '—'} />
              <ModalRow label="Approved By" value={user?.approved_by_name || '—'} />
              <ModalRow
                label="Status"
                value={user?.status === 'active' ? 'Approved' : (user?.status ?? '—')}
                badge={user?.status === 'active' ? '#16a34a' : '#d97706'}
              />
              <ModalRow label="Valid Until" value={fmtDate(user?.credential_valid_until)} />
            </ModalSection>

            {user?.account_number ? (
              <ModalSection title="Bank Details" color="#2563eb">
                <ModalRow label="Account Name" value={user.account_holder_name || '—'} />
                <ModalRow label="Bank"         value={user.bank_name || '—'} />
                <ModalRow label="Account No"   value={`****${user.account_number.slice(-4)}`} />
                <ModalRow label="IFSC"         value={user.ifsc_code || '—'} />
              </ModalSection>
            ) : null}

            <View style={s.infoBox}>
              <Text style={{ color: '#1d4ed8', fontSize: 13 }}>
                ℹ️  To update profile details, contact your admin.
              </Text>
            </View>
          </ScrollView>

          <View style={s.sheetFooter}>
            <TouchableOpacity style={[s.sheetBtn, { backgroundColor: '#7c3aed' }]} onPress={closeModal}>
              <Text style={s.sheetBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )

  // ── Bank Modal ───────────────────────────────────────────────────────────
  const renderBankModal = () => (
    <Modal visible={modal === 'bank'} animationType="slide" transparent onRequestClose={closeModal}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={[s.sheetHeader, { backgroundColor: '#1d4ed8' }]}>
            <View>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>🏦  Bank Details</Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Your linked bank account</Text>
            </View>
            <TouchableOpacity onPress={closeModal}>
              <Text style={s.closeX}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
            keyboardShouldPersistTaps="handled"
          >
            {bankSaved && (
              <View style={[s.infoBox, { backgroundColor: '#f0fdf4', borderColor: '#86efac', marginBottom: 16 }]}>
                <Text style={{ color: '#15803d', fontSize: 13 }}>✅  Bank details saved successfully!</Text>
              </View>
            )}

            {!bankEditing && user?.account_number ? (
              <View style={s.bankCard}>
                <Text style={{ color: '#94a3b8', fontSize: 11, letterSpacing: 1, marginBottom: 4 }}>
                  {user.bank_name?.toUpperCase()}
                </Text>
                <Text style={{ color: '#fff', fontSize: 18, fontFamily: 'monospace', letterSpacing: 2, marginBottom: 12 }}>
                  •••• •••• {user.account_number.slice(-4)}
                </Text>
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>
                  {user.account_holder_name}
                </Text>
                <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>
                  IFSC: {user.ifsc_code}
                </Text>
              </View>
            ) : !bankEditing ? (
              <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                <Text style={{ fontSize: 40, marginBottom: 8 }}>🏦</Text>
                <Text style={{ color: '#374151', fontWeight: '600', fontSize: 16 }}>No bank details found</Text>
                <Text style={{ color: '#9ca3af', fontSize: 14, marginTop: 4 }}>
                  Add your bank details to get started.
                </Text>
              </View>
            ) : null}

            {bankEditing && (
              <View style={{ gap: 12 }}>
                <BankField
                  label="Full Name (as per bank)"
                  value={bank.fullName}
                  onChange={v => setBank(b => ({ ...b, fullName: v }))}
                  placeholder="Account holder name"
                />
                <BankField
                  label="Bank Name"
                  value={bank.bankName}
                  onChange={v => setBank(b => ({ ...b, bankName: v }))}
                  placeholder="e.g. State Bank of India"
                />
                <BankField
                  label="Account Number"
                  value={bank.accountNo}
                  onChange={v => setBank(b => ({ ...b, accountNo: v }))}
                  placeholder="Enter account number"
                  secure
                />
                <BankField
                  label="Confirm Account Number"
                  value={bank.confirmAccountNo}
                  onChange={v => setBank(b => ({ ...b, confirmAccountNo: v }))}
                  placeholder="Re-enter account number"
                />
                <BankField
                  label="IFSC Code"
                  value={bank.ifscCode}
                  onChange={v => setBank(b => ({ ...b, ifscCode: v.toUpperCase() }))}
                  placeholder="e.g. SBIN0001234"
                />
                {bankError ? (
                  <View style={[s.infoBox, { backgroundColor: '#fef2f2', borderColor: '#fca5a5' }]}>
                    <Text style={{ color: '#dc2626', fontSize: 13 }}>{bankError}</Text>
                  </View>
                ) : null}
              </View>
            )}
          </ScrollView>

          <View style={s.sheetFooter}>
            {bankEditing ? (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={[s.sheetBtn, { flex: 1, backgroundColor: '#f3f4f6' }]}
                  onPress={() => { setBankEditing(false); setBankError('') }}
                >
                  <Text style={[s.sheetBtnText, { color: '#374151' }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.sheetBtn, { flex: 2, backgroundColor: '#2563eb' }]}
                  onPress={handleBankSave}
                  disabled={bankSaving}
                >
                  {bankSaving
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.sheetBtnText}>Save Details</Text>}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={[s.sheetBtn, { flex: 1, backgroundColor: '#f3f4f6' }]}
                  onPress={closeModal}
                >
                  <Text style={[s.sheetBtnText, { color: '#374151' }]}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.sheetBtn, { flex: 2, backgroundColor: '#2563eb' }]}
                  onPress={() => setBankEditing(true)}
                >
                  <Text style={s.sheetBtnText}>
                    {user?.account_number ? '✏️  Edit' : '➕  Add Details'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  )

  // ── Privacy Modal ────────────────────────────────────────────────────────
  const renderPrivacyModal = () => (
    <Modal visible={modal === 'privacy'} animationType="slide" transparent onRequestClose={closeModal}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={[s.sheetHeader, { backgroundColor: '#0d9488' }]}>
            <View>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>🔒  Privacy Policy</Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Your data protection rights</Text>
            </View>
            <TouchableOpacity onPress={closeModal}>
              <Text style={s.closeX}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }}>
            <PolicyItem
              number={14}
              kannada="ಪರಿಶೀಲನೆಗಿ ನಮಗೆ 2 ದಿನಗಳ ಅಗತ್ಯವಿದೆ. ಪರಿಶೀಲನೆಯ ನಂತರ ಪೇಮೆಂಟ್ ಗಾಗಿ ನಮಗೆ 1 ವಾರದ ಕಾಲವಕಾಶ ಬೇಕಾಗುತದೆ."
              english="For verification we require 2 days. After verification, we require 1 week for payment processing."
            />
            <PolicyItem
              number={15}
              kannada="ಡಿವೈಸ್ ರಿಸೇಟ್ ಅಥವ ಡಿವೈಸ್ ರೆಜಿಸ್ಟೇಷನ್ ಅಪ್ರುವಲ್ ಮಾಡಲು ನಮಗೆ ಕನಿಷ್ಠ 3 ದಿನಗಳ ಅಗತ್ಯವಿದೆ."
              english="For device reset or device registration approval we require a minimum of 3 days. Maximum 3 times only."
            />
            <PolicyItem
              number={16}
              kannada="ಹೊಸ ಪ್ರಾಜೆಕ್ಟ್ ಅನ್ನು ಸಂಜೆ 6 ರಿಂದ ರಾತ್ರಿ 9:00 ರ ಒಳಗಡೆ ಕಳುಹಿಸಲಾಗುತ್ತದೆ."
              english="The new project will be sent between 6:00 PM to 9:00 PM (same day, if request is received before 6:00 PM)."
            />
            <PolicyItem
              number={17}
              kannada="ನೀವು ಸಂಜೆ 6:00 ಗಂಟೆಗಿಂತ ಮೊದಲು ಹೊಸ ಪ್ರಾಜೆಕ್ಟ್ ವರ್ಕ್ ವಿನಂತಿಯನ್ನು ಕಳುಹಿಸಬೇಕು."
              english="You must send a new project work request before 6:00 PM. Requests after 6:00 PM will be processed the next day."
            />
          </ScrollView>

          <View style={s.sheetFooter}>
            <TouchableOpacity style={[s.sheetBtn, { backgroundColor: '#0d9488' }]} onPress={closeModal}>
              <Text style={s.sheetBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )

  // ── Active session view ──────────────────────────────────────────────────
  if (activeSession) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#1e293b' }} edges={['top']}>
        <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
          <View style={s.brandBar}>
            <Text style={s.brandText}>MMT Associate Software</Text>
          </View>
          <View style={s.stickyHeader}>
            {renderHeader('Session in progress')}
          </View>
        <ScrollView style={{ flex: 1, backgroundColor: '#f9fafb' }} contentContainerStyle={[s.container, containerPadding]}>

          <View style={s.timerCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <View style={s.activeDot} />
              <Text style={s.activeBadgeText}>Session {activeSession.session_number} of 2 — Active</Text>
            </View>
            <Text style={s.timerLabel}>Time remaining in session</Text>
            <Text style={[s.timerValue, { color: timerColor }]}>{formatSeconds(remainingSeconds)}</Text>
          </View>

          <View style={s.card}>
            <Row
              label="Session started"
              value={new Date(activeSession.started_at).toLocaleTimeString('en-IN', {
                timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit',
              })}
            />
            <Row label="Session number" value={`${activeSession.session_number} / 2`} />
            <Row label="Device" value={activeSession.device_name ?? 'This device'} />
            {dailyRemaining !== null && (
              <Row
                label="Daily time remaining"
                value={formatSeconds(dailyRemaining)}
                valueColor={dailyRemaining < 3600 ? '#d97706' : '#111827'}
                last
              />
            )}
          </View>

          <ProjectDetailsCard approvedAt={user?.approved_at} completed={progress?.completed ?? 0} />
          <ShiftDetailsCard activeSession={activeSession} validUntil={user?.credential_valid_until} />

          {remainingSeconds <= 30 * 60 && (
            <View style={[s.warningBox, remainingSeconds <= 5 * 60 ? { backgroundColor: '#fee2e2', borderColor: '#fca5a5' } : {}]}>
              <Text style={{ color: remainingSeconds <= 5 * 60 ? '#991b1b' : '#92400e', fontSize: 12 }}>
                ⚠️ Only {formatSeconds(remainingSeconds)} left in this session!
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={s.fixedBottom}>
          <TouchableOpacity style={s.btn} onPress={() => {
            Alert.alert(
              `Session ${activeSession.session_number} of 2 resumed!`,
              'Taking you to the test…',
              [{ text: 'OK', onPress: () => router.push('/(app)/data-entry') }]
            )
          }}>
            <Text style={s.btnText}>Continue Test →</Text>
          </TouchableOpacity>
        </View>

        {renderAccountSheet()}
        {renderProfileModal()}
        {renderBankModal()}
        {renderPrivacyModal()}
        </View>
      </SafeAreaView>
    )
  }

  // ── Start session view ───────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#1e293b' }} edges={['top']}>
      <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
        <View style={s.brandBar}>
          <Text style={s.brandText}>MMT Associate Software</Text>
        </View>
        <View style={s.stickyHeader}>
          {renderHeader('Ready to start?')}
        </View>
        <ScrollView style={{ flex: 1, backgroundColor: '#f9fafb' }} contentContainerStyle={[s.container, containerPadding]}>

        {isLoading ? (
          <ActivityIndicator size="large" color="#2563eb" style={{ marginVertical: 40 }} />
        ) : (
          <>
            <ProjectDetailsCard approvedAt={user?.approved_at} completed={progress?.completed ?? 0} />

            {summary && (
              <View style={s.card}>
                <Row label="Sessions today"   value={`${summary.sessions_used} / ${summary.sessions_allowed}`} />
                <Row label="Time used"        value={formatSeconds(summary.total_elapsed_seconds)} />
                <Row
                  label="Time remaining"
                  value={formatSeconds(dailyRemaining ?? 0)}
                  valueColor={(dailyRemaining ?? 0) < 3600 ? '#d97706' : '#16a34a'}
                />
                <Row label="Per session (max)" value="4 hours" last />
                {(dailyRemaining ?? 0) < 4 * 3600 && (dailyRemaining ?? 0) > 0 && (
                  <View style={s.warningBox}>
                    <Text style={{ color: '#92400e', fontSize: 12 }}>
                      ⚠️ Only {formatSeconds(dailyRemaining ?? 0)} left today. Session ends at midnight IST.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {!canStart && (
              <View style={[s.card, { alignItems: 'center' }]}>
                <Text style={{ color: '#6b7280', textAlign: 'center' }}>
                  {summary?.sessions_used === summary?.sessions_allowed
                    ? '✅ All sessions used for today. Come back tomorrow!'
                    : '⏰ Daily time limit reached. Come back tomorrow!'}
                </Text>
              </View>
            )}

            {canStart && summary && (
              <View style={[s.card, { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe' }]}>
                <Text style={{ color: '#1d4ed8', textAlign: 'center', fontWeight: '700', fontSize: 15, marginBottom: 10 }}>
                  Starting Session {summary.sessions_used + 1} of {summary.sessions_allowed}
                </Text>
                <Row
                  label="Completed today"
                  value={`${summary.sessions_used} session${summary.sessions_used !== 1 ? 's' : ''}`}
                />
                <Row
                  label="Remaining after this"
                  value={`${summary.sessions_allowed - summary.sessions_used - 1} session${(summary.sessions_allowed - summary.sessions_used - 1) !== 1 ? 's' : ''}`}
                />
                <Row label="Daily time remaining" value={formatSeconds(dailyRemaining ?? 0)} last />
              </View>
            )}
          </>
        )}
      </ScrollView>

      {!isLoading && (
          <View style={s.fixedBottom}>
            <TouchableOpacity
              onPress={handleStart}
              disabled={!canStart || starting}
              style={[s.btn, !canStart && { backgroundColor: '#d1d5db' }]}
            >
              {starting
                ? <ActivityIndicator color="#fff" />
                : <Text style={[s.btnText, !canStart && { color: '#9ca3af' }]}>Start Session</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {renderAccountSheet()}
      {renderProfileModal()}
      {renderBankModal()}
      {renderPrivacyModal()}
    </SafeAreaView>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function ProjectDetailsCard({ approvedAt, completed }: { approvedAt?: string; completed: number }) {
  const tp = computeTestPeriod(approvedAt)
  const balance = Math.max(0, 2500 - completed)
  return (
    <View style={s.card}>
      <Text style={[s.sectionLabel, { color: '#0369a1' }]}>Project Details</Text>
      <Row label="Project No"   value="MMT_PRO001" />
      <Row label="Test Session" value={tp ? `Test ${tp.period}` : '—'} valueColor="#0284c7" />
      <Row label="Day"          value={tp ? `${tp.dayOfPeriod} / 40` : '—'} />
      <Row label="Start Date"   value={fmtDate(tp ? tp.pStart : approvedAt)} />
      <Row label="End Date"     value={fmtDate(tp ? tp.pEnd : addDays(approvedAt, 39))} />
      <Row label="Days Left"    value={tp ? String(tp.daysRemaining) : '—'} last />
      <View style={{ flexDirection: 'row', marginTop: 12, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' }}>
        {[
          { label: 'Total',   val: '2500',           color: '#374151' },
          { label: 'Minimum', val: '2500',           color: '#374151' },
          { label: 'Finish',  val: String(completed), color: '#16a34a' },
          { label: 'Balance', val: String(balance),   color: '#2563eb' },
        ].map((col, i, arr) => (
          <View key={col.label} style={{ flex: 1, alignItems: 'center', paddingVertical: 10,
            borderRightWidth: i < arr.length - 1 ? 1 : 0, borderRightColor: '#e2e8f0' }}>
            <Text style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>{col.label}</Text>
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: col.color }}>{col.val}</Text>
          </View>
        ))}
      </View>
      <View style={{ marginTop: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ fontSize: 12, color: '#9ca3af' }}>Records progress</Text>
          <Text style={{ fontSize: 12, color: '#9ca3af' }}>{completed} / 2500</Text>
        </View>
        <View style={{ height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
          <View style={{ height: '100%', backgroundColor: '#16a34a', borderRadius: 3,
            width: `${Math.min(100, (completed / 2500) * 100)}%` as any }} />
        </View>
      </View>
    </View>
  )
}

function ShiftDetailsCard({ activeSession, validUntil }: {
  activeSession: { session_number: number; started_at: string; status: string } | null
  validUntil?: string
}) {
  if (!activeSession) return null
  const endIso = shiftEndTime(activeSession.started_at)
  const vd = validUntil
  const daysLeft = vd ? Math.floor((new Date(vd).getTime() - Date.now()) / 86400000) : null
  const validityColor = daysLeft === null ? '#6b7280'
    : daysLeft < 0 ? '#dc2626' : daysLeft <= 30 ? '#ef4444' : daysLeft <= 90 ? '#2563eb' : '#16a34a'
  const validityLabel = daysLeft === null ? '—'
    : daysLeft < 0 ? 'Expired' : `${daysLeft}d left`
  return (
    <View style={s.card}>
      <Text style={[s.sectionLabel, { color: '#0369a1' }]}>Shift Details</Text>
      <Row label="Session"    value={`${activeSession.session_number} of 2`} />
      <Row label="Shift No"   value={sessionOrdinal(activeSession.session_number)} />
      <Row label="Start"      value={fmtDateTime(activeSession.started_at)} />
      <Row label="End"        value={fmtDateTime(endIso)} />
      <Row label="Status"     value={activeSession.status === 'active' ? 'OPEN' : 'CLOSED'}
           valueColor={activeSession.status === 'active' ? '#16a34a' : '#dc2626'} last={!vd} />
      {vd && <Row label="Valid Until" value={fmtDate(vd)} />}
      {vd && <Row label="Validity"    value={validityLabel} valueColor={validityColor} last />}
    </View>
  )
}

function Row({ label, value, valueColor, last }: {
  label: string; value: string; valueColor?: string; last?: boolean
}) {
  return (
    <View style={[
      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
      !last && { borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
    ]}>
      <Text style={{ color: '#6b7280', fontSize: 14 }}>{label}</Text>
      <Text style={{ fontWeight: '600', fontSize: 14, color: valueColor ?? '#111827' }}>{value}</Text>
    </View>
  )
}

function ModalSection({ title, color, children }: {
  title: string; color: string; children: React.ReactNode
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{
        fontSize: 11, fontWeight: '700', color,
        textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6,
      }}>
        {title}
      </Text>
      <View style={{ backgroundColor: '#f9fafb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 }}>
        {children}
      </View>
    </View>
  )
}

function ModalRow({ label, value, badge }: {
  label: string; value: string | undefined; badge?: string
}) {
  return (
    <View style={{
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
    }}>
      <Text style={{ color: '#9ca3af', fontSize: 13, width: 110 }}>{label}</Text>
      {badge ? (
        <View style={{ backgroundColor: badge + '20', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 }}>
          <Text style={{ color: badge, fontSize: 12, fontWeight: '600' }}>{value ?? '—'}</Text>
        </View>
      ) : (
        <Text style={{ color: '#111827', fontSize: 13, fontWeight: '500', flex: 1, textAlign: 'right' }}>
          {value ?? '—'}
        </Text>
      )}
    </View>
  )
}

function BankField({ label, value, onChange, placeholder, secure }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; secure?: boolean
}) {
  return (
    <View>
      <Text style={{ fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 6 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        secureTextEntry={secure}
        style={{
          borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10,
          paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, backgroundColor: '#fff',
        }}
      />
    </View>
  )
}

function PolicyItem({ number, kannada, english }: {
  number: number; kannada: string; english: string
}) {
  return (
    <View style={{ backgroundColor: '#f0fdfa', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#99f6e4' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <View style={{
          width: 24, height: 24, borderRadius: 12, backgroundColor: '#0d9488',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>{number}</Text>
        </View>
        <Text style={{ color: '#0d9488', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Point {number}
        </Text>
      </View>
      <Text style={{ color: '#374151', fontSize: 14, lineHeight: 22, marginBottom: 8 }}>{kannada}</Text>
      <Text style={{ color: '#6b7280', fontSize: 12, lineHeight: 18, fontStyle: 'italic' }}>{english}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  container:       { padding: 20, paddingBottom: 40 },
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  greeting:        { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  logoutBtn:       { borderWidth: 1, borderColor: '#fca5a5', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  quickBtns:       { flexDirection: 'row', gap: 8 },
  card:            { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  sectionLabel:    { fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  warningBox:      { marginBottom: 16, backgroundColor: '#fef3c7', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#fcd34d' },
  btn:             { backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnText:         { color: '#fff', fontWeight: '700', fontSize: 16 },
  activeBadge:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#dcfce7', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start', marginBottom: 16 },
  activeDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: '#16a34a', marginRight: 8 },
  activeBadgeText: { color: '#15803d', fontWeight: '600', fontSize: 13 },
  timerCard:       { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  timerLabel:      { fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  timerValue:      { fontSize: 48, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
  // Modal / sheet
  backdrop:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet:           { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  sheetHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  sheetFooter:     { padding: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  sheetBtn:        { borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  sheetBtnText:    { color: '#fff', fontWeight: '600', fontSize: 15 },
  closeX:          { color: 'rgba(255,255,255,0.75)', fontSize: 20, paddingLeft: 12 },
  avatar:          { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  avatarText:      { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  infoBox:         { backgroundColor: '#eff6ff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#bfdbfe' },
  brandBar:        { backgroundColor: '#1e293b', paddingVertical: 5, alignItems: 'center' },
  brandText:       { color: '#94a3b8', fontSize: 10, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
  stickyHeader:    { backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  avatarBtn:       { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' },
  avatarBtnText:   { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  fixedBottom:     { padding: 20, paddingBottom: 32, backgroundColor: '#f9fafb', borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  bankCard:        { backgroundColor: '#1e293b', borderRadius: 16, padding: 20, marginBottom: 16 },
})
