import {
  createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode,
} from 'react'
import type { UserSession, TodaySummary } from '../types/session'
import { getActiveSession, getTodaySummary, heartbeat } from '../api/sessions'
import { HEARTBEAT_INTERVAL } from '../lib/constants'
import { useAuth } from './AuthContext'

interface SessionContextValue {
  activeSession: UserSession | null
  todaySummary: TodaySummary | null
  remainingSeconds: number
  setActiveSession: (s: UserSession | null) => void
  refreshSummary: () => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [activeSession, setActiveSessionState] = useState<UserSession | null>(null)
  const [todaySummary, setTodaySummary] = useState<TodaySummary | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refreshSummary = useCallback(() => {
    if (!user) return
    getTodaySummary().then((r) => setTodaySummary(r.data.data)).catch(() => {})
  }, [user])

  // Load active session on mount / user change
  useEffect(() => {
    if (!user) return
    getActiveSession()
      .then((r) => setActiveSessionState(r.data.data))
      .catch(() => setActiveSessionState(null))
    refreshSummary()
  }, [user, refreshSummary])

  // Heartbeat loop
  useEffect(() => {
    if (!activeSession) return
    const maxSecs = 4 * 60 * 60
    setRemainingSeconds(maxSecs - activeSession.elapsed_seconds)
    refreshSummary()   // refresh as soon as a session becomes active

    // Server heartbeat every 60s
    intervalRef.current = setInterval(async () => {
      try {
        const res = await heartbeat(activeSession.id)
        setRemainingSeconds(res.data.data.remaining_seconds)
        refreshSummary() // keep "Xm used today" in sync
      } catch {
        setActiveSessionState(null)
      }
    }, HEARTBEAT_INTERVAL)

    // Client-side 1-second countdown
    tickRef.current = setInterval(() => {
      setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    // Re-validate session when tab regains focus (detects takeover by another device)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        getActiveSession()
          .then((r) => {
            // If backend has no active session, or it belongs to a different device, clear it
            if (!r.data.data) setActiveSessionState(null)
          })
          .catch(() => setActiveSessionState(null))
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(intervalRef.current!)
      clearInterval(tickRef.current!)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [activeSession?.id, refreshSummary])

  const setActiveSession = (s: UserSession | null) => {
    setActiveSessionState(s)
    if (s) setRemainingSeconds(4 * 60 * 60 - s.elapsed_seconds)
  }

  return (
    <SessionContext.Provider value={{ activeSession, todaySummary, remainingSeconds, setActiveSession, refreshSummary }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside SessionProvider')
  return ctx
}
