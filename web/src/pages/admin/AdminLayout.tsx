import { useState } from 'react'
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { logout } from '../../api/auth'

export function AdminLayout() {
  const { user, clearAuth } = useAuth()
  const navigate = useNavigate()
  const [logoutConfirm, setLogoutConfirm] = useState(false)

  if (!user?.is_admin) return <Navigate to="/" replace />

  const handleLogout = async () => {
    try { await logout() } catch {}
    clearAuth()
    navigate('/login')
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
      isActive ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-100'
    }`

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-teal-800 px-6 h-16 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="MMT" className="w-10 h-10 rounded-xl object-cover shadow-md ring-2 ring-white/20" />
          <div className="flex flex-col leading-tight">
            <span className="font-bold text-white text-base whitespace-nowrap">MMT Associate Software</span>
            <span className="text-teal-300 text-xs font-semibold tracking-wide">Admin Panel</span>
          </div>
        </div>
        <div className="flex items-center">
          <button
            onClick={() => setLogoutConfirm(true)}
            className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-red-300 hover:bg-red-900/40 hover:text-red-200 transition-all group"
          >
            <LogOut size={26} className="group-hover:translate-x-0.5 transition-transform" />
            <span className="text-xs font-extrabold">Logout</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-56 bg-white border-r border-gray-200 p-4 flex flex-col gap-1 shrink-0">
          <NavLink to="/admin/users"   className={linkClass}>👥 Users</NavLink>
          <NavLink to="/admin/admins"  className={linkClass}>🛡️ Admins</NavLink>
          <NavLink to="/admin/batches" className={linkClass}>📊 Data Upload</NavLink>
          <NavLink to="/admin/records" className={linkClass}>📋 Records</NavLink>
        </aside>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      {logoutConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-xs w-full text-center">
            <p className="text-gray-800 font-semibold mb-1">Log out?</p>
            <p className="text-sm text-gray-500 mb-5">You'll need to sign in again to access the admin panel.</p>
            <div className="flex gap-3">
              <button onClick={() => setLogoutConfirm(false)}
                className="flex-1 border border-gray-300 rounded-xl py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleLogout}
                className="flex-1 bg-red-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-red-700 transition-colors">
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
