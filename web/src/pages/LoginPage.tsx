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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4">
            DE
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
          <p className="text-gray-500 text-sm mt-1">Sign in to continue</p>
        </div>

        {conflictData ? (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <p className="font-semibold mb-1">⚠️ Session active on another device</p>
              <p>Device: {conflictData.active_session.device_name ?? 'Unknown'}</p>
              <p>Session {conflictData.active_session.session_number}/2</p>
            </div>
            <button onClick={handleTakeover} disabled={isLoading}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Mobile Number</label>
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
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (error) setError('') }}
                  placeholder="Enter password"
                  required
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {isLoading ? 'Signing in…' : 'Sign In'}
            </button>
            <div className="text-center mt-3">
              <button type="button" onClick={() => navigate('/forgot-password')}
                className="text-sm text-blue-600 hover:underline">
                Forgot Password?
              </button>
            </div>
          </form>
        )}

        <p className="text-center text-sm text-gray-500 mt-6">
          Don't have an account?{' '}
          <Link to="/signup" className="text-blue-600 font-medium hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  )
}
