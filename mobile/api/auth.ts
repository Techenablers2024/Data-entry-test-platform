import { apiClient } from './client'
import type { LoginPayload, LoginResponse, SignupPayload, User } from '../types/auth'

export const signup = (data: SignupPayload) =>
  apiClient.post('/auth/signup', data)

export const login = (data: LoginPayload) =>
  apiClient.post<{ data: LoginResponse }>('/auth/login', data)

export const logout = () => apiClient.post('/auth/logout')

export const getMe = () => apiClient.get<{ data: User }>('/auth/me')

export const updateMyBank = (data: {
  account_holder_name: string
  bank_name: string
  account_number: string
  ifsc_code: string
}) => apiClient.patch<{ data: User }>('/auth/me/bank', data)
