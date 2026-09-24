import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import { useDeviceFingerprint } from '../hooks/useDeviceFingerprint'
import { EyeIcon } from '../components/ui/EyeIcon'

export function LoginPage() {
  const { setAuth } = useAuth()
  const { deviceId, deviceName } = useDeviceFingerprint()
  const navigate = useNavigate()

  const [mobile, setMobile] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conflictData, setConflictData] = useState<any>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!deviceId) return
    setIsLoading(true)

    try {
      const res = await login({ mobile, password, device_id: deviceId, device_name: deviceName })
      const data = res.data.data

      if (data.device_conflict && data.active_session) {
        setConflictData(data)
        setIsLoading(false)
        return
      }

      setAuth(data.token, data.user)
      navigate(data.user.is_admin ? '/admin' : '/session')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please try again.')
      setIsLoading(false)
    }
  }

  const handleTakeover = async () => {
    if (!conflictData) return
    setIsLoading(true)
    try {
      const { default: axios } = await import('axios')
      await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1'}/sessions/${conflictData.active_session.session_id}/takeover`,
        { device_name: deviceName },
        { headers: { Authorization: `Bearer ${conflictData.token}`, 'X-Device-ID': deviceId } }
      )
      setAuth(conflictData.token, conflictData.user)
      navigate('/session')
    } catch {
      setError('Failed to take over session.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 sm:p-8">
        {/* Brand */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="MMT Logo" className="w-20 h-20 rounded-2xl object-cover mx-auto mb-3 shadow-md" />
          <h1 className="text-2xl font-black text-gray-800">MMT Associate Software</h1>
          <p className="text-teal-600 font-bold text-sm mt-1">Sign in to continue</p>
        </div>

        {conflictData ? (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <p className="font-semibold mb-1">⚠️ Session active on another device</p>
              <p>Device: {conflictData.active_session.device_name ?? 'Unknown'}</p>
              <p>Session {conflictData.active_session.session_number}/2</p>
            </div>
            <button onClick={handleTakeover} disabled={isLoading}
              className="w-full bg-teal-600 text-white py-3 rounded-xl font-semibold hover:bg-teal-700 disabled:opacity-50 transition-colors">
              {isLoading ? 'Starting here…' : 'Continue here (end other session)'}
            </button>
            <button onClick={() => setConflictData(null)}
              className="w-full border border-gray-300 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors">
              Go back
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-extrabold text-gray-800 mb-1.5">Mobile Number</label>
              <input
                type="tel"
                value={mobile}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
                  setMobile(digits)
                  if (error) setError('')
                }}
                placeholder="10-digit mobile number"
                maxLength={10}
                required
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-extrabold text-gray-800 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (error) setError('') }}
                  placeholder="Enter password"
                  required
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 pr-11 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>
            <button type="submit" disabled={isLoading || !deviceId}
              className="w-full bg-teal-600 text-white py-3 rounded-xl font-semibold hover:bg-teal-700 disabled:opacity-50 transition-colors">
              {isLoading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-gray-700 font-semibold mt-6">
          Don't have an account?{' '}
          <Link to="/signup" className="text-teal-600 font-semibold hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  )
}
