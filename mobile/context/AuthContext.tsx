import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { User } from '../types/auth'
import { getMe } from '../api/auth'
import { storage } from '../lib/storage'

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  setAuth: (token: string, user: User) => Promise<void>
  clearAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [isLoading, setLoading] = useState(true)

  useEffect(() => {
    storage.getToken().then(async (token) => {
      if (!token) { setLoading(false); return }
      try {
        const res = await getMe()
        setUser(res.data.data)
      } catch {
        await storage.removeToken()
      } finally {
        setLoading(false)
      }
    })
  }, [])

  const setAuth = async (token: string, u: User) => {
    await storage.setToken(token)
    setUser(u)
  }

  const clearAuth = async () => {
    await storage.removeToken()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, setAuth, clearAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
