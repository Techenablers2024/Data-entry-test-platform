import {
  createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode,
} from 'react'
import type { UserSession, TodaySummary } from '../types/session'
import { getActiveSession, getTodaySummary, heartbeat } from '../api/sessions'
import { HEARTBEAT_INTERVAL, MAX_SESSION_SECONDS } from '../lib/constants'
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
  const [todaySummary, setTodaySummary]         = useState<TodaySummary | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tickRef      = useRef<ReturnType<typeof setInterval> | null>(null)

  const refreshSummary = useCallback(() => {
    if (!user) return
    getTodaySummary().then((r) => setTodaySummary(r.data.data)).catch(() => {})
  }, [user])

  useEffect(() => {
    if (!user) return
    getActiveSession()
      .then((r) => setActiveSessionState(r.data.data))
      .catch(() => setActiveSessionState(null))
    refreshSummary()
  }, [user, refreshSummary])

  useEffect(() => {
    if (!activeSession) return
    setRemainingSeconds(MAX_SESSION_SECONDS - activeSession.elapsed_seconds)

    heartbeatRef.current = setInterval(async () => {
      try {
        const res = await heartbeat(activeSession.id)
        setRemainingSeconds(res.data.data.remaining_seconds)
      } catch {
        setActiveSessionState(null)
      }
    }, HEARTBEAT_INTERVAL)

    tickRef.current = setInterval(() => {
      setRemainingSeconds((p) => (p > 0 ? p - 1 : 0))
    }, 1000)

    return () => {
      clearInterval(heartbeatRef.current!)
      clearInterval(tickRef.current!)
    }
  }, [activeSession?.id])

  const setActiveSession = (s: UserSession | null) => {
    setActiveSessionState(s)
    if (s) setRemainingSeconds(MAX_SESSION_SECONDS - s.elapsed_seconds)
  }

  return (
    <SessionContext.Provider value={{ activeSession, todaySummary, remainingSeconds, setActiveSession, refreshSummary }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be inside SessionProvider')
  return ctx
}
