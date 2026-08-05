import { useRef, useState } from 'react'
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, StyleSheet, StatusBar, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import ViewShot from 'react-native-view-shot'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Picker } from '@react-native-picker/picker'
import DateTimePicker from '@react-native-community/datetimepicker'
import { useRouter } from 'expo-router'
import { getNextRecord, submitRecord } from '../../api/data'
import { useSession } from '../../context/SessionContext'
import { useAuth } from '../../context/AuthContext'
import { logout } from '../../api/auth'
import { takeScreenshot } from '../../hooks/useScreenshot'
import { formatSeconds } from '../../lib/utils'
import type { FieldConfig } from '../../types/data'

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

  const validate = () => {
    const errs: Record<string, string> = {}
    for (const f of inputFields) {
      const val = inputs[f.column_key] ?? ''
      if (!val.trim()) { errs[f.column_key] = 'Required'; continue }
      if (f.field_type === 'number' && isNaN(Number(val))) errs[f.column_key] = 'Must be a number.'
      if (f.field_type === 'date' && isNaN(Date.parse(val))) errs[f.column_key] = 'Must be a valid date.'
    }
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = () => {
    if (!activeSession) { router.replace('/(app)/'); return }
    if (!validate()) { Alert.alert('Validation', 'Please fill all required fields.'); return }
    submitMut.mutate()
  }

  const handleScreenshot = async () => {
    if (!data) return
    await takeScreenshot(printRef, {
      username:  user?.name ?? 'user',
      recordSeq: data.record.global_sequence,
    })
  }

  const timerColor = remainingSeconds <= 5 * 60 ? '#dc2626'
    : remainingSeconds <= 30 * 60 ? '#d97706' : '#16a34a'

  const statusBarHeight = 0 // handled by react-native-safe-area-context

  if (!activeSession) {
    return (
      <View style={s.center}>
        <Text style={s.emptyText}>No active session.</Text>
        <TouchableOpacity style={s.btn} onPress={() => router.replace('/(app)/')}>
          <Text style={s.btnText}>Go to Session Start</Text>
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

      {/* ── Top bar ── */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.replace('/(app)/')} style={s.backBtn}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={[{ fontSize: 13, fontWeight: '600' }, { color: timerColor }]}>
            ⏱ {formatSeconds(remainingSeconds)}
          </Text>
          <Text style={{ fontSize: 10, color: '#9ca3af' }}>
            {user?.name}  ·  Record #{data?.record.global_sequence ?? '—'}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setMenuOpen(v => !v)} style={s.menuBtn}>
          <Text style={s.menuText}>⋮</Text>
        </TouchableOpacity>
      </View>

      {/* ── Dropdown menu ── */}
      {menuOpen && (
        <View style={s.dropdown}>
          <Text style={s.dropdownRecord}>Record #{data?.record.global_sequence ?? '—'}</Text>
          <View style={s.dropdownDivider} />
          <TouchableOpacity style={s.dropdownItem} onPress={async () => {
            setMenuOpen(false)
            try { await logout() } catch {}
            await clearAuth()
            router.replace('/(auth)/login')
          }}>
            <Text style={[s.dropdownItemText, { color: '#dc2626' }]}>Logout</Text>
          </TouchableOpacity>
        </View>
      )}

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
          {inputFields.map(f => (
            <FieldInput
              key={f.id} field={f}
              value={inputs[f.column_key] ?? ''}
              error={fieldErrors[f.column_key]}
              showDatePicker={showDateFor === f.column_key}
              onShowDatePicker={() => setShowDateFor(showDateFor === f.column_key ? null : f.column_key)}
              onChange={val => {
                setInputs(p => ({ ...p, [f.column_key]: val }))
                if (fieldErrors[f.column_key])
                  setFieldErrors(p => { const n = { ...p }; delete n[f.column_key]; return n })
              }}
            />
          ))}
        </ScrollView>
      </ViewShot>

      {/* ── Bottom action bar ── */}
      <View style={s.bottomBar}>
        <TouchableOpacity onPress={handleScreenshot} style={s.btnSecondary}>
          <Text style={s.btnSecondaryText}>📷</Text>
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
          <Text style={{ color: '#94a3b8', fontSize: 12 }}>Record #{data?.record.global_sequence}</Text>
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

      {field.field_type === 'dropdown' ? (
        <View style={[s.pickerWrapper, error ? s.inputError : null]}>
          <Picker selectedValue={value} onValueChange={onChange} style={{ height: 48 }}>
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
              mode="date" display="default"
              onChange={(_, date) => {
                onShowDatePicker()
                if (date) onChange(date.toISOString().split('T')[0])
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
  safeArea:         { flex: 1, backgroundColor: '#f3f4f6', position: 'relative' },
  center:           { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText:        { color: '#6b7280', fontSize: 16, marginBottom: 16, textAlign: 'center' },
  topBar:           { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backBtn:          { paddingHorizontal: 4 },
  backText:         { color: '#2563eb', fontSize: 14, fontWeight: '500' },
  menuBtn:          { paddingHorizontal: 8 },
  menuText:         { fontSize: 22, color: '#374151', fontWeight: 'bold' },
  dropdown:         { position: 'absolute', top: 44, right: 12, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, elevation: 8, zIndex: 100, minWidth: 180 },
  dropdownRecord:   { paddingHorizontal: 16, paddingVertical: 10, fontSize: 13, color: '#6b7280' },
  dropdownDivider:  { height: 1, backgroundColor: '#e5e7eb' },
  dropdownItem:     { paddingHorizontal: 16, paddingVertical: 12 },
  dropdownItemText: { fontSize: 14, fontWeight: '500' },

  // Reference panel
  refContainer:     { backgroundColor: '#f8faff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', maxHeight: 200 },
  refHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#374151' },
  refTitle:         { fontSize: 12, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
  refChevron:       { fontSize: 11, color: '#d1d5db' },
  refScroll:        { maxHeight: 150 },
  refGrid:          { flexDirection: 'row', flexWrap: 'wrap', padding: 8 },
  refItem:          { width: '50%', paddingHorizontal: 8, paddingVertical: 6 },
  refLabel:         { fontSize: 10, fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1 },
  refValue:         { fontSize: 13, fontWeight: '600', color: '#0f172a' },

  // Input section
  inputList:        { padding: 14, paddingBottom: 20 },
  enterDataHeader:  { backgroundColor: '#374151', paddingHorizontal: 16, paddingVertical: 8 },
  enterDataLabel:   { fontSize: 12, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
  fieldWrap:        { marginBottom: 14 },
  inputLabel:       { fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 6 },
  textInput:        { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, backgroundColor: '#fff' },
  pickerWrapper:    { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, overflow: 'hidden', backgroundColor: '#fff' },
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
