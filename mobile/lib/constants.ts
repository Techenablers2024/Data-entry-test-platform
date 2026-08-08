export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://34.180.36.169:8080/api/v1'
export const MAX_SESSION_SECONDS  = 4 * 60 * 60
export const MAX_DAILY_SECONDS    = 8 * 60 * 60
export const HEARTBEAT_INTERVAL   = 60_000
export const WARN_THRESHOLD_SECS  = 30 * 60
export const CRITICAL_THRESHOLD_SECS = 5 * 60
