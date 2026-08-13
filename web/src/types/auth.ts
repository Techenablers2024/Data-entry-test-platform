export interface User {
  id: string
  display_id: string
  name: string
  mobile: string
  email?: string
  status: 'pending' | 'active' | 'disabled'
  is_admin: boolean
  created_at: string
  approved_at?: string
}

export interface LoginPayload {
  mobile: string
  password: string
  device_id: string
  device_name?: string
}

export interface SignupPayload {
  name: string
  mobile: string
  password: string
  confirm_password: string
  email?: string
}

export interface ActiveSessionInfo {
  session_id: string
  session_number: number
  device_name?: string
  started_at: string
  elapsed_seconds: number
}

export interface LoginResponse {
  token: string
  user: User
  device_conflict: boolean
  active_session?: ActiveSessionInfo
}
