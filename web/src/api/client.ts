import axios from 'axios'
import { API_BASE_URL } from '../lib/constants'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT and device ID to every request
apiClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`

  const deviceId = localStorage.getItem('device_id')  // device_id stays in localStorage (identifies the machine)
  if (deviceId) config.headers['X-Device-ID'] = deviceId

  return config
})

// Redirect to login on 401 — but NOT when the 401 came from the login endpoint itself
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    const isLoginCall = err.config?.url?.includes('/auth/login')
    if (err.response?.status === 401 && !isLoginCall) {
      sessionStorage.removeItem('token')
      // window.location.href = '/login' navigates to file:///login on Electron (file:// protocol) → blank screen
      // Use hash for file:// (Electron production), plain path for http (dev/browser)
      if (window.location.protocol === 'file:') {
        window.location.hash = '#/login'
      } else {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)
