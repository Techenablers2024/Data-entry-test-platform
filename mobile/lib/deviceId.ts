import * as Application from 'expo-application'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { storage } from './storage'

export async function getDeviceId(): Promise<string> {
  const cached = await storage.getDeviceId()
  if (cached) return cached

  let id = 'android-unknown'
  if (Platform.OS === 'android') {
    id = Application.androidId ?? `android-${Device.modelName ?? 'device'}`
  }

  await storage.setDeviceId(id)
  return id
}

export function getDeviceName(): string {
  return `${Device.modelName ?? 'Android'} (${Device.osName ?? 'Android'})`
}
