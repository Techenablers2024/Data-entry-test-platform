import { Link } from 'react-router-dom'

export function PendingApprovalPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-10 text-center">
        <div className="text-5xl mb-4">⏳</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Account Pending Approval</h1>
        <p className="text-gray-600 mb-6">
          Your account has been created successfully. Please wait for the admin to approve your account before you can log in.
        </p>
        <p className="text-sm text-gray-500">
          Once approved, you can{' '}
          <Link to="/login" className="text-blue-600 font-medium hover:underline">sign in here</Link>.
        </p>
      </div>
    </div>
  )
}
