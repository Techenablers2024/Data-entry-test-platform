import { useState, useEffect, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, StyleSheet, ScrollView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { forgotPassword, verifyOTP, resetPassword } from '../../api/auth'

type Step = 'mobile' | 'otp' | 'password'

export default function ForgotPasswordScreen() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('mobile')
  const [mobile, setMobile] = useState('')
  const [otp, setOtp] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendTimer, setResendTimer] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  const startResendTimer = () => {
    setResendTimer(300)
    timerRef.current = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  const formatTimer = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  const handleSendOTP = async () => {
    if (!mobile.match(/^\d{10}$/)) { setError('Enter a valid 10-digit mobile number.'); return }
    setError(''); setLoading(true)
    try {
      await forgotPassword(mobile)
      setStep('otp')
      startResendTimer()
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Failed to send OTP.')
    } finally { setLoading(false) }
  }

  const handleResendOTP = async () => {
    if (resendTimer > 0) return
    setError(''); setLoading(true)
    try {
      await forgotPassword(mobile)
      startResendTimer()
      Alert.alert('OTP Resent', 'A new OTP has been sent to your mobile.')
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Failed to resend OTP.')
    } finally { setLoading(false) }
  }

  const handleVerifyOTP = async () => {
    if (!otp.match(/^\d{6}$/)) { setError('Enter the 6-digit OTP.'); return }
    setError(''); setLoading(true)
    try {
      const res = await verifyOTP(mobile, otp)
      setResetToken(res.data.data.reset_token)
      setStep('password')
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Invalid or expired OTP.')
    } finally { setLoading(false) }
  }

  const handleResetPassword = async () => {
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return }
    setError(''); setLoading(true)
    try {
      await resetPassword(resetToken, newPassword, confirmPassword)
      Alert.alert('Success', 'Password reset successfully!', [
        { text: 'Login', onPress: () => router.replace('/(auth)/login') },
      ])
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Failed to reset password.')
    } finally { setLoading(false) }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#eff6ff' }} contentContainerStyle={s.container}>
      <View style={s.card}>
        <View style={s.logo}><Text style={s.logoText}>DE</Text></View>
        <Text style={s.title}>Forgot Password</Text>
        <Text style={s.subtitle}>
          {step === 'mobile' && 'Enter your registered mobile number'}
          {step === 'otp' && `OTP sent to ${mobile}`}
          {step === 'password' && 'Set your new password'}
        </Text>

        {!!error && (
          <View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View>
        )}

        {step === 'mobile' && (
          <>
            <Text style={s.label}>Mobile Number</Text>
            <TextInput style={s.input} value={mobile}
              onChangeText={t => { setMobile(t.replace(/\D/g, '').slice(0, 10)); setError('') }}
              placeholder="10-digit mobile number" keyboardType="phone-pad" />
            <TouchableOpacity style={s.btn} onPress={handleSendOTP} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Send OTP</Text>}
            </TouchableOpacity>
          </>
        )}

        {step === 'otp' && (
          <>
            <Text style={s.label}>Enter OTP</Text>
            <TextInput style={s.input} value={otp}
              onChangeText={t => { setOtp(t.replace(/\D/g, '').slice(0, 6)); setError('') }}
              placeholder="6-digit OTP" keyboardType="number-pad" />
            <TouchableOpacity style={s.btn} onPress={handleVerifyOTP} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Verify OTP</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.resendBtn} onPress={handleResendOTP} disabled={resendTimer > 0 || loading}>
              <Text style={[s.resendText, resendTimer > 0 && { color: '#9ca3af' }]}>
                {resendTimer > 0 ? `Resend OTP in ${formatTimer(resendTimer)}` : 'Resend OTP'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'password' && (
          <>
            <Text style={s.label}>New Password</Text>
            <TextInput style={s.input} value={newPassword}
              onChangeText={t => { setNewPassword(t); setError('') }}
              placeholder="Min 6 characters" secureTextEntry />
            <Text style={s.label}>Confirm Password</Text>
            <TextInput style={s.input} value={confirmPassword}
              onChangeText={t => { setConfirmPassword(t); setError('') }}
              placeholder="Re-enter password" secureTextEntry />
            <TouchableOpacity style={s.btn} onPress={handleResetPassword} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Reset Password</Text>}
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={{ marginTop: 16 }}>
          <Text style={{ textAlign: 'center', color: '#6b7280', fontSize: 14 }}>← Back to Login</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container:  { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card:       { backgroundColor: '#fff', borderRadius: 20, padding: 28, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  logo:       { width: 56, height: 56, borderRadius: 14, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 12 },
  logoText:   { color: '#fff', fontWeight: 'bold', fontSize: 20 },
  title:      { fontSize: 22, fontWeight: 'bold', color: '#111827', textAlign: 'center', marginBottom: 4 },
  subtitle:   { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 20 },
  label:      { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6 },
  input:      { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, marginBottom: 14, backgroundColor: '#fff' },
  btn:        { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 8 },
  btnText:    { color: '#fff', fontWeight: '600', fontSize: 15 },
  resendBtn:  { alignItems: 'center', paddingVertical: 8 },
  resendText: { color: '#2563eb', fontSize: 14 },
  errorBox:   { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fca5a5', borderRadius: 10, padding: 10, marginBottom: 14 },
  errorText:  { color: '#dc2626', fontSize: 13 },
})
