import { Stack } from 'expo-router'

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="data-entry" />
      <Stack.Screen name="admin" />
    </Stack>
  )
}
