import { View, Text, TouchableOpacity, StyleSheet, StatusBar, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../../context/AuthContext'
import { logout } from '../../api/auth'

export default function AdminScreen() {
  const { clearAuth } = useAuth()
  const router = useRouter()

  const handleLogout = async () => {
    try { await logout() } catch {}
    await clearAuth()
    router.replace('/(auth)/login')
  }

  return (
    <View style={s.container}>
      <View style={s.card}>
        <Text style={s.icon}>🖥️</Text>
        <Text style={s.title}>Admin Panel</Text>
        <Text style={s.subtitle}>
          The Admin Panel is only available on the desktop application.
        </Text>
        <Text style={s.subtitle}>
          Please open the DataEntry Pro desktop app to manage users, upload data, and view reports.
        </Text>
        <TouchableOpacity style={s.btn} onPress={handleLogout}>
          <Text style={s.btnText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    padding: 24,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 16 : 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  icon:     { fontSize: 56, marginBottom: 16 },
  title:    { fontSize: 22, fontWeight: 'bold', color: '#111827', marginBottom: 12 },
  subtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 12, lineHeight: 22 },
  btn:      { marginTop: 12, backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40 },
  btnText:  { color: '#fff', fontWeight: '600', fontSize: 15 },
})
