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
    staleTime: 0,       // always re-fetch fresh after submit
    refetchOnMount: true,
  })

  const { data: progress } = useQuery({
    queryKey: ['record-progress'],
    queryFn: () => getRecordProgress().then((r) => r.data.data),
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
          className="bg-sky-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-sky-700">
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
            className="flex items-center gap-1.5 px-4 py-2 border border-sky-300 text-sky-700 bg-sky-50 rounded-lg text-sm font-medium transition-all duration-150 hover:bg-sky-100 hover:border-sky-400 hover:shadow-sm active:scale-95">
            📷 Take Screenshot
          </button>
          <button onClick={handleSubmit} disabled={submitMutation.isPending}
            className="flex items-center gap-1.5 px-5 py-2 bg-sky-600 text-white rounded-lg text-sm font-semibold transition-all duration-150 hover:bg-sky-700 hover:shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100">
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
      <div className="grid shrink-0 border-b border-slate-200" style={{ gridTemplateColumns: '20% 40% 40%' }}>
        <div className="bg-sky-100 border-r border-sky-200 px-4 py-2.5 flex items-center">
          <span className="text-sky-700 text-xs font-semibold uppercase tracking-wider border-l-2 border-sky-500 pl-2">
            Overview
          </span>
        </div>
        <div className="px-4 py-2.5 flex items-center border-r border-sky-200 bg-sky-100">
          <span className="text-sky-700 text-xs font-semibold uppercase tracking-wider border-l-2 border-sky-500 pl-2">
            Reference Data
          </span>
        </div>
        <div className="px-4 py-2.5 flex items-center bg-sky-100">
          <span className="text-sky-700 text-xs font-semibold uppercase tracking-wider border-l-2 border-sky-500 pl-2">
            Enter Data
          </span>
        </div>
      </div>

      {/* Rows */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── Left panel (20%) ── */}
        <div className="shrink-0 bg-slate-50 border-r border-slate-200 overflow-y-auto h-full flex flex-col" style={{ width: '20%' }}>

          {/* Section 1+2 — User Header + Current Record + Timer (unified gradient block) */}
          <div className="bg-gradient-to-br from-sky-600 to-sky-800 px-4 pt-4 pb-3 flex flex-col items-center gap-2 shrink-0">
            <div className="w-12 h-12 rounded-full bg-sky-400 ring-2 ring-sky-300/60 flex items-center justify-center text-white font-bold text-lg select-none">
              {getInitials(user?.name)}
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-base leading-tight">{user?.display_id ?? '—'}</p>
              <p className="text-sky-200 text-xs mt-0.5 truncate max-w-[140px]">{user?.name ?? '—'}</p>
            </div>
            {/* Current Record + Timer */}
            <div className="w-full pt-2 border-t border-white/20 text-center">
              <p className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-1">Current Record</p>
              <span className="inline-block bg-white/15 border border-white/20 text-white font-mono font-bold text-sm px-3 py-1.5 rounded-full mt-0.5">{data?.record.record_code ?? '—'}</span>
              <p className={`text-2xl font-mono font-bold mt-2 ${
                remainingSeconds <= 5*60 ? 'text-red-300' :
                remainingSeconds <= 30*60 ? 'text-white' : 'text-green-300'
              }`}>{formatSeconds(remainingSeconds)}</p>
              <p className="text-xs text-white/50 mt-0.5 mb-2">remaining in session</p>
              {(() => {
                const SESSION_SECS = 4 * 60 * 60
                const elapsed = SESSION_SECS - remainingSeconds
                const pct = Math.min(100, (elapsed / SESSION_SECS) * 100)
                const barColor = remainingSeconds <= 5*60 ? 'bg-red-300' : remainingSeconds <= 30*60 ? 'bg-white/80' : 'bg-green-300'
                return (
                  <div>
                    <div className="flex justify-between text-[10px] text-white/50 mb-0.5">
                      <span>Session time</span>
                      <span>{Math.round(pct)}%</span>
                    </div>
                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-1000 ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>

          {/* Section 3 — Project Details */}
          <div className="shrink-0">
            <div className="px-3 pt-3 pb-1 ml-1 border-l-2 border-sky-300">
              <p className="text-[10px] font-bold uppercase tracking-widest text-sky-500">Project Details</p>
            </div>
            <div className="px-3 py-2 space-y-1.5 border-b border-gray-100">
              {(() => {
                const tp = computeTestPeriod(user?.approved_at)
                return (
                  <>
                    <InfoRow label="Project No"    value="MMT_PRO001" />
                    <InfoRow label="Test Session"  value={tp ? `Test ${tp.period}` : '—'}
                             valueClass="text-sky-600 font-bold" />
                    <InfoRow label="Day"           value={tp ? `${tp.dayOfPeriod} / 40` : '—'} />
                    <InfoRow label="Start Date"    value={tp ? formatDDMMYYYY(tp.pStart) : formatDDMMYYYY(user?.approved_at)} />
                    <InfoRow label="End Date"      value={tp ? formatDDMMYYYY(tp.pEnd) : formatDDMMYYYY(addDays(user?.approved_at, 39))} />
                    <InfoRow label="Days Left"     value={tp ? String(tp.daysRemaining) : '—'} />
                    <InfoRow label="Status"        value="OPEN" valueClass="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full" />
                  </>
                )
              })()}
            </div>
            {/* Total | Minimum | Finish | Balance table */}
            <div className="mx-3 my-2 rounded-lg border border-slate-200 overflow-hidden bg-white">
              <div className="grid grid-cols-4 text-center border-b border-slate-100">
                {['Total','Minimum','Finish','Balance'].map(h => (
                  <div key={h} className="border-r border-slate-100 last:border-r-0 px-1 py-1.5">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{h}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-4 text-center">
                {[
                  { val: 2500,                              cls: 'text-slate-700' },
                  { val: 2500,                              cls: 'text-slate-700' },
                  { val: progress?.completed ?? 0,          cls: 'text-green-600' },
                  { val: 2500 - (progress?.completed ?? 0), cls: 'text-sky-600' },
                ].map(({ val, cls }, i) => (
                  <div key={i} className="border-r border-slate-100 last:border-r-0 px-1 py-2">
                    <p className={`text-sm font-bold ${cls}`}>{val}</p>
                  </div>
                ))}
              </div>
            </div>
            {/* Records progress bar */}
            {(() => {
              const finished = progress?.completed ?? 0
              const pct = Math.min(100, (finished / 2500) * 100)
              return (
                <div className="px-3 py-2 border-b border-gray-100">
                  <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                    <span>Records progress</span>
                    <span>{finished} / 2500</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })()}
          </div>

          {/* Section 4 — Shift Details */}
          <div className="shrink-0">
            <div className="px-3 pt-3 pb-1 ml-1 border-l-2 border-sky-300">
              <p className="text-[10px] font-bold uppercase tracking-widest text-sky-500">Shift Details</p>
            </div>
            <div className="px-3 py-2 space-y-1.5">
              <InfoRow label="Session"    value={activeSession ? `${activeSession.session_number} of 2` : '—'} />
              <InfoRow label="Project No" value={activeSession ? sessionOrdinal(activeSession.session_number) : '—'} />
              <InfoRow label="Start Date" value={formatDDMMYYYYHHMMSS(activeSession?.started_at)} />
              <InfoRow
                label="End Date"
                value={formatDDMMYYYYHHMMSS(
                  activeSession?.started_at ? shiftEndTime(activeSession.started_at) : null
                )}
              />
              <InfoRow label="Qty"    value={String(qty)} />
              <InfoRow
                label="Status"
                value={activeSession?.status === 'active' ? 'OPEN' : 'CLOSED'}
                valueClass={activeSession?.status === 'active' ? 'bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full' : 'bg-red-100 text-red-600 text-xs font-semibold px-2 py-0.5 rounded-full'}
              />
              {(() => {
                const vd = user?.credential_valid_until
                if (!vd) return null
                const days = Math.floor((new Date(vd).getTime() - Date.now()) / 86400000)
                const cls = days < 0 ? 'text-red-600 font-bold' : days <= 30 ? 'text-red-500 font-bold' : days <= 90 ? 'text-sky-600 font-semibold' : 'text-green-600 font-semibold'
                const label = days < 0 ? 'Expired' : `${days}d left`
                return (
                  <>
                    <InfoRow label="Valid Until" value={formatDDMMYYYY(vd)} />
                    <InfoRow label="Validity"    value={label} valueClass={cls} />
                  </>
                )
              })()}
            </div>
          </div>

        </div>

        {/* ── Reference Data (40%) ── */}
        <div className="overflow-y-auto h-full border-r border-slate-200 bg-slate-50" style={{ width: '40%' }}>
          {inputFields.map((inputField, idx) => {
            const refField = referenceFields[idx]
            const refValue = refField ? values[refField.column_key] : ''
            const showGroupHeader = inputField.group && (idx === 0 || inputField.group !== inputFields[idx - 1].group)
            return (
              <div key={inputField.id}>
                {showGroupHeader && (
                  <div className="bg-slate-100 text-slate-500 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-center border-b border-slate-200">
                    {inputField.group}
                  </div>
                )}
                <div className={`flex items-baseline gap-1.5 px-3 py-1.5 border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                  <span className="text-xs font-medium text-slate-500 shrink-0 whitespace-nowrap">{refField?.label ?? ''}</span>
                  <span className="text-slate-300 shrink-0">:</span>
                  <span className="text-sm text-slate-800 font-medium break-all">{refValue || '—'}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Enter Data (40%) ── */}
        <div className="overflow-y-auto h-full bg-white" style={{ width: '40%' }}>
          {inputFields.map((inputField, idx) => {
            const refField = referenceFields[idx]
            const refValue = refField ? values[refField.column_key] : ''
            const error = fieldErrors[inputField.column_key]
            const showGroupHeader = inputField.group && (idx === 0 || inputField.group !== inputFields[idx - 1].group)
            return (
              <div key={inputField.id}>
                {showGroupHeader && (
                  <div className="bg-slate-100 text-slate-500 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-center border-b border-slate-200">
                    {inputField.group}
                  </div>
                )}
                <div
                  data-field-error={error ? 'true' : undefined}
                  className={`px-3 py-2 border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">
                    {inputField.label} <span className="text-red-400 font-bold">*</span>
                  </label>
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
      : 'border-sky-200 focus:ring-2 focus:ring-sky-400 focus:border-sky-400'
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

function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

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

function InfoRow({ label, value, valueClass = 'text-gray-800' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-baseline gap-1 min-w-0">
      <span className="text-[11px] text-gray-400 shrink-0 w-20">{label}</span>
      <span className="text-[11px] text-gray-300 shrink-0">:</span>
      <span className={`text-xs font-semibold break-all ${valueClass}`}>{value}</span>
    </div>
  )
}

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
