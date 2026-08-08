export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://34.180.36.169:8080/api/v1'
export const MAX_SESSION_SECONDS = 4 * 60 * 60   // 4 hours
export const MAX_DAILY_SECONDS   = 8 * 60 * 60   // 8 hours
export const HEARTBEAT_INTERVAL  = 60_000         // 60 seconds
export const WARN_THRESHOLD_SECS = 30 * 60        // 30 minutes
export const CRITICAL_THRESHOLD_SECS = 5 * 60     // 5 minutes
