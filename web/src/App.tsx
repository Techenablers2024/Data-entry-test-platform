import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import { SessionProvider } from './context/SessionContext'
import { AppLayout } from './components/layout/AppLayout'
import { AdminLayout } from './pages/admin/AdminLayout'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { PendingApprovalPage } from './pages/PendingApprovalPage'
import { SessionStartPage } from './pages/SessionStartPage'
import { DataEntryPage } from './pages/DataEntryPage'
import { UsersPage } from './pages/admin/UsersPage'
import { BatchUploadPage } from './pages/admin/BatchUploadPage'
import { RecordsPage } from './pages/admin/RecordsPage'
import { UserReportPage } from './pages/admin/UserReportPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SessionProvider>
          <BrowserRouter>
            <Routes>
              {/* Public */}
              <Route path="/login"   element={<LoginPage />} />
              <Route path="/signup"  element={<SignupPage />} />
              <Route path="/pending" element={<PendingApprovalPage />} />

              {/* Protected app */}
              <Route element={<AppLayout />}>
                <Route path="/session"    element={<SessionStartPage />} />
                <Route path="/data-entry" element={<DataEntryPage />} />
                <Route path="/" element={<Navigate to="/session" replace />} />
              </Route>

              {/* Admin */}
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="/admin/users" replace />} />
                <Route path="users"   element={<UsersPage />} />
                <Route path="batches" element={<BatchUploadPage />} />
                <Route path="records" element={<RecordsPage />} />
                <Route path="reports/:id" element={<UserReportPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </SessionProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
