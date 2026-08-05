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
