import type { ActiveSessionInfo } from '../../types/auth'
import { formatSeconds } from '../../lib/utils'

interface Props {
  activeSession: ActiveSessionInfo
  onContinueThere: () => void
  onStartHere: () => void
  isLoading?: boolean
}

export function DeviceConflictModal({ activeSession, onContinueThere, onStartHere, isLoading }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-xl">
            ⚠️
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Session in progress on another device</h2>
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 mb-5 text-sm text-gray-700 space-y-1">
          <p><span className="font-medium">Device:</span> {activeSession.device_name ?? 'Unknown device'}</p>
          <p><span className="font-medium">Session:</span> {activeSession.session_number} of 2 today</p>
          <p><span className="font-medium">Time elapsed:</span> {formatSeconds(activeSession.elapsed_seconds)}</p>
        </div>

        <p className="text-sm text-gray-600 mb-6">
          If you continue here, the session on the other device will be ended.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onContinueThere}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Continue on other device
          </button>
          <button
            onClick={onStartHere}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Starting…' : 'Start here'}
          </button>
        </div>
      </div>
    </div>
  )
}
