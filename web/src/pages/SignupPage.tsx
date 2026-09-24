import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signup } from '../api/auth'
import { EyeIcon } from '../components/ui/EyeIcon'

export function SignupPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', mobile: '', password: '', confirm_password: '', email: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [apiError, setApiError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (!form.mobile.trim()) e.mobile = 'Mobile number is required'
    else if (!/^\d{10}$/.test(form.mobile)) e.mobile = 'Must be exactly 10 digits'
    if (!form.password) e.password = 'Password is required'
    else if (form.password.length < 6) e.password = 'Password must be at least 6 characters'
    if (form.password !== form.confirm_password) e.confirm_password = 'Passwords do not match'
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      e.email = 'Enter a valid email address'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setApiError('')
    setIsLoading(true)
    try {
      await signup({ ...form, email: form.email || undefined })
      navigate('/pending')
    } catch (err: any) {
      setApiError(err.response?.data?.error || 'Signup failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const field = (key: keyof typeof form, label: string, type = 'text', placeholder = '') => {
    const isPassword = key === 'password' || key === 'confirm_password'
    const visible = key === 'password' ? showPassword : showConfirm
    const toggle = key === 'password'
      ? () => setShowPassword(v => !v)
      : () => setShowConfirm(v => !v)
    const inputType = isPassword ? (visible ? 'text' : 'password') : type

    return (
      <div>
        <label className="block text-sm font-extrabold text-gray-800 mb-1.5">
          {label}{key !== 'email' && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        <div className="relative">
          <input
            type={inputType} value={form[key]}
            onChange={(e) => {
              const raw = e.target.value
              const val = key === 'mobile' ? raw.replace(/\D/g, '').slice(0, 10) : raw
              setForm((f) => ({ ...f, [key]: val }))
            }}
            inputMode={key === 'mobile' ? 'numeric' : undefined}
            maxLength={key === 'mobile' ? 10 : undefined}
            placeholder={placeholder || label}
            className={`w-full border rounded-xl px-4 py-3 ${isPassword ? 'pr-11' : ''} text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors ${
              errors[key] ? 'border-red-400 bg-red-50' : 'border-gray-300'
            }`}
          />
          {isPassword && (
            <button type="button" onClick={toggle} tabIndex={-1}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
              <EyeIcon open={visible} />
            </button>
          )}
        </div>
        {errors[key] && <p className="text-red-600 text-xs mt-1">{errors[key]}</p>}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 sm:p-8">
        {/* Brand */}
        <div className="text-center mb-6">
          <img src="/logo.png" alt="MMT Logo" className="w-20 h-20 rounded-2xl object-cover mx-auto mb-3 shadow-md" />
          <h1 className="text-2xl font-black text-gray-800">MMT Associate Software</h1>
          <p className="text-teal-600 font-bold text-sm mt-1">Create your account</p>
        </div>

        {apiError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">
            {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {field('name', 'Full Name', 'text', 'Your full name')}
          {field('mobile', 'Mobile Number', 'tel', '10-digit mobile number')}
          {field('password', 'Password', 'password', 'At least 6 characters')}
          {field('confirm_password', 'Confirm Password', 'password', 'Repeat your password')}
          {field('email', 'Email (optional)', 'email', 'your@email.com')}

          <button type="submit" disabled={isLoading}
            className="w-full bg-teal-600 text-white py-3 rounded-xl font-semibold hover:bg-teal-700 disabled:opacity-50 transition-colors mt-2">
            {isLoading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-700 font-semibold mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-teal-600 font-semibold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
