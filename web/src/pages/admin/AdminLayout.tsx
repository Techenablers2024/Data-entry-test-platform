import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { logout } from '../../api/auth'

export function AdminLayout() {
  const { user, clearAuth } = useAuth()
  const navigate = useNavigate()
  if (!user?.is_admin) return <Navigate to="/" replace />

  const handleLogout = async () => {
    if (!window.confirm('Are you sure you want to logout?')) return
    try { await logout() } catch {}
    clearAuth()
    navigate('/login')
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
      isActive ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
    }`

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs">DE</div>
          <span className="font-semibold text-gray-800">Admin Panel</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{user?.name}</span>
          <button onClick={handleLogout} className="text-sm text-red-600 hover:underline">Logout</button>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="w-56 bg-white border-r border-gray-200 p-4 flex flex-col gap-1">
          <NavLink to="/admin/users"   className={linkClass}>👥 Users</NavLink>
          <NavLink to="/admin/batches" className={linkClass}>📊 Data Upload</NavLink>
          <NavLink to="/admin/records" className={linkClass}>📋 Records</NavLink>
        </aside>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
