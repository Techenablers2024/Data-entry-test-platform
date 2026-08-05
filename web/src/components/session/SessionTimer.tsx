import { useSession } from '../../context/SessionContext'
import { formatSeconds } from '../../lib/utils'
import { WARN_THRESHOLD_SECS, CRITICAL_THRESHOLD_SECS } from '../../lib/constants'

export function SessionTimer() {
  const { activeSession, remainingSeconds } = useSession()
  if (!activeSession) return null

  const isCritical = remainingSeconds <= CRITICAL_THRESHOLD_SECS
  const isWarn = remainingSeconds <= WARN_THRESHOLD_SECS

  const colorClass = isCritical
    ? 'text-red-600 font-bold animate-pulse'
    : isWarn
    ? 'text-amber-600 font-semibold'
    : 'text-green-700 font-medium'

  return (
    <div className="flex items-center gap-1 text-sm">
      <span className="text-gray-500">Session {activeSession.session_number}/2</span>
      <span className="text-gray-400 mx-1">|</span>
      <span className={colorClass}>⏱ {formatSeconds(remainingSeconds)}</span>
    </div>
  )
}
