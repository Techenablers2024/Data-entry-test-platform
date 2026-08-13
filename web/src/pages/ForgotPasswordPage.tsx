import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { forgotPassword, verifyOTP, resetPassword } from '../api/auth'

type Step = 'mobile' | 'otp' | 'password'

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('mobile')
  const [mobile, setMobile] = useState('')
  const [otp, setOtp] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [resendTimer, setResendTimer] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  const startResendTimer = () => {
    setResendTimer(300) // 5 minutes
    timerRef.current = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  const formatTimer = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  const handleSendOTP = async () => {
    if (!mobile.match(/^\d{10}$/)) { setError('Enter a valid 10-digit mobile number.'); return }
    setError(''); setLoading(true)
    try {
      await forgotPassword(mobile)
      setStep('otp')
      startResendTimer()
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Failed to send OTP.')
    } finally { setLoading(false) }
  }

  const handleResendOTP = async () => {
    if (resendTimer > 0) return
    setError(''); setLoading(true)
    try {
      await forgotPassword(mobile)
      startResendTimer()
      setSuccess('OTP resent successfully.')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Failed to resend OTP.')
    } finally { setLoading(false) }
  }

  const handleVerifyOTP = async () => {
    if (!otp.match(/^\d{6}$/)) { setError('Enter the 6-digit OTP.'); return }
    setError(''); setLoading(true)
    try {
      const res = await verifyOTP(mobile, otp)
      setResetToken(res.data.data.reset_token)
      setStep('password')
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Invalid or expired OTP.')
    } finally { setLoading(false) }
  }

  const handleResetPassword = async () => {
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return }
    setError(''); setLoading(true)
    try {
      await resetPassword(resetToken, newPassword, confirmPassword)
      setSuccess('Password reset successfully! Redirecting to login…')
      setTimeout(() => navigate('/login'), 2000)
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Failed to reset password.')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-8">
        {/* Logo */}
        <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg mx-auto mb-4">DE</div>
        <h1 className="text-xl font-bold text-gray-900 text-center mb-1">Forgot Password</h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          {step === 'mobile' && 'Enter your registered mobile number'}
          {step === 'otp' && `OTP sent to ${mobile}`}
          {step === 'password' && 'Set your new password'}
        </p>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>}
        {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3 mb-4">{success}</div>}

        {step === 'mobile' && (
          <>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Mobile Number</label>
            <input value={mobile} onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="10-digit mobile number" type="tel"
              className="mt-1 w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4" />
            <button onClick={handleSendOTP} disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Sending…' : 'Send OTP'}
            </button>
          </>
        )}

        {step === 'otp' && (
          <>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Enter OTP</label>
            <input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit OTP" type="tel"
              className="mt-1 w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4" />
            <button onClick={handleVerifyOTP} disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 mb-3">
              {loading ? 'Verifying…' : 'Verify OTP'}
            </button>
            <button onClick={handleResendOTP} disabled={resendTimer > 0 || loading}
              className="w-full text-sm text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline">
              {resendTimer > 0 ? `Resend OTP in ${formatTimer(resendTimer)}` : 'Resend OTP'}
            </button>
          </>
        )}

        {step === 'password' && (
          <>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">New Password</label>
            <input value={newPassword} onChange={e => setNewPassword(e.target.value)}
              placeholder="Min 6 characters" type="password"
              className="mt-1 w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3" />
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Confirm Password</label>
            <input value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password" type="password"
              className="mt-1 w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4" />
            <button onClick={handleResetPassword} disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Resetting…' : 'Reset Password'}
            </button>
          </>
        )}

        <button onClick={() => navigate('/login')} className="mt-4 w-full text-sm text-gray-500 hover:text-gray-700 text-center">
          ← Back to Login
        </button>
      </div>
    </div>
  )
}
