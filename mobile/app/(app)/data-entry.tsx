import { useRef, useState, useEffect } from 'react'
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, StyleSheet, Platform, Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import ViewShot from 'react-native-view-shot'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Picker } from '@react-native-picker/picker'
import DateTimePicker from '@react-native-community/datetimepicker'
import { useRouter } from 'expo-router'
import { getNextRecord, submitRecord, getRecordProgress } from '../../api/data'
import { useSession } from '../../context/SessionContext'
import { useAuth } from '../../context/AuthContext'
import { logout } from '../../api/auth'
import { takeScreenshot } from '../../hooks/useScreenshot'
import { formatSeconds } from '../../lib/utils'
import type { FieldConfig } from '../../types/data'

// ── Shared helpers ───────────────────────────────────────────────────────────
function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
}
function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}  ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}
function addDays(iso: string | null | undefined, days: number): string | null {
  if (!iso) return null; const d = new Date(iso); d.setDate(d.getDate() + days); return d.toISOString()
}
function computeTestPeriod(approvedAt: string | null | undefined) {
  if (!approvedAt) return null
  const start = new Date(approvedAt); start.setHours(0,0,0,0)
  const today = new Date(); today.setHours(0,0,0,0)
  const daysSince = Math.floor((today.getTime() - start.getTime()) / 86400000)
  const period = Math.floor(daysSince / 40) + 1
  const pStart = new Date(start.getTime() + (period-1)*40*86400000)
  const pEnd   = new Date(start.getTime() + period*40*86400000 - 86400000)
  const daysRemaining = Math.max(0, Math.floor((pEnd.getTime() - today.getTime()) / 86400000) + 1)
  const dayOfPeriod   = daysSince - (period-1)*40 + 1
  return { period, pStart: pStart.toISOString(), pEnd: pEnd.toISOString(), daysRemaining, dayOfPeriod }
}
function sessionOrdinal(n: number) {
  return n === 1 ? '1st' : n === 2 ? '2nd (Last)' : `${n}th`
}
function shiftEndTime(startedAt: string) {
  const start = new Date(startedAt)
  const fourHrs = new Date(start.getTime() + 4*60*60*1000)
  const midnight = new Date(start); midnight.setDate(midnight.getDate()+1); midnight.setHours(0,0,0,0)
  return new Date(Math.min(fourHrs.getTime(), midnight.getTime())).toISOString()
}

export default function DataEntryScreen() {
  const router = useRouter()
  const qc = useQueryClient()
  const [menuOpen, setMenuOpen] = useState(false)
  const { user, clearAuth } = useAuth()
  const { activeSession, remainingSeconds } = useSession()
  const viewShotRef = useRef<any>(null)
  const printRef    = useRef<any>(null)

  const [inputs, setInputs]           = useState<Record<string, string>>({})
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [showDateFor, setShowDateFor] = useState<string | null>(null)
  const [refExpanded, setRefExpanded] = useState(true)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['next-record'],
    queryFn: () => getNextRecord().then(r => r.data.data),
    retry: false,
    staleTime: 0,
  })

  const { data: progress } = useQuery({
    queryKey: ['record-progress'],
    queryFn: () => getRecordProgress().then(r => r.data.data),
  })

  const submitMut = useMutation({
    mutationFn: () =>
      submitRecord(data!.record.id, activeSession!.id, inputs).then(r => r.data),
    onSuccess: () => {
      setInputs({})
      setFieldErrors({})
      setRefExpanded(true)
      qc.removeQueries({ queryKey: ['next-record'] })
      setTimeout(() => qc.invalidateQueries({ queryKey: ['next-record'] }), 600)
    },
    onError: (err: any) =>
      Alert.alert('Submit failed', err.response?.data?.error ?? 'Please try again.'),
  })

  const inputFields     = data?.field_config.filter(f => !f.is_reference) ?? []
  const referenceFields = data?.field_config.filter(f => f.is_reference)  ?? []

  // Pre-populate fixed fields from record values
  useEffect(() => {
    if (!data) return
    const values = data.record.values as Record<string, string>
    const fixed: Record<string, string> = {}
    data.field_config.filter(f => f.field_type === 'fixed').forEach(f => {
      fixed[f.column_key] = values[f.column_key] ?? ''
    })
    if (Object.keys(fixed).length > 0) {
      setInputs(prev => ({ ...fixed, ...prev }))
    }
  }, [data?.record.id])

  const validate = () => {
    const errs: Record<string, string> = {}
    for (const f of inputFields) {
      if (f.field_type === 'fixed') continue
      const val = inputs[f.column_key] ?? ''
      if (!val.trim()) { errs[f.column_key] = 'Required'; continue }
      if (f.field_type === 'number' && isNaN(Number(val))) errs[f.column_key] = 'Must be a number.'
      if (f.field_type === 'date' && !/^\d{2}-\d{2}-\d{4}$/.test(val)) errs[f.column_key] = 'Must be a valid date (DD-MM-YYYY).'
    }
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = () => {
    if (!activeSession) { router.replace('/(app)'); return }
    if (!validate()) { Alert.alert('Validation', 'Please fill all required fields.'); return }
    Alert.alert(
      'Submit Record',
      'Are you sure you want to submit this record and move to the next?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Submit', onPress: () => submitMut.mutate() },
      ]
    )
  }

  const handleScreenshot = async () => {
    if (!data) return
    await takeScreenshot(printRef, {
      username:  user?.name ?? 'user',
      recordSeq: data.record.record_code,
    })
  }

  const timerColor = remainingSeconds <= 5 * 60 ? '#dc2626'
    : remainingSeconds <= 30 * 60 ? '#d97706' : '#16a34a'

  const statusBarHeight = 0 // handled by react-native-safe-area-context

  if (!activeSession) {
    return (
      <View style={s.center}>
        <Text style={s.emptyText}>No active session.</Text>
        <TouchableOpacity style={s.btn} onPress={() => router.replace('/(app)')}>
          <Text style={s.btnText}>Go to Session Start</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (user?.is_admin) {
    return (
      <View style={s.center}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>🛡️</Text>
        <Text style={[s.emptyText, { fontWeight: 'bold' }]}>Admin Access</Text>
        <Text style={{ color: '#6b7280', textAlign: 'center', marginBottom: 16 }}>Admins cannot take tests.</Text>
        <TouchableOpacity style={s.btn} onPress={() => router.replace('/(app)/admin')}>
          <Text style={s.btnText}>Go to Admin Panel</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (isLoading) return <View style={s.center}><ActivityIndicator size="large" color="#2563eb" /></View>

  if (isError || !data) {
    return (
      <View style={s.center}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>🎉</Text>
        <Text style={[s.emptyText, { fontWeight: 'bold' }]}>All done!</Text>
        <Text style={{ color: '#6b7280', textAlign: 'center' }}>All records completed. Great work!</Text>
      </View>
    )
  }

  const refValues = data.record.values as Record<string, string>

  return (
    <SafeAreaView style={[s.safeArea, { paddingTop: statusBarHeight }]}>

      {/* ── Brand strip ── */}
      <View style={s.brandBar}>
        <Text style={s.brandText}>MMT Associate Software</Text>
      </View>

      {/* ── Top bar ── */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.replace('/(app)')} style={s.backBtn}>
          <Text style={s.backText}>🏠 Home</Text>
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={[{ fontSize: 13, fontWeight: '600' }, { color: timerColor }]}>
            ⏱ {formatSeconds(remainingSeconds)}
          </Text>
          <Text style={{ fontSize: 10, color: '#9ca3af' }}>
            {user?.name}  ·  {data?.record.record_code ?? '—'}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setMenuOpen(v => !v)} style={s.menuBtn}>
          <Text style={s.menuText}>⋮</Text>
        </TouchableOpacity>
      </View>

      {/* ── Stats Bottom Sheet ── */}
      <Modal visible={menuOpen} transparent animationType="slide" onRequestClose={() => setMenuOpen(false)}>
        <TouchableOpacity style={s.sheetOverlay} activeOpacity={1} onPress={() => setMenuOpen(false)} />
        <View style={s.sheet}>
          <View style={s.sheetHandle} />

          {/* ── Session & Timer header ── */}
          <View style={s.sheetSessionHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.sheetLabel}>Session {activeSession?.session_number ?? '—'} of 2  ·  {user?.name}</Text>
              <Text style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace', marginTop: 2 }}>{data?.record.record_code ?? '—'}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[s.sheetTimer, { color: timerColor }]}>{formatSeconds(remainingSeconds)}</Text>
              <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>remaining</Text>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
            {/* ── Project Details ── */}
            {(() => {
              const tp = computeTestPeriod(user?.approved_at)
              const completed = progress?.completed ?? 0
              const balance = Math.max(0, 2500 - completed)
              return (
                <View style={s.sheetSection}>
                  <Text style={s.sheetSectionTitle}>Project Details</Text>
                  <SheetRow label="Project No"   value="MMT_PRO001" />
                  <SheetRow label="Test Session" value={tp ? `Test ${tp.period}` : '—'} valueColor="#0284c7" />
                  <SheetRow label="Day"          value={tp ? `${tp.dayOfPeriod} / 40` : '—'} />
                  <SheetRow label="Start Date"   value={fmtDate(tp ? tp.pStart : user?.approved_at)} />
                  <SheetRow label="End Date"     value={fmtDate(tp ? tp.pEnd : addDays(user?.approved_at, 39))} />
                  <SheetRow label="Days Left"    value={tp ? String(tp.daysRemaining) : '—'} last />
                  <View style={{ flexDirection: 'row', marginTop: 8, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' }}>
                    {[
                      { label: 'Total',   val: '2500',          color: '#374151' },
                      { label: 'Minimum', val: '2500',          color: '#374151' },
                      { label: 'Finish',  val: String(completed), color: '#16a34a' },
                      { label: 'Balance', val: String(balance),  color: '#2563eb' },
                    ].map((col, i, arr) => (
                      <View key={col.label} style={{ flex: 1, alignItems: 'center', paddingVertical: 8,
                        borderRightWidth: i < arr.length - 1 ? 1 : 0, borderRightColor: '#e2e8f0' }}>
                        <Text style={{ fontSize: 10, color: '#9ca3af', marginBottom: 3 }}>{col.label}</Text>
                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: col.color }}>{col.val}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )
            })()}

            {/* ── Shift Details ── */}
            {activeSession && (() => {
              const endIso = shiftEndTime(activeSession.started_at)
              const vd = user?.credential_valid_until
              const daysLeft = vd ? Math.floor((new Date(vd).getTime() - Date.now()) / 86400000) : null
              const validityColor = daysLeft === null ? '#6b7280'
                : daysLeft < 0 ? '#dc2626' : daysLeft <= 30 ? '#ef4444' : daysLeft <= 90 ? '#2563eb' : '#16a34a'
              const validityLabel = daysLeft === null ? '—'
                : daysLeft < 0 ? 'Expired' : `${daysLeft}d left`
              return (
                <View style={s.sheetSection}>
                  <Text style={s.sheetSectionTitle}>Shift Details</Text>
                  <SheetRow label="Session"  value={`${activeSession.session_number} of 2`} />
                  <SheetRow label="Shift No" value={sessionOrdinal(activeSession.session_number)} />
                  <SheetRow label="Start"    value={fmtDateTime(activeSession.started_at)} />
                  <SheetRow label="End"      value={fmtDateTime(endIso)} />
                  <SheetRow label="Status"   value="OPEN" valueColor="#16a34a" />
                  {vd && <SheetRow label="Valid Until" value={fmtDate(vd)} />}
                  {vd && <SheetRow label="Validity"    value={validityLabel} valueColor={validityColor} last />}
                  {!vd && <SheetRow label="Status" value="OPEN" valueColor="#16a34a" last />}
                </View>
              )
            })()}
          </ScrollView>

          {/* ── Logout ── */}
          <TouchableOpacity style={s.logoutBtn} onPress={() => {
            setMenuOpen(false)
            Alert.alert('Logout', 'Are you sure you want to logout?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Logout', style: 'destructive', onPress: async () => {
                try { await logout() } catch {}
                await clearAuth()
                router.replace('/(auth)/login')
              }},
            ])
          }}>
            <Text style={s.logoutText}>🚪  Logout</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── Collapsible reference panel ── */}
      <View style={s.refContainer}>
        <TouchableOpacity style={s.refHeader} onPress={() => setRefExpanded(v => !v)} activeOpacity={0.7}>
          <Text style={s.refTitle}>Reference Data</Text>
          <Text style={s.refChevron}>{refExpanded ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {refExpanded && (
          <ScrollView style={s.refScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
            <View style={s.refGrid}>
              {referenceFields.map(f => (
                <View key={f.id} style={s.refItem}>
                  <Text style={s.refLabel}>{f.label}</Text>
                  <Text style={s.refValue}>{refValues[f.column_key] || '—'}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      {/* ── Input fields (main scroll) ── */}
      <View style={s.enterDataHeader}>
        <Text style={s.enterDataLabel}>ENTER DATA</Text>
      </View>
      <ViewShot ref={viewShotRef} style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1, backgroundColor: '#fff' }}
          contentContainerStyle={s.inputList}
          keyboardShouldPersistTaps="handled"
        >
          {inputFields.map((f, idx) => {
            const pairedRef = referenceFields[idx]
            const pairedRefValue = pairedRef ? (refValues[pairedRef.column_key] ?? '') : ''
            const showGroupHeader = f.group && (idx === 0 || f.group !== inputFields[idx - 1].group)
            return (
              <View key={f.id}>
                {showGroupHeader && (
                  <View style={s.groupHeader}>
                    <Text style={s.groupHeaderText}>{f.group}</Text>
                  </View>
                )}
                <FieldInput
                key={f.id} field={f}
                value={f.field_type === 'fixed' ? pairedRefValue : (inputs[f.column_key] ?? '')}
                error={fieldErrors[f.column_key]}
                showDatePicker={showDateFor === f.column_key}
                onShowDatePicker={() => setShowDateFor(showDateFor === f.column_key ? null : f.column_key)}
                onChange={val => {
                  setInputs(p => ({ ...p, [f.column_key]: val }))
                  if (fieldErrors[f.column_key])
                    setFieldErrors(p => { const n = { ...p }; delete n[f.column_key]; return n })
                }}
              />
              </View>
            )
          })}
        </ScrollView>
      </ViewShot>

      {/* ── Bottom action bar ── */}
      <View style={s.bottomBar}>
        <TouchableOpacity onPress={handleScreenshot} style={s.btnSecondary}>
          <Text style={s.btnSecondaryText}>📷 Take Screenshot</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSubmit} disabled={submitMut.isPending} style={[s.btn, { flex: 1 }]}>
          {submitMut.isPending
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnText}>Submit & Next</Text>
          }
        </TouchableOpacity>
      </View>
      {/* ── Hidden full-page print view (off-screen, captured for screenshot) ── */}
      <View ref={printRef} style={s.printView} collapsable={false}>
        {/* Header */}
        <View style={{ backgroundColor: '#1e293b', padding: 12, flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>DataEntry Pro</Text>
          <Text style={{ color: '#94a3b8', fontSize: 12 }}>{data?.record.record_code}</Text>
        </View>
        {/* Column headers */}
        <View style={{ flexDirection: 'row', backgroundColor: '#1e3a5f' }}>
          <View style={{ flex: 1, padding: 8, borderRightWidth: 1, borderRightColor: '#2d5a8e' }}>
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>Reference Data</Text>
          </View>
          <View style={{ flex: 1, padding: 8 }}>
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>Entered Data</Text>
          </View>
        </View>
        {/* Rows */}
        {(data?.field_config.filter(f => !f.is_reference) ?? []).map((inputField, idx) => {
          const refField = data?.field_config.filter(f => f.is_reference)[idx]
          const refVal   = refField ? (data?.record.values as Record<string, string>)[refField.column_key] : ''
          const entered  = inputs[inputField.column_key] ?? ''
          return (
            <View key={inputField.id} style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', backgroundColor: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
              <View style={{ flex: 1, padding: 8, borderRightWidth: 1, borderRightColor: '#bfdbfe', backgroundColor: idx % 2 === 0 ? '#eff6ff' : '#dbeafe' }}>
                <Text style={{ fontSize: 9, color: '#3b82f6', fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 }}>{refField?.label ?? ''}</Text>
                <Text style={{ fontSize: 12, color: '#111827', fontWeight: '600' }}>{refVal || '—'}</Text>
              </View>
              <View style={{ flex: 1, padding: 8 }}>
                <Text style={{ fontSize: 9, color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 }}>{inputField.label}</Text>
                <Text style={{ fontSize: 12, color: entered ? '#111827' : '#9ca3af' }}>{entered || '(not entered)'}</Text>
              </View>
            </View>
          )
        })}
        {/* Watermark */}
        <View style={{ backgroundColor: '#1e293b', padding: 10 }}>
          <Text style={{ color: '#fff', fontSize: 11 }}>
            {user?.name}  |  {new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}  |  Record #{data?.record.global_sequence}
          </Text>
        </View>
      </View>

    </SafeAreaView>
  )
}

interface FieldInputProps {
  field: FieldConfig
  value: string
  error?: string
  showDatePicker: boolean
  onShowDatePicker: () => void
  onChange: (val: string) => void
}

function SheetRow({ label, value, valueColor, last }: {
  label: string; value: string; valueColor?: string; last?: boolean
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9,
      borderBottomWidth: last ? 0 : 1, borderBottomColor: '#f1f5f9' }}>
      <Text style={{ fontSize: 13, color: '#6b7280' }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '600', color: valueColor ?? '#111827' }}>{value}</Text>
    </View>
  )
}

function FieldInput({ field, value, error, showDatePicker, onShowDatePicker, onChange }: FieldInputProps) {
  const inputStyle = [s.textInput, error ? s.inputError : null]

  // Prevent paste by comparing new value length — if it jumps by more than 1 char, reject it
  const handleChangeText = (newVal: string) => {
    if (newVal.length - value.length > 1) return // paste detected — ignore
    onChange(newVal)
  }

  return (
    <View style={s.fieldWrap}>
      <Text style={s.inputLabel}>{field.label} <Text style={{ color: '#ef4444' }}>*</Text></Text>

      {field.field_type === 'fixed' ? (
        <TextInput
          style={[s.textInput, { backgroundColor: '#f3f4f6', color: '#6b7280' }]}
          value={value} editable={false}
        />
      ) : field.field_type === 'dropdown' ? (
        <View style={[s.pickerWrapper, error ? s.inputError : null]}>
          <Picker key={value} selectedValue={value} onValueChange={onChange}>
            <Picker.Item label="Select…" value="" />
            {field.dropdown_options?.map(opt => <Picker.Item key={opt} label={opt} value={opt} />)}
          </Picker>
        </View>
      ) : field.field_type === 'date' ? (
        <>
          <TouchableOpacity onPress={onShowDatePicker} style={inputStyle}>
            <Text style={{ color: value ? '#111827' : '#9ca3af', fontSize: 14 }}>
              {value || 'Select date…'}
            </Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={value ? new Date(value) : new Date()}
              mode="date"
              display={Platform.OS === 'android' ? 'calendar' : 'default'}
              onChange={(_, date) => {
                onShowDatePicker()
                if (date) {
                  const dd = String(date.getDate()).padStart(2, '0')
                  const mm = String(date.getMonth() + 1).padStart(2, '0')
                  onChange(`${dd}-${mm}-${date.getFullYear()}`)
                }
              }}
            />
          )}
        </>
      ) : (
        <TextInput
          style={inputStyle} value={value} onChangeText={handleChangeText}
          placeholder={`Enter ${field.label}`}
          keyboardType={field.field_type === 'number' ? 'numeric' : 'default'}
          contextMenuHidden={true}
        />
      )}

      {error && <Text style={s.errorText}>{error}</Text>}
    </View>
  )
}

const s = StyleSheet.create({
  safeArea:         { flex: 1, backgroundColor: '#f9fafb', position: 'relative' },
  brandBar:         { backgroundColor: '#1e293b', paddingVertical: 5, alignItems: 'center' },
  brandText:        { color: '#94a3b8', fontSize: 10, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
  center:           { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText:        { color: '#6b7280', fontSize: 16, marginBottom: 16, textAlign: 'center' },
  topBar:           { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backBtn:          { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  backText:         { color: '#2563eb', fontSize: 14, fontWeight: '600' },
  menuBtn:          { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  menuText:         { fontSize: 20, color: '#374151', fontWeight: 'bold', lineHeight: 22 },
  sheetOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:            { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  sheetHandle:      { width: 40, height: 4, backgroundColor: '#d1d5db', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle:       { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  sheetSessionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 12, padding: 14, marginBottom: 12 },
  sheetSection:     { backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, marginBottom: 10 },
  sheetSectionTitle: { fontSize: 11, fontWeight: '700', color: '#0369a1', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  sheetCard:        { backgroundColor: '#f9fafb', borderRadius: 12, padding: 12, marginBottom: 10 },
  sheetLabel:       { fontSize: 10, fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  sheetValue:       { fontSize: 15, fontWeight: '600', color: '#111827' },
  sheetTimer:       { fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'] },
  logoutBtn:        { backgroundColor: '#fef2f2', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 4 },
  logoutText:       { color: '#dc2626', fontWeight: '700', fontSize: 15 },

  // Reference panel
  refContainer:     { backgroundColor: '#f8faff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', maxHeight: 200 },
  refHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#1e293b' },
  refTitle:         { fontSize: 12, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
  refChevron:       { fontSize: 11, color: '#d1d5db' },
  refScroll:        { maxHeight: 150 },
  refGrid:          { flexDirection: 'row', flexWrap: 'wrap', padding: 8 },
  refItem:          { width: '50%', paddingHorizontal: 8, paddingVertical: 6 },
  refLabel:         { fontSize: 10, fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1 },
  refValue:         { fontSize: 13, fontWeight: '600', color: '#0f172a' },

  // Input section
  inputList:        { padding: 14, paddingBottom: 20 },
  groupHeader:      { backgroundColor: '#dbeafe', paddingHorizontal: 14, paddingVertical: 8, marginTop: 8, borderRadius: 6, alignItems: 'center' },
  groupHeaderText:  { color: '#1d4ed8', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  enterDataHeader:  { backgroundColor: '#1e293b', paddingHorizontal: 16, paddingVertical: 8 },
  enterDataLabel:   { fontSize: 12, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
  fieldWrap:        { marginBottom: 14 },
  inputLabel:       { fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 6 },
  textInput:        { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, backgroundColor: '#fff' },
  pickerWrapper:    { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, backgroundColor: '#fff' },
  inputError:       { borderColor: '#f87171', backgroundColor: '#fef2f2' },
  errorText:        { color: '#ef4444', fontSize: 12, marginTop: 4 },

  // Bottom bar
  bottomBar:        { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb', padding: 12, flexDirection: 'row', gap: 10 },
  printView:        { position: 'absolute', top: 10000, left: 0, width: 390, backgroundColor: '#fff' },
  btn:              { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  btnText:          { color: '#fff', fontWeight: '600', fontSize: 14 },
  btnSecondary:     { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12, paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center' },
  btnSecondaryText: { color: '#374151', fontWeight: '500', fontSize: 16 },
})
