import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getTodaySummary, startSession, getActiveSession, takeover } from '../api/sessions'
import { getRecordProgress } from '../api/data'
import { useSession } from '../context/SessionContext'
import { useAuth } from '../context/AuthContext'
import { formatSeconds } from '../lib/utils'
import { useDeviceFingerprint } from '../hooks/useDeviceFingerprint'

const MAX_DAILY = 8 * 60 * 60

export function SessionStartPage() {
  const navigate = useNavigate()
  const { activeSession, setActiveSession, remainingSeconds } = useSession()
  const { user } = useAuth()
  const { deviceId, deviceName } = useDeviceFingerprint()
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState('')
  const [conflictSession, setConflictSession] = useState<{ id: string; session_number: number; device_name?: string | null } | null>(null)
  const [isTakingOver, setIsTakingOver] = useState(false)
  const [dailyRemaining, setDailyRemaining] = useState<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { data: summary, isLoading } = useQuery({
    queryKey: ['today-summary'],
    queryFn: () => getTodaySummary().then((r) => r.data.data),
  })

  const { data: progress } = useQuery({
    queryKey: ['record-progress'],
    queryFn: () => getRecordProgress().then((r) => r.data.data),
  })

  useEffect(() => {
    if (summary?.remaining_daily_seconds === undefined) return
    setDailyRemaining(summary.remaining_daily_seconds)
    if (timerRef.current) clearInterval(timerRef.current)
    // Only countdown if remaining < 8hrs (midnight is the binding constraint)
    if (summary.remaining_daily_seconds < MAX_DAILY) {
      timerRef.current = setInterval(() => {
        setDailyRemaining(prev => (prev !== null && prev > 0 ? prev - 1 : 0))
      }, 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [summary?.remaining_daily_seconds])

  const [sessionMsg, setSessionMsg] = useState('')

  const handleStart = async () => {
    if (!deviceId) return
    setError('')
    setConflictSession(null)
    setIsStarting(true)
    try {
      const res = await startSession(deviceName)
      const sess = res.data.data
      setActiveSession(sess)
      const action = sess.elapsed_seconds > 0 ? 'resumed' : 'started'
      setSessionMsg(`Session ${sess.session_number} of 2 ${action}!`)
      setTimeout(() => navigate('/data-entry'), 1500)
    } catch (err: any) {
      const msg: string = err.response?.data?.error || ''
      if (msg.toLowerCase().includes('different device')) {
        try {
          const activeRes = await getActiveSession()
          setConflictSession(activeRes.data.data)
        } catch {
          setError(msg || 'Failed to start session.')
        }
      } else {
        setError(msg || 'Failed to start session.')
      }
      setIsStarting(false)
    }
  }

  const handleTakeover = async () => {
    if (!conflictSession) return
    setIsTakingOver(true)
    try {
      await takeover(conflictSession.id)
      const res = await startSession(deviceName)
      const sess = res.data.data
      setActiveSession(sess)
      setSessionMsg(`Session ${sess.session_number} of 2 resumed!`)
      setTimeout(() => navigate('/data-entry'), 1500)
    } catch {
      setError('Failed to switch device. Please try again.')
      setConflictSession(null)
    } finally {
      setIsTakingOver(false)
    }
  }

  const canStart = summary
    ? summary.sessions_used < summary.sessions_allowed &&
      (dailyRemaining ?? 0) > 0
    : false

  // ── Active session view ──────────────────────────────────────────────────
  if (activeSession) {
    const timerColor = remainingSeconds <= 5 * 60 ? 'text-red-600' :
                       remainingSeconds <= 30 * 60 ? 'text-amber-600' : 'text-green-600'

    return (
      <div className="flex-1 flex flex-col overflow-y-auto p-4">
        {sessionMsg && (
          <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/40">
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden w-72 text-center">
              <div className="bg-gradient-to-r from-teal-700 to-teal-500 px-10 py-6">
                <div className="text-4xl mb-2">▶️</div>
                <p className="text-lg font-bold text-white">{sessionMsg}</p>
              </div>
              <p className="text-sm text-teal-600 font-medium py-3">Taking you to the test…</p>
            </div>
          </div>
        )}
        <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 text-center m-auto">
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-6">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Session {activeSession.session_number} of 2 — Active
          </div>

          <p className="text-base font-extrabold text-gray-900 uppercase tracking-widest mb-1 flex items-center gap-1">
            Time remaining in session
            <span className="relative group cursor-help">
              <span className="w-4 h-4 rounded-full bg-teal-100 text-teal-600 text-[10px] font-bold inline-flex items-center justify-center leading-none select-none normal-case tracking-normal">i</span>
              <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 bg-gray-900 text-white text-xs rounded-xl px-3 py-2.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 leading-relaxed shadow-lg normal-case tracking-normal">
                How much time is left in your current session.<br /><br />
                Each session has a maximum of 4 hours. The timer counts down from when you started. When it reaches zero, the session ends automatically.
              </span>
            </span>
          </p>
          <p className={`text-6xl font-bold font-mono mb-6 ${timerColor}`}>
            {formatSeconds(remainingSeconds)}
          </p>

          <div className="bg-gray-50 rounded-xl p-4 mb-6 text-base space-y-2.5">
            <div className="flex justify-between">
              <span className="text-black font-extrabold">Session started</span>
              <span className="font-extrabold text-black">
                {new Date(activeSession.started_at).toLocaleTimeString('en-IN', {
                  timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-black font-extrabold">Session number</span>
              <span className="font-extrabold text-black">{activeSession.session_number} / 2</span>
            </div>
            <div className="flex justify-between">
              <span className="text-black font-extrabold">Device</span>
              <span className="font-extrabold text-black truncate max-w-[180px]">
                {activeSession.device_name ?? 'This device'}
              </span>
            </div>
            {dailyRemaining !== null && (
              <div className="flex justify-between pt-2 border-t border-gray-200">
                <span className="text-black font-extrabold">Daily time remaining</span>
                <span className={`font-extrabold font-mono ${dailyRemaining < 3600 ? 'text-amber-600' : 'text-black'}`}>
                  {formatSeconds(dailyRemaining)}
                </span>
              </div>
            )}
          </div>

          {progress && (
            <div className="bg-gray-50 rounded-xl p-4 mb-4 text-base space-y-2.5">
              <p className="text-base font-extrabold text-black uppercase tracking-wider mb-1">Your Progress</p>
              <div className="flex justify-between">
                <span className="text-black font-extrabold">Total pages</span>
                <span className="font-extrabold text-black">{progress.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-black font-extrabold">Completed</span>
                <span className="font-extrabold text-green-600">{progress.completed}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-200">
                <span className="text-black font-extrabold">Pending</span>
                <span className="font-extrabold text-teal-600">{progress.pending}</span>
              </div>
            </div>
          )}

          {remainingSeconds <= 30 * 60 && (
            <div className={`rounded-xl p-3 mb-4 text-xs font-medium ${
              remainingSeconds <= 5 * 60
                ? 'bg-red-50 border border-red-200 text-red-700'
                : 'bg-amber-50 border border-amber-200 text-amber-700'
            }`}>
              ⚠️ Only {formatSeconds(remainingSeconds)} left in this session!
            </div>
          )}

          <button onClick={() => {
              setSessionMsg(`Session ${activeSession.session_number} of 2 resumed!`)
              setTimeout(() => navigate('/data-entry'), 1500)
            }}
            className="w-full bg-teal-600 text-white py-3.5 rounded-xl font-semibold hover:bg-teal-700 active:scale-95 transition-all text-base">
            Continue to MMT Form Filling
          </button>
        </div>
      </div>
    )
  }

  // ── Start new session view ───────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-4">
      {sessionMsg && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden w-72 text-center">
            <div className="bg-gradient-to-r from-teal-700 to-teal-500 px-10 py-6">
              <div className="text-4xl mb-2">🚀</div>
              <p className="text-lg font-bold text-white">{sessionMsg}</p>
            </div>
            <p className="text-sm text-teal-600 font-medium py-3">Taking you to the test…</p>
          </div>
        </div>
      )}
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 m-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Ready to start?</h1>
        {user?.display_id && (
          <p className="text-xs font-mono text-teal-600 mb-1">{user.display_id}</p>
        )}
        <p className="text-gray-500 text-sm font-semibold mb-6">Review your session availability below before starting.</p>

        {progress && (
          <div className="bg-gray-50 rounded-xl p-5 mb-4 space-y-3">
            <p className="text-base font-extrabold text-black uppercase tracking-wider mb-1">Your Progress</p>
            <div className="flex justify-between text-base">
              <span className="text-black font-extrabold">Total pages</span>
              <span className="font-extrabold text-black">{progress.total}</span>
            </div>
            <div className="flex justify-between text-base">
              <span className="text-black font-extrabold">Completed</span>
              <span className="font-extrabold text-green-600">{progress.completed}</span>
            </div>
            <div className="flex justify-between text-base pt-2 border-t border-gray-200">
              <span className="text-black font-extrabold">Pending</span>
              <span className="font-extrabold text-teal-600">{progress.pending}</span>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="h-32 flex items-center justify-center">
            <div className="w-7 h-7 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : summary ? (
          <div className="bg-gray-50 rounded-xl p-5 mb-6 space-y-3">
            <div className="flex justify-between text-base">
              <span className="text-black font-extrabold">Sessions used today</span>
              <span className="font-extrabold text-black">{summary.sessions_used} / {summary.sessions_allowed}</span>
            </div>
            <div className="flex justify-between text-base">
              <span className="text-black font-extrabold">Time used today</span>
              <span className="font-extrabold text-black">{formatSeconds(summary.total_elapsed_seconds)}</span>
            </div>
            <div className="flex justify-between text-base">
              <span className="text-black font-extrabold flex items-center gap-1">
                Time remaining today
                <span className="relative group cursor-help">
                  <span className="w-4 h-4 rounded-full bg-teal-100 text-teal-600 text-[10px] font-bold inline-flex items-center justify-center leading-none select-none">i</span>
                  <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 bg-gray-900 text-white text-xs rounded-xl px-3 py-2.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 leading-relaxed shadow-lg">
                    The smaller of two limits:<br />
                    • Your unused daily quota (8 h − time used today)<br />
                    • Time until midnight IST, when your day resets<br /><br />
                    <span className="text-gray-400">e.g. At 8:30 PM with no work done, only ~3.5 h remain — not the full 8 h.</span>
                  </span>
                </span>
              </span>
              <span className={`font-extrabold font-mono ${(dailyRemaining ?? 0) < 3600 ? 'text-amber-600' : 'text-green-600'}`}>
                {formatSeconds(dailyRemaining ?? 0)}
              </span>
            </div>
            <div className="pt-2 border-t border-gray-200 flex justify-between text-base">
              <span className="text-black font-extrabold">This session (max)</span>
              <span className="font-extrabold text-black">4 hours</span>
            </div>
            {(dailyRemaining ?? 0) < 4 * 3600 && (dailyRemaining ?? 0) > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                ⚠️ Only {formatSeconds(dailyRemaining ?? 0)} left today. Session will auto-end at midnight IST.
              </div>
            )}
          </div>
        ) : null}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">
            {error}
          </div>
        )}

        {conflictSession && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
            <p className="text-sm font-semibold text-amber-800 mb-1">⚠️ Session active on another device</p>
            <p className="text-sm text-amber-700 mb-3">
              Session {conflictSession.session_number} of 2 is running on{' '}
              <span className="font-medium">"{conflictSession.device_name ?? 'another device'}"</span>.
              Switch it to this device?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConflictSession(null)}
                className="flex-1 py-2 rounded-lg border border-amber-300 text-amber-800 text-sm font-medium hover:bg-amber-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleTakeover}
                disabled={isTakingOver}
                className="flex-[2] py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors"
              >
                {isTakingOver ? 'Switching…' : 'Switch to this device'}
              </button>
            </div>
          </div>
        )}

        {!conflictSession && !canStart && !isLoading && (
          <div className="bg-gray-100 rounded-xl p-5 text-center text-gray-700 text-base font-semibold mb-4">
            {summary?.sessions_used === summary?.sessions_allowed
              ? '✅ You have used all your sessions for today. Come back tomorrow!'
              : '⏰ Daily time limit reached. Come back tomorrow!'}
          </div>
        )}

        {!conflictSession && canStart && summary && (
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-4 text-base text-teal-800">
            <p className="font-bold text-center mb-2">
              Starting Session {summary.sessions_used + 1} of {summary.sessions_allowed}
            </p>
            <div className="flex justify-between py-1">
              <span className="font-semibold">Completed today</span>
              <span className="font-semibold">{summary.sessions_used} session{summary.sessions_used !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="font-semibold">Remaining after this</span>
              <span className="font-semibold">{summary.sessions_allowed - summary.sessions_used - 1} session{(summary.sessions_allowed - summary.sessions_used - 1) !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex justify-between py-1 border-t border-teal-200 mt-1">
              <span className="font-semibold">Daily time remaining</span>
              <span className="font-semibold font-mono">{formatSeconds(dailyRemaining ?? 0)}</span>
            </div>
          </div>
        )}

        {!conflictSession && (
          <button onClick={handleStart}
            disabled={!canStart || isStarting || !deviceId}
            className="w-full bg-teal-600 text-white py-3.5 rounded-xl font-semibold hover:bg-teal-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-base">
            {isStarting ? 'Starting session…' : 'Start Session'}
          </button>
        )}
      </div>
    </div>
  )
}
