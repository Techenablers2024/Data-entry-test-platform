import { captureRef } from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'
import { Alert } from 'react-native'
import type { RefObject } from 'react'

interface ScreenshotOptions {
  username: string
  recordSeq: string | number
}

export async function takeScreenshot(
  printRef: RefObject<any>,
  options: ScreenshotOptions
): Promise<void> {
  try {
    if (!printRef.current) {
      Alert.alert('Screenshot failed', 'Could not find view to capture.')
      return
    }

    const uri = await captureRef(printRef, {
      format: 'jpg',
      quality: 0.95,
      result: 'tmpfile',
    })

    const isAvailable = await Sharing.isAvailableAsync()
    if (!isAvailable) {
      Alert.alert('Sharing not available', 'Your device does not support sharing.')
      return
    }

    await Sharing.shareAsync(uri, {
      mimeType: 'image/jpeg',
      dialogTitle: `Screenshot — Record #${options.recordSeq}`,
    })
  } catch (err: any) {
    if (err?.message?.includes('cancel') || err?.message?.includes('dismiss')) return
    Alert.alert('Screenshot failed', 'Could not capture screenshot.')
    console.error('Screenshot error:', err)
  }
}
