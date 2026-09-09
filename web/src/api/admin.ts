import { apiClient } from './client'
import type { User } from '../types/auth'
import type { UserSession } from '../types/session'

export const listUsers = (status?: string) =>
  apiClient.get<{ data: User[] }>('/admin/users', { params: status ? { status } : {} })

export const approveUser = (id: string) =>
  apiClient.patch(`/admin/users/${id}/approve`)

export const disableUser = (id: string) =>
  apiClient.patch(`/admin/users/${id}/disable`)

export const enableUser = (id: string) =>
  apiClient.patch(`/admin/users/${id}/enable`)

export const resetPassword = (id: string, password: string) =>
  apiClient.post(`/admin/users/${id}/reset-password`, { password })

export const getUserSessions = (id: string) =>
  apiClient.get<{ data: UserSession[] }>(`/admin/users/${id}/sessions`)

export const extendValidity = (id: string, data: { extend_days?: number; valid_until?: string }) =>
  apiClient.patch<{ data: User }>(`/admin/users/${id}/extend-validity`, data)

export const updateUser = (id: string, data: {
  dob?: string | null
  pincode?: string
  state?: string
  district?: string
  taluk?: string
  reference_name?: string
  account_holder_name?: string
  bank_name?: string
  account_number?: string
  ifsc_code?: string
}) => apiClient.patch<{ data: User }>(`/admin/users/${id}`, data)

export const getTestPeriods = (id: string) =>
  apiClient.get<{ data: Array<{ period: number; start: string; end: string; is_current: boolean; days_remaining: number }> }>(`/admin/users/${id}/test-periods`)
