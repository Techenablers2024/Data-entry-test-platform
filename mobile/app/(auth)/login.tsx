import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, StyleSheet,
} from 'react-native'
import { useRouter } from 'expo-router'
import { login } from '../../api/auth'
import { useAuth } from '../../context/AuthContext'
import { getDeviceId, getDeviceName } from '../../lib/deviceId'
import { takeover } from '../../api/sessions'
import { storage } from '../../lib/storage'
import { EyeIcon } from '../../components/ui/EyeIcon'

export default function LoginScreen() {
  const router = useRouter()
  const { setAuth } = useAuth()
  const [mobile, setMobile]     = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [conflict, setConflict] = useState<any>(null)

  const handleLogin = async () => {
    if (!mobile || !password) { Alert.alert('Error', 'Please enter mobile and password.'); return }
    setLoading(true)
    try {
      const deviceId   = await getDeviceId()
      const deviceName = getDeviceName()
      const res = await login({ mobile, password, device_id: deviceId, device_name: deviceName })
      const data = res.data.data

      if (data.device_conflict && data.active_session) {
        setConflict(data)
        setLoading(false)
        return
      }

      await setAuth(data.token, data.user)
      router.replace('/(app)')
    } catch (err: any) {
      Alert.alert('Login failed', err.response?.data?.error ?? 'Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  const handleTakeover = async () => {
    if (!conflict) return
    setLoading(true)
    try {
      const deviceId   = await getDeviceId()
      const deviceName = getDeviceName()
      // Store the token first so API client can use it
      await storage.setToken(conflict.token)
      await storage.setDeviceId(deviceId)
      // Transfer session to this device (don't end it — just update device_id)
      await takeover(conflict.active_session.session_id)
      await setAuth(conflict.token, conflict.user)
      router.replace('/(app)')
    } catch {
      Alert.alert('Error', 'Failed to take over session.')
    } finally {
      setLoading(false)
    }
  }

  if (conflict) {
    return (
      <View style={s.container}>
        <View style={s.card}>
          <Text style={s.title}>Session Active on Another Device</Text>
          <View style={[s.infoBox, { backgroundColor: '#fef3c7', borderColor: '#f59e0b' }]}>
            <Text style={{ color: '#92400e' }}>Device: {conflict.active_session.device_name ?? 'Unknown'}</Text>
            <Text style={{ color: '#92400e' }}>Session {conflict.active_session.session_number}/2</Text>
          </View>
          <TouchableOpacity style={s.btn} onPress={handleTakeover} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Continue here</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={s.btnOutline} onPress={() => setConflict(null)}>
            <Text style={s.btnOutlineText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#eff6ff' }} contentContainerStyle={s.container}>
      <View style={s.card}>
        {/* Logo */}
        <View style={s.logo}><Text style={s.logoText}>DE</Text></View>
        <Text style={s.title}>Welcome back</Text>
        <Text style={s.subtitle}>Sign in to continue</Text>

        <Text style={s.label}>Mobile Number</Text>
        <TextInput
          style={s.input} value={mobile}
          onChangeText={t => setMobile(t.replace(/\D/g, '').slice(0, 10))}
          placeholder="10-digit mobile number" keyboardType="phone-pad"
        />

        <Text style={s.label}>Password</Text>
        <View style={{ position: 'relative' }}>
          <TextInput
            style={[s.input, { paddingRight: 48 }]} value={password} onChangeText={setPassword}
            placeholder="Enter password" secureTextEntry={!showPw}
          />
          <TouchableOpacity onPress={() => setShowPw(v => !v)}
            style={{ position: 'absolute', right: 12, top: 12 }}>
            <EyeIcon open={showPw} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[s.btn, { marginTop: 8 }]} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Sign In</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} style={{ marginTop: 12 }}>
          <Text style={{ textAlign: 'center', color: '#2563eb', fontSize: 14 }}>Forgot Password?</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(auth)/signup')} style={{ marginTop: 12 }}>
          <Text style={{ textAlign: 'center', color: '#6b7280' }}>
            Don't have an account? <Text style={{ color: '#2563eb', fontWeight: '600' }}>Sign up</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container:    { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card:         { backgroundColor: '#fff', borderRadius: 20, padding: 28, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  logo:         { width: 56, height: 56, borderRadius: 14, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 12 },
  logoText:     { color: '#fff', fontWeight: 'bold', fontSize: 20 },
  title:        { fontSize: 22, fontWeight: 'bold', color: '#111827', textAlign: 'center', marginBottom: 4 },
  subtitle:     { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 24 },
  label:        { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6 },
  input:        { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, marginBottom: 14, backgroundColor: '#fff' },
  btn:          { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnText:      { color: '#fff', fontWeight: '600', fontSize: 15 },
  btnOutline:   { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  btnOutlineText: { color: '#374151', fontWeight: '500', fontSize: 15 },
  infoBox:      { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 16 },
})
