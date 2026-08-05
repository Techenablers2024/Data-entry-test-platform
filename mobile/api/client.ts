import axios from 'axios'
import { API_BASE_URL } from '../lib/constants'
import { storage } from '../lib/storage'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use(async (config) => {
  const token = await storage.getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  const deviceId = await storage.getDeviceId()
  if (deviceId) config.headers['X-Device-ID'] = deviceId
  return config
})

// On 401 (session expired), clear token — AuthContext will redirect to login
// Skip for login calls so wrong password doesn't wipe the token
apiClient.interceptors.response.use(
  (res) => res,
  async (err) => {
    const isLoginCall = err.config?.url?.includes('/auth/login')
    if (err.response?.status === 401 && !isLoginCall) {
      await storage.removeToken()
    }
    return Promise.reject(err)
  }
)
