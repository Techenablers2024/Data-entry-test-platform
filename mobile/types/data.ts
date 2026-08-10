export type FieldType = 'display' | 'text' | 'number' | 'date' | 'dropdown' | 'fixed'

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
}

export interface RecordWithConfig {
  record: DataRecord
  field_config: FieldConfig[]
}

export interface RecordProgress {
  total: number
  completed: number
  pending: number
}
