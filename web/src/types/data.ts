export type FieldType = 'display' | 'text' | 'number' | 'date' | 'dropdown'

export interface FieldConfig {
  id: string
  batch_id: string
  column_key: string
  label: string
  field_type: FieldType
  is_reference: boolean
  dropdown_options?: string[]
  sort_order: number
}

export interface DataRecord {
  id: string
  global_sequence: number
  batch_id: string
  values: Record<string, string>
  status: 'active' | 'disabled'
  created_at: string
}

export interface RecordWithConfig {
  record: DataRecord
  field_config: FieldConfig[]
}

export interface Submission {
  id: string
  user_id: string
  data_record_id: string
  session_id: string
  submitted_at: string
  input_values: Record<string, string>
  sequence_number: number
}

export interface Batch {
  id: string
  filename: string
  uploaded_at: string
  uploaded_by: string
  record_count: number
}
