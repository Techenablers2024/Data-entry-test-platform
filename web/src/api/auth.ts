import { apiClient } from './client'
import type { LoginPayload, LoginResponse, SignupPayload, User } from '../types/auth'

export const signup = (data: SignupPayload) =>
  apiClient.post('/auth/signup', data)

export const login = (data: LoginPayload) =>
  apiClient.post<{ data: LoginResponse }>('/auth/login', data)

export const logout = () =>
  apiClient.post('/auth/logout')

export const getMe = () =>
  apiClient.get<{ data: User }>('/auth/me')

export const listAdmins = () =>
  apiClient.get<{ data: User[] }>('/admin/admins')

export const createAdmin = (data: { name: string; mobile: string; password: string; email?: string }) =>
  apiClient.post<{ data: User }>('/admin/admins', data)

export const forgotPassword = (mobile: string) =>
  apiClient.post('/auth/forgot-password', { mobile })

export const verifyOTP = (mobile: string, otp: string) =>
  apiClient.post<{ data: { reset_token: string } }>('/auth/verify-otp', { mobile, otp })

export const resetPassword = (reset_token: string, new_password: string, confirm_password: string) =>
  apiClient.post('/auth/reset-password', { reset_token, new_password, confirm_password })
