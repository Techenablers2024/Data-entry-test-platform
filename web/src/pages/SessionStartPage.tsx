import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getTodaySummary, startSession } from '../api/sessions'
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
    setIsStarting(true)
    try {
      const res = await startSession(deviceName)
      const sess = res.data.data
      setActiveSession(sess)
      const action = sess.elapsed_seconds > 0 ? 'resumed' : 'started'
      setSessionMsg(`Session ${sess.session_number} of 2 ${action}!`)
      setTimeout(() => navigate('/data-entry'), 1500)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to start session.')
      setIsStarting(false)
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
      <div className="flex-1 flex items-center justify-center p-4">
        {sessionMsg && (
          <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/30">
            <div className="bg-white rounded-2xl shadow-xl px-10 py-8 text-center">
              <div className="text-4xl mb-3">▶️</div>
              <p className="text-xl font-bold text-gray-900">{sessionMsg}</p>
              <p className="text-sm text-gray-500 mt-1">Taking you to the test…</p>
            </div>
          </div>
        )}
        <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 text-center">
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-6">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Session {activeSession.session_number} of 2 — Active
          </div>

          <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Time remaining in session</p>
          <p className={`text-5xl font-bold font-mono mb-6 ${timerColor}`}>
            {formatSeconds(remainingSeconds)}
          </p>

          <div className="bg-gray-50 rounded-xl p-4 mb-6 text-sm space-y-2.5">
            <div className="flex justify-between">
              <span className="text-gray-500">Session started</span>
              <span className="font-medium text-gray-900">
                {new Date(activeSession.started_at).toLocaleTimeString('en-IN', {
                  timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Session number</span>
              <span className="font-medium text-gray-900">{activeSession.session_number} / 2</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Device</span>
              <span className="font-medium text-gray-900 truncate max-w-[180px]">
                {activeSession.device_name ?? 'This device'}
              </span>
            </div>
            {dailyRemaining !== null && (
              <div className="flex justify-between pt-2 border-t border-gray-200">
                <span className="text-gray-500">Daily time remaining</span>
                <span className={`font-medium font-mono ${dailyRemaining < 3600 ? 'text-amber-600' : 'text-gray-900'}`}>
                  {formatSeconds(dailyRemaining)}
                </span>
              </div>
            )}
          </div>

          {progress && (
            <div className="bg-gray-50 rounded-xl p-4 mb-4 text-sm space-y-2.5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Your Progress</p>
              <div className="flex justify-between">
                <span className="text-gray-500">Total pages</span>
                <span className="font-medium text-gray-900">{progress.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Completed</span>
                <span className="font-medium text-green-600">{progress.completed}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-200">
                <span className="text-gray-500">Pending</span>
                <span className="font-medium text-blue-600">{progress.pending}</span>
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
            className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-semibold hover:bg-blue-700 active:scale-95 transition-all text-base">
            Continue Start Test →
          </button>
        </div>
      </div>
    )
  }

  // ── Start new session view ───────────────────────────────────────────────
  return (
    <div className="flex-1 flex items-center justify-center p-4">
      {sessionMsg && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl px-10 py-8 text-center">
            <div className="text-4xl mb-3">🚀</div>
            <p className="text-xl font-bold text-gray-900">{sessionMsg}</p>
            <p className="text-sm text-gray-500 mt-1">Taking you to the test…</p>
          </div>
        </div>
      )}
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Ready to start?</h1>
        {user?.display_id && (
          <p className="text-xs font-mono text-blue-600 mb-1">{user.display_id}</p>
        )}
        <p className="text-gray-500 text-sm mb-6">Review your session availability below before starting.</p>

        {progress && (
          <div className="bg-gray-50 rounded-xl p-5 mb-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Your Progress</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total pages</span>
              <span className="font-semibold text-gray-900">{progress.total}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Completed</span>
              <span className="font-semibold text-green-600">{progress.completed}</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
              <span className="text-gray-600">Pending</span>
              <span className="font-semibold text-blue-600">{progress.pending}</span>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="h-32 flex items-center justify-center">
            <div className="w-7 h-7 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : summary ? (
          <div className="bg-gray-50 rounded-xl p-5 mb-6 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Sessions used today</span>
              <span className="font-semibold text-gray-900">{summary.sessions_used} / {summary.sessions_allowed}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Time used today</span>
              <span className="font-semibold text-gray-900">{formatSeconds(summary.total_elapsed_seconds)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Time remaining today</span>
              <span className={`font-semibold font-mono ${(dailyRemaining ?? 0) < 3600 ? 'text-amber-600' : 'text-green-600'}`}>
                {formatSeconds(dailyRemaining ?? 0)}
              </span>
            </div>
            <div className="pt-2 border-t border-gray-200 flex justify-between text-sm">
              <span className="text-gray-600">This session (max)</span>
              <span className="font-semibold text-gray-900">4 hours</span>
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

        {!canStart && !isLoading && (
          <div className="bg-gray-100 rounded-xl p-4 text-center text-gray-600 text-sm mb-4">
            {summary?.sessions_used === summary?.sessions_allowed
              ? '✅ You have used all your sessions for today. Come back tomorrow!'
              : '⏰ Daily time limit reached. Come back tomorrow!'}
          </div>
        )}

        {canStart && summary && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 text-sm text-blue-800">
            <p className="font-semibold text-center mb-2">
              Starting Session {summary.sessions_used + 1} of {summary.sessions_allowed}
            </p>
            <div className="flex justify-between py-1">
              <span>Completed today</span>
              <span className="font-medium">{summary.sessions_used} session{summary.sessions_used !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex justify-between py-1">
              <span>Remaining after this</span>
              <span className="font-medium">{summary.sessions_allowed - summary.sessions_used - 1} session{(summary.sessions_allowed - summary.sessions_used - 1) !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex justify-between py-1 border-t border-blue-200 mt-1">
              <span>Daily time remaining</span>
              <span className="font-medium font-mono">{formatSeconds(dailyRemaining ?? 0)}</span>
            </div>
          </div>
        )}

        <button onClick={handleStart}
          disabled={!canStart || isStarting || !deviceId}
          className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-semibold hover:bg-blue-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-base">
          {isStarting ? 'Starting session…' : 'Start Session'}
        </button>
      </div>
    </div>
  )
}
