import { apiClient } from './client'
import type { RecordWithConfig, Submission, Batch } from '../types/data'

export const getNextRecord = () =>
  apiClient.get<{ data: RecordWithConfig }>('/records/next')

export const getRecord = (id: string) =>
  apiClient.get<{ data: RecordWithConfig }>(`/records/${id}`)

export const submitRecord = (recordId: string, sessionId: string, inputValues: Record<string, string>) =>
  apiClient.post<{ data: Submission }>(`/records/${recordId}/submit`, {
    session_id: sessionId,
    input_values: inputValues,
  })

// Admin
export const uploadBatch = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return apiClient.post('/admin/batches', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const listBatches = () =>
  apiClient.get<{ data: Batch[] }>('/admin/batches')

export const deleteBatch = (id: string) =>
  apiClient.delete(`/admin/batches/${id}`)

export const listRecords = (params?: { batch_id?: string; status?: string }) =>
  apiClient.get('/admin/records', { params })

export const enableRecord = (id: string) =>
  apiClient.patch(`/admin/records/${id}/enable`)

export const disableRecord = (id: string) =>
  apiClient.patch(`/admin/records/${id}/disable`)

export const deleteRecord = (id: string) =>
  apiClient.delete(`/admin/records/${id}`)
