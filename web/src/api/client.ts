import axios from 'axios'
import { API_BASE_URL } from '../lib/constants'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT and device ID to every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`

  const deviceId = localStorage.getItem('device_id')
  if (deviceId) config.headers['X-Device-ID'] = deviceId

  return config
})

// Redirect to login on 401 — but NOT when the 401 came from the login endpoint itself
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    const isLoginCall = err.config?.url?.includes('/auth/login')
    if (err.response?.status === 401 && !isLoginCall) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)
