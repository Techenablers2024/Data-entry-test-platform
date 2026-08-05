import { useEffect, useState } from 'react'

function computeFingerprint(): string {
  const raw = [
    navigator.userAgent,
    screen.width,
    screen.height,
    navigator.language,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ].join('|')

  let hash = 5381
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 33) ^ raw.charCodeAt(i)
  }
  return 'web-' + Math.abs(hash).toString(16)
}

function getBrowserDeviceName(): string {
  const ua = navigator.userAgent
  if (ua.includes('Windows')) return 'Windows PC'
  if (ua.includes('Mac')) return 'Mac'
  if (ua.includes('Linux')) return 'Linux PC'
  return 'Desktop'
}

declare global {
  interface Window {
    electronAPI?: {
      getMachineId:   () => Promise<string>
      getHostname:    () => Promise<string>
      saveScreenshot: (dataUrl: string, filename: string) => Promise<{ saved: boolean; filePath?: string }>
      captureHtml:    (html: string) => Promise<string | null>
    }
  }
}

export function useDeviceFingerprint() {
  const [deviceId, setDeviceId] = useState<string>('')
  const [deviceName, setDeviceName] = useState<string>('')

  useEffect(() => {
    async function init() {
      let id: string
      let name: string

      if (window.electronAPI) {
        // Running inside Electron — use stable hardware-derived machine ID
        id   = await window.electronAPI.getMachineId()
        name = await window.electronAPI.getHostname()
      } else {
        // Running in plain browser (dev / mobile webview fallback)
        id   = computeFingerprint()
        name = getBrowserDeviceName()
      }

      localStorage.setItem('device_id', id)
      setDeviceId(id)
      setDeviceName(name)
    }
    init()
  }, [])

  return { deviceId, deviceName }
}
