import { useState, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, StyleSheet, StatusBar, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { getTodaySummary, startSession } from '../../api/sessions'
import { useSession } from '../../context/SessionContext'
import { getDeviceName } from '../../lib/deviceId'
import { formatSeconds } from '../../lib/utils'
import { useAuth } from '../../context/AuthContext'
import { logout } from '../../api/auth'

export default function SessionGateScreen() {
  const router = useRouter()
  const { user, clearAuth } = useAuth()
  const { activeSession, setActiveSession, remainingSeconds } = useSession()
  const [starting, setStarting] = useState(false)
  const [dailyRemaining, setDailyRemaining] = useState<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { data: summary, isLoading } = useQuery({
    queryKey: ['today-summary'],
    queryFn: () => getTodaySummary().then(r => r.data.data),
    staleTime: 0,
    refetchOnMount: true,
  })

  // Live daily countdown
  useEffect(() => {
    if (summary?.remaining_daily_seconds === undefined) return
    setDailyRemaining(summary.remaining_daily_seconds)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setDailyRemaining(prev => (prev !== null && prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [summary?.remaining_daily_seconds])

  const canStart = summary
    ? summary.sessions_used < summary.sessions_allowed && (dailyRemaining ?? 0) > 0
    : false

  const handleStart = async () => {
    setStarting(true)
    try {
      const res = await startSession(getDeviceName())
      setActiveSession(res.data.data)
      router.push('/(app)/data-entry')
    } catch (err: any) {
      Alert.alert('Cannot start session', err.response?.data?.error ?? 'Please try again.')
    } finally {
      setStarting(false)
    }
  }

  const handleLogout = async () => {
    try { await logout() } catch {}
    await clearAuth()
    router.replace('/(auth)/login')
  }

  const timerColor = remainingSeconds <= 5 * 60 ? '#dc2626'
    : remainingSeconds <= 30 * 60 ? '#d97706' : '#16a34a'

  const containerPadding = { paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 10 : 20 }

  // ── Active session view ──────────────────────────────────────────────────
  if (activeSession) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: '#f9fafb' }} contentContainerStyle={[s.container, containerPadding]}>
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>Hello, {user?.name} 👋</Text>
            <Text style={{ color: '#6b7280', fontSize: 13 }}>Session in progress</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={s.logoutBtn}>
            <Text style={{ color: '#374151', fontSize: 13 }}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Active session badge */}
        <View style={s.activeBadge}>
          <View style={s.activeDot} />
          <Text style={s.activeBadgeText}>Session {activeSession.session_number} of 2 — Active</Text>
        </View>

        {/* Big timer */}
        <View style={s.timerCard}>
          <Text style={s.timerLabel}>Time remaining in session</Text>
          <Text style={[s.timerValue, { color: timerColor }]}>{formatSeconds(remainingSeconds)}</Text>
        </View>

        {/* Stats */}
        <View style={s.card}>
          <Row label="Session started"
            value={new Date(activeSession.started_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })} />
          <Row label="Session number" value={`${activeSession.session_number} / 2`} />
          <Row label="Device" value={activeSession.device_name ?? 'This device'} />
          {dailyRemaining !== null && (
            <Row label="Daily time remaining"
              value={formatSeconds(dailyRemaining)}
              valueColor={dailyRemaining < 3600 ? '#d97706' : '#111827'}
              last />
          )}
        </View>

        {remainingSeconds <= 30 * 60 && (
          <View style={[s.warningBox, remainingSeconds <= 5 * 60 ? { backgroundColor: '#fee2e2', borderColor: '#fca5a5' } : {}]}>
            <Text style={{ color: remainingSeconds <= 5 * 60 ? '#991b1b' : '#92400e', fontSize: 12 }}>
              ⚠️ Only {formatSeconds(remainingSeconds)} left in this session!
            </Text>
          </View>
        )}

        <TouchableOpacity style={s.btn} onPress={() => router.push('/(app)/data-entry')}>
          <Text style={s.btnText}>Continue Data Entry →</Text>
        </TouchableOpacity>
      </ScrollView>
    )
  }

  // ── Start new session view ───────────────────────────────────────────────
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f9fafb' }} contentContainerStyle={[s.container, containerPadding]}>
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>Hello, {user?.name} 👋</Text>
          <Text style={{ color: '#6b7280', fontSize: 13 }}>Ready to start?</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={s.logoutBtn}>
          <Text style={{ color: '#374151', fontSize: 13 }}>Logout</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#2563eb" style={{ marginVertical: 40 }} />
      ) : summary ? (
        <View style={s.card}>
          <Row label="Sessions today" value={`${summary.sessions_used} / ${summary.sessions_allowed}`} />
          <Row label="Time used" value={formatSeconds(summary.total_elapsed_seconds)} />
          <Row label="Time remaining" value={formatSeconds(dailyRemaining ?? 0)}
            valueColor={(dailyRemaining ?? 0) < 3600 ? '#d97706' : '#16a34a'} />
          <Row label="Per session (max)" value="4 hours" last />

          {(dailyRemaining ?? 0) < 4 * 3600 && (dailyRemaining ?? 0) > 0 && (
            <View style={s.warningBox}>
              <Text style={{ color: '#92400e', fontSize: 12 }}>
                ⚠️ Only {formatSeconds(dailyRemaining ?? 0)} left today. Session ends at midnight IST.
              </Text>
            </View>
          )}
        </View>
      ) : null}

      {!canStart && !isLoading && (
        <View style={[s.card, { alignItems: 'center' }]}>
          <Text style={{ color: '#6b7280', textAlign: 'center' }}>
            {summary?.sessions_used === summary?.sessions_allowed
              ? '✅ All sessions used for today. Come back tomorrow!'
              : '⏰ Daily time limit reached. Come back tomorrow!'}
          </Text>
        </View>
      )}

      <TouchableOpacity
        onPress={handleStart}
        disabled={!canStart || starting}
        style={[s.btn, !canStart && { backgroundColor: '#d1d5db' }]}
      >
        {starting ? <ActivityIndicator color="#fff" /> : (
          <Text style={[s.btnText, !canStart && { color: '#9ca3af' }]}>Start Session</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  )
}

function Row({ label, value, valueColor, last }: any) {
  return (
    <View style={[{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
      !last && { borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }]}>
      <Text style={{ color: '#6b7280', fontSize: 14 }}>{label}</Text>
      <Text style={{ fontWeight: '600', fontSize: 14, color: valueColor ?? '#111827' }}>{value}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  container:       { padding: 20, paddingBottom: 40 },
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greeting:        { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  logoutBtn:       { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  card:            { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  warningBox:      { marginBottom: 16, backgroundColor: '#fef3c7', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#fcd34d' },
  btn:             { backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnText:         { color: '#fff', fontWeight: '700', fontSize: 16 },
  // Active session styles
  activeBadge:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#dcfce7', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start', marginBottom: 16 },
  activeDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: '#16a34a', marginRight: 8 },
  activeBadgeText: { color: '#15803d', fontWeight: '600', fontSize: 13 },
  timerCard:       { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  timerLabel:      { fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  timerValue:      { fontSize: 48, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
})
