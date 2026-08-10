import { apiClient } from './client'
import type { RecordWithConfig, RecordProgress } from '../types/data'

export const getNextRecord = () =>
  apiClient.get<{ data: RecordWithConfig }>('/records/next')

export const getRecordProgress = () =>
  apiClient.get<{ data: RecordProgress }>('/records/progress')

export const submitRecord = (
  recordId: string,
  sessionId: string,
  inputValues: Record<string, string>
) =>
  apiClient.post(`/records/${recordId}/submit`, {
    session_id: sessionId,
    input_values: inputValues,
  })
