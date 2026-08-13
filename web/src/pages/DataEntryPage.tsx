import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getNextRecord, submitRecord, getRecordProgress } from '../api/data'
import { useSession } from '../context/SessionContext'
import { useAuth } from '../context/AuthContext'
import { takeScreenshot } from '../hooks/useScreenshot'
import { formatSeconds } from '../lib/utils'
import type { FieldConfig } from '../types/data'
import { useNavigate } from 'react-router-dom'

export function DataEntryPage() {
  const { activeSession, remainingSeconds } = useSession()
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [screenshotMsg, setScreenshotMsg] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['next-record'],
    queryFn: () => getNextRecord().then((r) => r.data.data),
    retry: false,
    staleTime: 0,       // always re-fetch fresh after submit
    refetchOnMount: true,
  })

  const { data: progress } = useQuery({
    queryKey: ['record-progress'],
    queryFn: () => getRecordProgress().then((r) => r.data.data),
  })

  const submitMutation = useMutation({
    mutationFn: () =>
      submitRecord(data!.record.id, activeSession!.id, inputs).then((r) => r.data.data),
    onSuccess: () => {
      setSubmitSuccess(true)
      setInputs({})
      setFieldErrors({})
      // Remove cached record so next fetch loads the real next one
      qc.removeQueries({ queryKey: ['next-record'] })
      setTimeout(() => {
        setSubmitSuccess(false)
        qc.invalidateQueries({ queryKey: ['next-record'] })
      }, 600)
    },
  })

  // Pair up reference and input fields by position
  const referenceFields = data?.field_config.filter((f) => f.is_reference) ?? []
  const inputFields     = data?.field_config.filter((f) => !f.is_reference) ?? []

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

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    for (const f of inputFields) {
      if (f.field_type === 'fixed') continue
      const val = inputs[f.column_key] ?? ''
      if (!val.trim()) { errs[f.column_key] = 'This field is required'; continue }
      if (f.field_type === 'number' && isNaN(Number(val))) errs[f.column_key] = 'Must be a number'
      if (f.field_type === 'date'   && isNaN(Date.parse(val))) errs[f.column_key] = 'Must be a valid date'
    }
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = () => {
    if (!activeSession) { navigate('/session'); return }
    if (!validate()) {
      document.querySelector('[data-field-error]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    if (!window.confirm('Are you sure you want to submit this record and move to the next?')) return
    submitMutation.mutate()
  }

  const handleScreenshot = async () => {
    if (!data) return
    try {
      await takeScreenshot({
        username:    user?.name ?? 'user',
        recordSeq:   data.record.record_code,
        record:      data.record,
        fieldConfig: data.field_config,
        inputValues: inputs,
      })
      setScreenshotMsg('✅ Screenshot saved!')
    } catch (err) {
      console.error('Screenshot failed:', err)
      setScreenshotMsg('❌ Screenshot failed: ' + String(err))
    }
    setTimeout(() => setScreenshotMsg(''), 6000)
  }

  if (!activeSession) {
    return (
      <div className="flex-1 flex items-center justify-center flex-col gap-4 p-8">
        <p className="text-gray-600 text-lg">No active session. Please start a session first.</p>
        <button onClick={() => navigate('/session')}
          className="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700">
          Go to Session Start
        </button>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex-1 flex items-center justify-center flex-col gap-3 p-8 text-center">
        <div className="text-5xl">🎉</div>
        <h2 className="text-xl font-bold text-gray-900">All records completed!</h2>
        <p className="text-gray-500">You have submitted all available records. Great work!</p>
      </div>
    )
  }

  const values = data.record.values as Record<string, string>

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between text-sm shrink-0">
        <span className="text-gray-500">
          Record <span className="font-semibold text-gray-800">{data.record.record_code}</span>
        </span>
        <div className="flex items-center gap-2">
          {screenshotMsg && <span className="text-green-600 font-medium">{screenshotMsg}</span>}
          {submitSuccess  && <span className="text-green-600 font-medium">✅ Submitted!</span>}
          <button onClick={handleScreenshot}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-gray-700 transition-all duration-150 hover:bg-gray-100 hover:border-gray-400 hover:shadow-sm active:scale-95">
            📷 Take Screenshot
          </button>
          <button onClick={handleSubmit} disabled={submitMutation.isPending}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded-lg font-medium transition-all duration-150 hover:bg-blue-700 hover:shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100">
            {submitMutation.isPending ? 'Submitting…' : 'Submit & Next'}
          </button>
        </div>
      </div>

      {submitMutation.isError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-red-700 text-sm shrink-0">
          {(submitMutation.error as any)?.response?.data?.error ?? 'Submission failed'}
        </div>
      )}

      {/* Sticky column headers */}
      <div className="grid shrink-0 border-b border-gray-200 bg-white" style={{ gridTemplateColumns: '20% 40% 40%' }}>
        <div className="px-4 py-2 bg-gray-800 text-white text-xs font-semibold uppercase tracking-wider border-r border-gray-700">
          My Progress
        </div>
        <div className="px-6 py-2 bg-blue-600 text-white text-xs font-semibold uppercase tracking-wider border-r border-blue-700">
          Reference Data
        </div>
        <div className="px-6 py-2 bg-gray-700 text-white text-xs font-semibold uppercase tracking-wider">
          Enter Data
        </div>
      </div>

      {/* Rows — single scroll, perfectly aligned */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── Left stats panel (20%) — fixed height, independent scroll ── */}
        <div className="shrink-0 bg-gray-50 border-r border-gray-200 p-4 flex flex-col gap-3 overflow-y-auto h-full" style={{ width: '20%' }}>
          {/* Session */}
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Session</p>
            <p className="text-sm font-bold text-gray-800">Session {activeSession?.session_number ?? '—'} of 2</p>
            <p className={`text-2xl font-mono font-bold mt-1 ${remainingSeconds <= 5*60 ? 'text-red-600' : remainingSeconds <= 30*60 ? 'text-amber-600' : 'text-green-600'}`}>
              {formatSeconds(remainingSeconds)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">remaining in session</p>
          </div>
          {/* Record */}
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Current Record</p>
            <p className="text-xl font-bold text-blue-600 font-mono">{data?.record.record_code ?? '—'}</p>
          </div>
          {/* Progress */}
          {progress && (
            <div className="bg-white rounded-xl border border-gray-200 p-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Pages</p>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500">Total</span>
                <span className="font-semibold text-gray-800">{progress.total}</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500">Done</span>
                <span className="font-semibold text-green-600">{progress.completed}</span>
              </div>
              <div className="flex justify-between text-sm pt-1 border-t border-gray-100">
                <span className="text-gray-500">Pending</span>
                <span className="font-semibold text-blue-600">{progress.pending}</span>
              </div>
              {/* Progress bar */}
              <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%` }} />
              </div>
            </div>
          )}
          {/* User */}
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">User</p>
            <p className="text-sm font-medium text-gray-800 truncate">{user?.name ?? '—'}</p>
            <p className="text-xs text-blue-600 font-mono mt-0.5">{user?.display_id ?? ''}</p>
          </div>
        </div>

        {/* ── Reference + Enter Data (80%) ── */}
        <div className="overflow-y-auto" style={{ width: '80%' }}>
        {inputFields.map((inputField, idx) => {
          const refField = referenceFields[idx]
          const refValue = refField ? values[refField.column_key] : ''
          const error = fieldErrors[inputField.column_key]
          const showGroupHeader = inputField.group && (idx === 0 || inputField.group !== inputFields[idx - 1].group)

          return (
            <div key={inputField.id}>
              {showGroupHeader && (
                <div className="bg-indigo-100 text-indigo-800 px-6 py-2 text-xs font-bold uppercase tracking-widest text-center col-span-2">
                  {inputField.group}
                </div>
              )}
              <div
                data-field-error={error ? 'true' : undefined}
                className={`grid grid-cols-2 border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
              >
              {/* Left cell — reference value */}
              <div className="px-6 py-4 border-r border-gray-200 bg-blue-50 flex flex-col justify-center">
                <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-0.5">
                  {refField?.label ?? ''}
                </p>
                <p className="text-gray-900 font-medium text-sm break-words">
                  {refValue || '—'}
                </p>
              </div>

              {/* Right cell — input field */}
              <div className="px-6 py-4 flex flex-col justify-center">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  {inputField.label} <span className="text-red-500">*</span>
                </label>
                <FieldInput
                  key={`${data.record.id}-${inputField.column_key}`}
                  field={inputField}
                  value={inputField.field_type === 'fixed' ? refValue : (inputs[inputField.column_key] ?? '')}
                  error={error}
                  onChange={(val) => {
                    setInputs((prev) => ({ ...prev, [inputField.column_key]: val }))
                    if (error)
                      setFieldErrors((prev) => { const n = { ...prev }; delete n[inputField.column_key]; return n })
                  }}
                />
              </div>
            </div>
            </div>
          )
        })}
        </div>
      </div>
    </div>
  )
}

interface FieldInputProps {
  field: FieldConfig
  value: string
  error?: string
  onChange: (val: string) => void
}

function FieldInput({ field, value, error, onChange }: FieldInputProps) {
  const base = `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-colors ${
    error
      ? 'border-red-400 bg-red-50 focus:ring-red-400'
      : 'border-gray-300 focus:ring-blue-500 focus:border-transparent'
  }`

  const noPaste = {
    onPaste:  (e: React.ClipboardEvent) => e.preventDefault(),
    onCopy:   (e: React.ClipboardEvent) => e.preventDefault(),
    onCut:    (e: React.ClipboardEvent) => e.preventDefault(),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  }

  return (
    <div>
      {field.field_type === 'fixed' ? (
        <input type="text" value={value} readOnly
          className={`w-full border rounded-lg px-3 py-2 text-sm bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200`} />
      ) : field.field_type === 'dropdown' ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={base} {...noPaste}>
          <option value="">Select…</option>
          {field.dropdown_options?.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : field.field_type === 'date' ? (
        <DatePartsInput value={value} onChange={onChange} className={base} />
      ) : field.field_type === 'number' ? (
        <input type="number" value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${field.label}`} className={base} {...noPaste} />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${field.label}`} className={base} {...noPaste} />
      )}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: CURRENT_YEAR - 1899 }, (_, i) => CURRENT_YEAR - i)

function DatePartsInput({ value, onChange, className }: { value: string; onChange: (v: string) => void; className: string }) {
  const parts = value ? value.split(' ') : []
  const day   = parts[0] ?? ''
  const month = parts[1] ?? ''
  const year  = parts[2] ?? ''

  const update = (d: string, m: string, y: string) => {
    if (d && m && y) onChange(`${d} ${m} ${y}`)
    else onChange('')
  }

  const sel = `${className} mr-1`
  return (
    <div className="flex gap-1">
      <select value={day} onChange={e => update(e.target.value, month, year)} className={sel}>
        <option value="">Day</option>
        {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={String(d)}>{d}</option>)}
      </select>
      <select value={month} onChange={e => update(day, e.target.value, year)} className={sel}>
        <option value="">Month</option>
        {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
      <select value={year} onChange={e => update(day, month, e.target.value)} className={sel}>
        <option value="">Year</option>
        {YEARS.map(y => <option key={y} value={String(y)}>{y}</option>)}
      </select>
    </div>
  )
}
