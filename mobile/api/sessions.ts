import { apiClient } from './client'
import type { UserSession, TodaySummary, HeartbeatResponse } from '../types/session'

export const startSession = (deviceName?: string) =>
  apiClient.post<{ data: UserSession }>('/sessions/start', { device_name: deviceName })

export const getActiveSession = () =>
  apiClient.get<{ data: UserSession }>('/sessions/active')

export const getTodaySummary = () =>
  apiClient.get<{ data: TodaySummary }>('/sessions/today')

export const heartbeat = (sessionId: string) =>
  apiClient.post<{ data: HeartbeatResponse }>(`/sessions/${sessionId}/heartbeat`)

export const takeover = (sessionId: string, deviceName?: string) =>
  apiClient.post(`/sessions/${sessionId}/takeover`, { device_name: deviceName })
