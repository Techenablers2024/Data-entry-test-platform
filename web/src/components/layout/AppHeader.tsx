import { useSession } from '../../context/SessionContext'
import { useAuth } from '../../context/AuthContext'
import { SessionTimer } from '../session/SessionTimer'
import { logout } from '../../api/auth'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { WARN_THRESHOLD_SECS } from '../../lib/constants'

export function AppHeader() {
  const { user, clearAuth } = useAuth()
  const { activeSession, remainingSeconds, todaySummary } = useSession()
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()

  const handleLogout = async () => {
    if (!window.confirm('Are you sure you want to logout?')) return
    try { await logout() } catch {}
    clearAuth()
    navigate('/login')
  }

  const showWarning = activeSession && remainingSeconds <= WARN_THRESHOLD_SECS && remainingSeconds > 0

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-4 h-14 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        {/* Left: Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
            DE
          </div>
          <span className="font-semibold text-gray-800 hidden sm:block">DataEntry Pro</span>
        </div>

        {/* Centre: Session info */}
        <div className="flex items-center gap-3 text-sm">
          {activeSession && <SessionTimer />}
          {todaySummary && (
            <>
              <span className="text-gray-300 hidden md:block">|</span>
              <span className="text-gray-500 hidden md:block">
                {Math.floor((todaySummary.total_elapsed_seconds) / 60)}m used today
              </span>
            </>
          )}
        </div>

        {/* Right: User menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700"
          >
            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-xs">
              {user?.name?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <span className="hidden sm:block">{user?.name}</span>
            <span className="text-gray-400 text-xs">▾</span>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-10 w-44 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-50">
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-xs text-gray-500">Signed in as</p>
                <p className="text-sm font-medium text-gray-800 truncate">{user?.name}</p>
              </div>
              {user?.is_admin && (
                <button
                  onClick={() => { navigate('/admin'); setMenuOpen(false) }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Admin Panel
                </button>
              )}
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Session warning banner */}
      {showWarning && (
        <div className={`px-4 py-2 text-center text-sm font-medium ${
          remainingSeconds <= 5 * 60
            ? 'bg-red-500 text-white'
            : 'bg-amber-400 text-amber-900'
        }`}>
          ⚠️ Only {Math.ceil(remainingSeconds / 60)} minutes remaining in this session!
        </div>
      )}
    </>
  )
}
