import { useState, useEffect, useRef } from 'react'
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
    staleTime: Infinity,          // hold the record until explicit invalidation
    refetchOnMount: true,
    refetchOnWindowFocus: false,  // never swap record just because window regained focus
  })

  const { data: progress } = useQuery({
    queryKey: ['record-progress'],
    queryFn: () => getRecordProgress().then((r) => r.data.data),
    refetchOnWindowFocus: false,
  })

  // Track records completed at the start of the current session for Shift Qty
  const initialCompletedRef = useRef<number | null>(null)
  useEffect(() => { initialCompletedRef.current = null }, [activeSession?.id])
  useEffect(() => {
    if (progress !== undefined && initialCompletedRef.current === null)
      initialCompletedRef.current = progress.completed
  }, [progress])
  const qty = progress && initialCompletedRef.current !== null
    ? progress.completed - initialCompletedRef.current
    : 0

  const submitMutation = useMutation({
    mutationFn: () =>
      submitRecord(data!.record.id, activeSession!.id, inputs).then((r) => r.data.data),
    onSuccess: () => {
      setSubmitSuccess(true)
      setInputs({})
      setFieldErrors({})
      // Remove cached record so next fetch loads the real next one
      qc.removeQueries({ queryKey: ['next-record'] })
      qc.invalidateQueries({ queryKey: ['record-progress'] })
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
      if (f.field_type === 'date'   && !/^\d{2}-\d{2}-\d{4}$/.test(val)) errs[f.column_key] = 'Must be a valid date (DD-MM-YYYY)'
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
        displayId:   user?.display_id ?? '—',
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
        <p className="text-gray-600 text-lg">Session ended or transferred to another device.</p>
        <button onClick={() => navigate('/session')}
          className="bg-teal-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-teal-700">
          Go to Session Start
        </button>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
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
      <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between text-sm shrink-0 shadow-sm">
        <span className="text-gray-500">
          Record <span className="font-semibold text-gray-800">{data.record.record_code}</span>
        </span>
        <div className="flex items-center gap-2">
          {screenshotMsg && <span className="text-green-600 font-medium">{screenshotMsg}</span>}
          {submitSuccess  && <span className="text-green-600 font-medium">✅ Submitted!</span>}
          <button onClick={handleScreenshot}
            className="flex items-center gap-1.5 px-4 py-2 border border-teal-300 text-teal-700 bg-teal-50 rounded-lg text-sm font-medium transition-all hover:bg-teal-100 active:scale-95">
            📷 Take Screenshot
          </button>
          <button onClick={handleSubmit} disabled={submitMutation.isPending}
            className="flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-lg text-sm font-semibold transition-all shadow-md hover:from-teal-700 hover:to-teal-600 hover:shadow-lg hover:shadow-teal-500/30 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
            {submitMutation.isPending ? 'Submitting…' : 'Submit & Next'}
          </button>
        </div>
      </div>

      {submitMutation.isError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-red-700 text-sm shrink-0">
          {(submitMutation.error as any)?.response?.data?.error ?? 'Submission failed'}
        </div>
      )}

      {/* Columns */}
      <div className="flex-1 flex gap-2 p-2 overflow-hidden bg-slate-300">

        {/* ── Overview (20%) ── */}
        <div className="shrink-0 rounded-xl overflow-hidden shadow-lg border border-teal-400 flex flex-col" style={{ width: '20%' }}>
          <div className="bg-gradient-to-r from-teal-800 to-teal-600 px-4 py-2.5 shrink-0 border-b-2 border-teal-500">
            <span className="text-white text-sm font-bold uppercase tracking-wider">Overview</span>
          </div>
          <div className="flex-1 overflow-y-auto flex flex-col bg-teal-50/20">

          {/* User header */}
          <div className="bg-gradient-to-br from-teal-700 to-teal-900 px-3 pt-3 pb-2 flex flex-col items-center gap-1.5 shrink-0">
            <div className="flex items-center justify-center gap-2 w-full">
              <div className="w-9 h-9 rounded-full bg-teal-400 ring-2 ring-teal-300/60 flex items-center justify-center text-white font-bold text-base select-none shrink-0">
                {user?.name?.charAt(0).toUpperCase() ?? 'M'}
              </div>
              <div className="min-w-0">
                <p className="text-white font-bold text-sm leading-tight">{user?.display_id ?? '—'}</p>
                <p className="text-teal-200 text-xs mt-0.5 truncate">{user?.name ?? '—'}</p>
              </div>
            </div>
            <div className="w-full pt-1.5 border-t border-white/20 text-center">
              <span className="inline-block bg-teal-500/30 border border-teal-300/70 ring-1 ring-teal-300/40 shadow-sm text-white font-mono font-bold text-xs px-3 py-0.5 rounded-full">
                {data.record.record_code}
              </span>
            </div>
          </div>

          {/* Project Details */}
          <div className="shrink-0 px-3 pt-3 pb-2">
            <div className="border border-teal-400 rounded overflow-hidden shadow-sm bg-white">
            <div className="bg-teal-600 px-3 py-1.5">
              <p className="text-xs font-bold uppercase tracking-widest text-white">Project Details</p>
            </div>
            <div className="px-3 py-1.5 space-y-1">
              {(() => {
                const tp = computeTestPeriod(user?.approved_at)
                return (
                  <>
                    <InfoRow label="Project No"   value="MMT_PRO001" />
                    <InfoRow label="Test Session" value={tp ? `Test ${tp.period}` : '—'} valueClass="text-black font-bold" />
                    <InfoRow label="Day"          value={tp ? `${tp.dayOfPeriod} / 40` : '—'} />
                    <InfoRow label="Start Date"   value={tp ? formatDDMMYYYY(tp.pStart) : formatDDMMYYYY(user?.approved_at)} />
                    <InfoRow label="End Date"     value={tp ? formatDDMMYYYY(tp.pEnd) : formatDDMMYYYY(addDays(user?.approved_at, 39))} />
                    <InfoRow label="Days Left"    value={tp ? String(tp.daysRemaining) : '—'} />
                    <InfoRow label="Status"       value="OPEN" valueClass="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full" />
                  </>
                )
              })()}
            </div>

            {/* Totals grid */}
            <div className="mx-3 my-2 rounded-lg border border-teal-400 overflow-hidden bg-white">
              <div className="grid grid-cols-4 text-center border-b border-teal-300">
                {['Total','Min','Done','Left'].map(h => (
                  <div key={h} className={`border-r border-teal-300 last:border-r-0 px-1 py-1.5 ${h === 'Done' ? 'bg-green-50' : h === 'Left' ? 'bg-teal-50' : ''}`}>
                    <p className="text-xs font-bold uppercase tracking-wide text-black">{h}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-4 text-center">
                {[
                  { val: 2500,                              cls: 'text-black' },
                  { val: 2500,                              cls: 'text-black' },
                  { val: progress?.completed ?? 0,          cls: 'text-black' },
                  { val: 2500 - (progress?.completed ?? 0), cls: 'text-black' },
                ].map(({ val, cls }, i) => (
                  <div key={i} className="border-r border-teal-300 last:border-r-0 px-1 py-2">
                    <p className={`text-sm font-bold ${cls}`}>{val}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Records progress */}
            {(() => {
              const done = progress?.completed ?? 0
              const pct  = Math.min(100, (done / 2500) * 100)
              return (
                <div className="px-3 py-2">
                  <div className="flex justify-between text-xs text-gray-800 font-bold mb-0.5">
                    <span>Records</span><span>{done} / 2500</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })()}
            </div>
          </div>

          {/* Shift Details in overview */}
          <div className="shrink-0 px-3 pb-3">
            <div className="border border-teal-400 rounded overflow-hidden shadow-sm bg-white">
              <div className="bg-teal-600 text-white px-3 py-1.5 text-xs font-bold uppercase tracking-widest">Shift Details</div>
              <div className="px-3 py-1.5 space-y-1">
                <ShiftRow label="Project No"  value="MMT_PRO001" />
                <ShiftRow label="Session"     value={activeSession ? sessionOrdinal(activeSession.session_number) : '—'} />
                <ShiftRow label="From"        value={formatDDMMYYYYHHMM(activeSession?.started_at)} />
                <ShiftRow label="To"          value={formatDDMMYYYYHHMM(activeSession?.started_at ? shiftEndTime(activeSession.started_at) : null)} />
                <ShiftRow label="Quantity"    value={String(qty)} />
                <ShiftRow label="Status"      value={activeSession?.status === 'active' ? 'OPEN' : 'CLOSED'} />
              </div>
              <div className={`text-center py-2 text-xl font-bold font-mono tracking-widest text-white select-none ${
                remainingSeconds <= 5*60 ? 'bg-red-500 animate-pulse' : remainingSeconds <= 30*60 ? 'bg-amber-500' : 'bg-teal-700'
              }`}>
                {formatSeconds(remainingSeconds)}
              </div>
            </div>
          </div>
          </div>{/* end scroll wrapper */}

        </div>

        {/* ── Reference Data (32%) ── */}
        <div className="shrink-0 rounded-xl overflow-hidden shadow-lg border border-teal-400 flex flex-col" style={{ width: '32%' }}>
          <div className="bg-gradient-to-r from-teal-800 to-teal-600 px-4 py-2.5 shrink-0 border-b-2 border-teal-500">
            <span className="text-white text-sm font-bold uppercase tracking-wider">Reference Data</span>
          </div>

          {/* Scrollable reference fields — flush, no outer padding */}
          <div className="flex-1 overflow-y-auto bg-white">
            {(() => {
              const groups: { name: string; fields: typeof referenceFields }[] = []
              for (const f of referenceFields) {
                const g = f.group || 'General Information'
                const last = groups[groups.length - 1]
                if (last && last.name === g) last.fields.push(f)
                else groups.push({ name: g, fields: [f] })
              }
              return groups.map((group, gi) => (
                <div key={group.name}>
                  <div className={`px-3 pt-1.5 pb-0 ${gi > 0 ? 'mt-1' : ''}`}>
                    <span className="text-black font-extrabold text-sm uppercase tracking-wide">{group.name}</span>
                  </div>
                  {group.fields.map((f) => (
                    <div key={f.column_key} className="px-3 py-0.5 bg-white text-[13px] leading-snug">
                      <span className="text-black font-bold">{f.label}</span>
                      <span className="text-black font-extrabold mx-1">:</span>
                      <span className="text-black font-semibold">{values[f.column_key] || '—'}</span>
                    </div>
                  ))}
                </div>
              ))
            })()}
          </div>

          {/* Shift Details — pinned at bottom */}
          <div className="shrink-0 border-t-2 border-teal-500">
            <div className="bg-teal-600 text-white px-3 py-1.5 text-xs font-bold uppercase tracking-widest">
              Shift Details
            </div>
              <div className="px-3 py-1.5 space-y-1">
                <ShiftRow label="Project No"  value="MMT_PRO001" />
                <ShiftRow label="Session"     value={activeSession ? sessionOrdinal(activeSession.session_number) : '—'} />
                <ShiftRow label="From"        value={formatDDMMYYYYHHMMSS(activeSession?.started_at)} />
                <ShiftRow label="To"          value={formatDDMMYYYYHHMMSS(activeSession?.started_at ? shiftEndTime(activeSession.started_at) : null)} />
                <ShiftRow label="Quantity"    value={String(qty)} />
                <ShiftRow label="Status"      value={activeSession?.status === 'active' ? 'OPEN' : 'CLOSED'} />
              </div>
              <div className={`text-center py-2 text-2xl font-bold font-mono tracking-widest text-white select-none ${
                remainingSeconds <= 5*60 ? 'bg-red-500 animate-pulse' : remainingSeconds <= 30*60 ? 'bg-amber-500' : 'bg-teal-700'
              }`}>
                {formatSeconds(remainingSeconds)}
              </div>
          </div>

        </div>

        {/* ── Enter Data (flex-1, takes remaining ~48%) ── */}
        <div className="flex-1 rounded-xl overflow-hidden shadow-lg border border-teal-400 flex flex-col">
          <div className="bg-gradient-to-r from-teal-800 to-teal-600 px-4 py-2.5 shrink-0 border-b-2 border-teal-500">
            <span className="text-white text-sm font-bold uppercase tracking-wider">Enter Data</span>
          </div>
          <div className="flex-1 overflow-y-auto bg-teal-50/40">
            <div className="p-2 pb-4 flex flex-col gap-2">
            {(() => {
              const groups: { name: string; pairs: { field: typeof inputFields[0]; idx: number }[] }[] = []
              inputFields.forEach((f, i) => {
                const g = f.group || 'Data Entry'
                const last = groups[groups.length - 1]
                if (last && last.name === g) last.pairs.push({ field: f, idx: i })
                else groups.push({ name: g, pairs: [{ field: f, idx: i }] })
              })
              return groups.map(group => (
                <div key={group.name} className="border border-teal-400 rounded overflow-hidden shadow-sm bg-white">
                  <div className="bg-teal-600 text-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest">
                    {group.name}
                  </div>
                  {group.pairs.map(({ field: inputField, idx: globalIdx }, localIdx) => {
                    const refField = referenceFields[globalIdx]
                    const refValue = refField ? values[refField.column_key] : ''
                    const error    = fieldErrors[inputField.column_key]
                    return (
                      <div
                        key={inputField.id}
                        data-field-error={error ? 'true' : undefined}
                        className={`flex items-start gap-3 px-3 py-1 border-b border-gray-100 last:border-b-0 ${localIdx % 2 === 0 ? 'bg-white' : 'bg-teal-50/30'}`}>
                        <label className="text-base font-semibold text-teal-700 shrink-0 w-40 text-left pt-0.5 leading-tight">
                          {inputField.label}
                          {inputField.field_type !== 'fixed' && <span className="text-red-400 ml-0.5">*</span>}
                        </label>
                        <div className="flex-1 min-w-0">
                          <FieldInput
                            key={`${data.record.id}-${inputField.column_key}`}
                            field={inputField}
                            value={inputField.field_type === 'fixed' ? refValue : (inputs[inputField.column_key] ?? '')}
                            error={error}
                            onChange={(val) => {
                              setInputs(prev => ({ ...prev, [inputField.column_key]: val }))
                              if (error) setFieldErrors(prev => { const n = { ...prev }; delete n[inputField.column_key]; return n })
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))
            })()}
            </div>{/* end p-3 content */}
          </div>{/* end scroll wrapper */}
        </div>{/* end enter data box */}

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
  const base = `w-full border rounded-lg px-3 py-1.5 text-base font-medium focus:outline-none focus:ring-2 transition-colors ${
    error
      ? 'border-red-400 bg-red-50 focus:ring-red-400'
      : 'border-teal-200 focus:ring-2 focus:ring-teal-400 focus:border-teal-400'
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
          className={`w-full border rounded-lg px-3 py-1.5 text-base bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200`} />
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
          placeholder={field.label} className={base} {...noPaste} />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={field.label} className={base} {...noPaste} />
      )}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: CURRENT_YEAR - 1899 }, (_, i) => CURRENT_YEAR - i)

// ── Left panel helpers ──────────────────────────────────────────────────────


function formatDDMMYYYY(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`
}

function formatDDMMYYYYHHMMSS(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const date = `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`
  const time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`
  return `${date} ${time}`
}

function formatDDMMYYYYHHMM(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const date = `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`
  const time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  return `${date} ${time}`
}

function addDays(iso: string | null | undefined, days: number): string | null {
  if (!iso) return null
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

function computeTestPeriod(approvedAt: string | null | undefined) {
  if (!approvedAt) return null
  const start = new Date(approvedAt)
  start.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const daysSince = Math.floor((today.getTime() - start.getTime()) / 86400000)
  const period = Math.floor(daysSince / 40) + 1
  const pStart = new Date(start.getTime() + (period - 1) * 40 * 86400000)
  const pEnd   = new Date(start.getTime() + period * 40 * 86400000 - 86400000)
  const daysRemaining = Math.max(0, Math.floor((pEnd.getTime() - today.getTime()) / 86400000) + 1)
  const dayOfPeriod   = daysSince - (period - 1) * 40 + 1
  return { period, pStart: pStart.toISOString(), pEnd: pEnd.toISOString(), daysRemaining, dayOfPeriod }
}

function sessionOrdinal(n: number): string {
  if (n === 1) return '1st'
  if (n === 2) return '2nd (Last)'
  return `${n}th`
}

// End time = start + 4h, but capped at midnight of the start day
function shiftEndTime(startedAt: string): string {
  const start    = new Date(startedAt)
  const fourHrs  = new Date(start.getTime() + 4 * 60 * 60 * 1000)
  const midnight = new Date(start)
  midnight.setDate(midnight.getDate() + 1)
  midnight.setHours(0, 0, 0, 0)
  return new Date(Math.min(fourHrs.getTime(), midnight.getTime())).toISOString()
}

function InfoRow({ label, value, valueClass = 'text-gray-900 font-bold' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-baseline gap-1 min-w-0">
      <span className="text-black font-extrabold shrink-0 w-20 text-xs">{label}</span>
      <span className="text-black shrink-0 text-xs">:</span>
      <span className={`text-sm font-bold break-words min-w-0 ${valueClass}`}>{value}</span>
    </div>
  )
}

function ShiftRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1 min-w-0">
      <span className="text-black font-extrabold shrink-0 w-20 text-xs">{label}</span>
      <span className="text-black shrink-0 text-xs">:</span>
      <span className="text-sm text-gray-900 font-extrabold break-words min-w-0">{value}</span>
    </div>
  )
}

function DatePartsInput({ value, onChange, className }: { value: string; onChange: (v: string) => void; className: string }) {
  // value stored as DD-MM-YYYY to match Excel format
  const parts = value ? value.split('-') : []
  const day   = parts[0] ? String(parseInt(parts[0])) : ''
  const month = parts[1] ? MONTHS[parseInt(parts[1]) - 1] ?? '' : ''
  const year  = parts[2] ?? ''

  const update = (d: string, m: string, y: string) => {
    if (d && m && y) {
      const dd = d.padStart(2, '0')
      const mm = String(MONTHS.indexOf(m) + 1).padStart(2, '0')
      onChange(`${dd}-${mm}-${y}`)
    } else {
      onChange('')
    }
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
