export interface UserSession {
  id: string
  user_id: string
  session_number: number
  session_date: string
  started_at: string
  ended_at?: string
  device_id: string
  device_name?: string
  elapsed_seconds: number
  status: 'active' | 'ended' | 'expired'
}

export interface TodaySummary {
  sessions_used: number
  total_elapsed_seconds: number
  remaining_daily_seconds: number
  sessions_allowed: number
}

export interface HeartbeatResponse {
  elapsed_seconds: number
  remaining_seconds: number
}
