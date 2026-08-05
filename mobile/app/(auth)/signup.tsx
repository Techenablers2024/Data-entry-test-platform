import { useState, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, StyleSheet, StatusBar, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { signup } from '../../api/auth'
import { EyeIcon } from '../../components/ui/EyeIcon'

export default function SignupScreen() {
  const router = useRouter()
  const [name, setName]                     = useState('')
  const [mobile, setMobile]                 = useState('')
  const [password, setPassword]             = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [email, setEmail]                   = useState('')
  const [errors, setErrors]                 = useState<Record<string, string>>({})
  const [loading, setLoading]               = useState(false)
  const [showPw, setShowPw]                 = useState(false)
  const [showConfirm, setShowConfirm]       = useState(false)

  const validate = () => {
    const e: Record<string, string> = {}
    if (!name.trim())             e.name = 'Name is required.'
    if (!mobile.trim())           e.mobile = 'Mobile is required.'
    else if (!/^\d{10}$/.test(mobile)) e.mobile = 'Enter a valid 10-digit number.'
    if (!password)                e.password = 'Password is required.'
    else if (password.length < 6) e.password = 'Minimum 6 characters.'
    if (password !== confirmPassword) e.confirm_password = 'Passwords do not match.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSignup = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      await signup({ name, mobile, password, confirm_password: confirmPassword, email: email || undefined })
      Alert.alert('Account created', 'Please wait for admin approval before signing in.', [
        { text: 'OK', onPress: () => router.replace('/(auth)/login') },
      ])
    } catch (err: any) {
      Alert.alert('Signup failed', err.response?.data?.error ?? 'Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#eff6ff' }}
      contentContainerStyle={[s.container, { paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 16 : 40 }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={s.card}>
        <View style={s.logo}><Text style={s.logoText}>DE</Text></View>
        <Text style={s.title}>Create account</Text>

        {/* Full Name */}
        <Text style={s.label}>Full Name <Text style={s.required}>*</Text></Text>
        <TextInput
          style={[s.input, errors.name ? s.inputError : null]}
          value={name} onChangeText={setName}
          placeholder="Your full name"
        />
        {errors.name ? <Text style={s.errorText}>{errors.name}</Text> : null}

        {/* Mobile */}
        <Text style={s.label}>Mobile Number <Text style={s.required}>*</Text></Text>
        <TextInput
          style={[s.input, errors.mobile ? s.inputError : null]}
          value={mobile} onChangeText={t => setMobile(t.replace(/\D/g, '').slice(0, 10))}
          placeholder="10-digit mobile number"
          keyboardType="phone-pad"
        />
        {errors.mobile ? <Text style={s.errorText}>{errors.mobile}</Text> : null}

        {/* Password */}
        <Text style={s.label}>Password <Text style={s.required}>*</Text></Text>
        <View style={s.pwRow}>
          <TextInput
            style={[s.input, s.pwInput, errors.password ? s.inputError : null]}
            value={password} onChangeText={setPassword}
            placeholder="At least 6 characters"
            secureTextEntry={!showPw}
          />
          <TouchableOpacity onPress={() => setShowPw(v => !v)} style={s.eyeBtn}>
            <EyeIcon open={showPw} />
          </TouchableOpacity>
        </View>
        {errors.password ? <Text style={s.errorText}>{errors.password}</Text> : null}

        {/* Confirm Password */}
        <Text style={s.label}>Confirm Password <Text style={s.required}>*</Text></Text>
        <View style={s.pwRow}>
          <TextInput
            style={[s.input, s.pwInput, errors.confirm_password ? s.inputError : null]}
            value={confirmPassword} onChangeText={setConfirmPassword}
            placeholder="Repeat your password"
            secureTextEntry={!showConfirm}
          />
          <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={s.eyeBtn}>
            <EyeIcon open={showConfirm} />
          </TouchableOpacity>
        </View>
        {errors.confirm_password ? <Text style={s.errorText}>{errors.confirm_password}</Text> : null}

        {/* Email */}
        <Text style={s.label}>Email <Text style={s.optional}>(optional)</Text></Text>
        <TextInput
          style={s.input}
          value={email} onChangeText={setEmail}
          placeholder="your@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TouchableOpacity style={[s.btn, { marginTop: 20 }]} onPress={handleSignup} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Create Account</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={{ marginTop: 16 }}>
          <Text style={s.link}>
            Already have an account? <Text style={s.linkBold}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container:   { padding: 20, paddingBottom: 40 },
  card:        { backgroundColor: '#fff', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  logo:        { width: 56, height: 56, borderRadius: 14, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 12 },
  logoText:    { color: '#fff', fontWeight: 'bold', fontSize: 20 },
  title:       { fontSize: 22, fontWeight: 'bold', color: '#111827', textAlign: 'center', marginBottom: 20 },
  label:       { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6, marginTop: 4 },
  required:    { color: '#ef4444' },
  optional:    { color: '#9ca3af', fontWeight: '400' },
  input:       { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, backgroundColor: '#fff', marginBottom: 2 },
  inputError:  { borderColor: '#f87171', backgroundColor: '#fef2f2' },
  errorText:   { color: '#ef4444', fontSize: 12, marginBottom: 4 },
  pwRow:       { position: 'relative' },
  pwInput:     { paddingRight: 48 },
  eyeBtn:      { position: 'absolute', right: 12, top: 10 },
  btn:         { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnText:     { color: '#fff', fontWeight: '600', fontSize: 15 },
  link:        { textAlign: 'center', color: '#6b7280', fontSize: 14 },
  linkBold:    { color: '#2563eb', fontWeight: '600' },
})
