import { apiClient } from './client'
import type { LoginPayload, LoginResponse, SignupPayload, User } from '../types/auth'

export const signup = (data: SignupPayload) =>
  apiClient.post('/auth/signup', data)

export const login = (data: LoginPayload) =>
  apiClient.post<{ data: LoginResponse }>('/auth/login', data)

export const logout = () => apiClient.post('/auth/logout')

export const getMe = () => apiClient.get<{ data: User }>('/auth/me')
