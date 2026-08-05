import { Slot, useRouter, useSegments } from 'expo-router'
import { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider, useAuth } from '../context/AuthContext'
import { SessionProvider } from '../context/SessionContext'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

function AuthGuard() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    if (isLoading) return
    const inAuth = segments[0] === '(auth)'
    if (!user && !inAuth) router.replace('/(auth)/login')
    if (user  &&  inAuth) {
      // Admin goes to admin screen, regular users go to session gate
      router.replace(user.is_admin ? '/(app)/admin' : '/(app)/')
    }
  }, [user, isLoading, segments])

  return <Slot />
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SessionProvider>
            <AuthGuard />
          </SessionProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}
