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
    else if (!/^\d{10}$/.test(form.mobile)) e.mobile = 'Enter a valid 10-digit mobile number'
    if (!form.password) e.password = 'Password is required'
    else if (form.password.length < 6) e.password = 'Password must be at least 6 characters'
    if (form.password !== form.confirm_password) e.confirm_password = 'Passwords do not match'
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
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}{key !== 'email' && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        <div className="relative">
          <input
            type={inputType} value={form[key]}
            onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
            placeholder={placeholder || label}
            className={`w-full border rounded-xl px-4 py-3 ${isPassword ? 'pr-11' : ''} text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4">
            DE
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create account</h1>
          <p className="text-gray-500 text-sm mt-1">Fill in your details to register</p>
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
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors mt-2">
            {isLoading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
