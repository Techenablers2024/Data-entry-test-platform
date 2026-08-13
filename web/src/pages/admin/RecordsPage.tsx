import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listRecords, enableRecord, disableRecord, deleteRecord, listBatches } from '../../api/data'
import { apiClient } from '../../api/client'

function getRecordWithConfig(recordId: string) {
  return apiClient.get(`/records/${recordId}`).then(r => r.data.data)
}

export function RecordsPage() {
  const qc = useQueryClient()
  const [batchFilter, setBatchFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [viewRecord, setViewRecord] = useState<any>(null)
  const [loadingView, setLoadingView] = useState(false)

  const { data: batches } = useQuery({
    queryKey: ['admin-batches'],
    queryFn: () => listBatches().then((r) => r.data.data),
  })

  // Build lookup: batch_id → "Batch #N — filename"
  const batchMap = Object.fromEntries(
    [...(batches ?? [])]
      .sort((a: any, b: any) => new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime())
      .map((b: any, idx: number) => [
        b.id,
        { label: `Batch #${idx + 1}`, filename: b.filename, full: `Batch #${idx + 1} — ${b.filename}` }
      ])
  )

  const { data: records, isLoading } = useQuery({
    queryKey: ['admin-records', batchFilter, statusFilter],
    queryFn: () => listRecords({ batch_id: batchFilter || undefined, status: statusFilter || undefined }).then((r) => r.data.data),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-records'] })
  const enable  = useMutation({ mutationFn: (id: string) => enableRecord(id),  onSuccess: invalidate })
  const disable = useMutation({ mutationFn: (id: string) => disableRecord(id), onSuccess: invalidate })
  const del     = useMutation({ mutationFn: (id: string) => deleteRecord(id),  onSuccess: invalidate, onError: (err: any) => alert(err.response?.data?.error ?? 'Failed to delete record.') })

  const handleView = async (id: string) => {
    setLoadingView(true)
    try {
      const data = await getRecordWithConfig(id)
      setViewRecord(data)
    } finally {
      setLoadingView(false)
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-900">Records</h1>
        <div className="flex items-center gap-2">
          <select value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
            <option value="">All batches</option>
            {[...(batches ?? [])]
              .sort((a: any, b: any) => new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime())
              .map((b: any, idx: number) => (
                <option key={b.id} value={b.id}>Batch #{idx + 1} — {b.filename}</option>
              ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide w-16">#</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Batch</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Data Preview</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(records ?? []).map((r: any) => (
                <tr key={r.id} className={`hover:bg-gray-50 ${r.status === 'disabled' ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-mono text-gray-500">
                    <div>#{r.global_sequence ?? '—'}</div>
                    <div className="text-xs text-blue-600">{r.record_code ?? ''}</div>
                  </td>
                  <td className="px-4 py-3 max-w-[160px]" title={batchMap[r.batch_id]?.full}>
                    <div className="text-xs font-semibold text-blue-700">{batchMap[r.batch_id]?.label ?? '—'}</div>
                    <div className="text-xs text-gray-400 truncate">{batchMap[r.batch_id]?.filename ?? ''}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700 max-w-xs truncate">
                    {Object.values(r.values as Record<string, string>).slice(0, 3).join(' · ')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      r.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleView(r.id)}
                        className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs rounded-lg hover:bg-blue-200">
                        👁 View
                      </button>
                      {r.status === 'active'
                        ? <button onClick={() => disable.mutate(r.id)}
                            className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs rounded-lg hover:bg-amber-200">Disable</button>
                        : <button onClick={() => enable.mutate(r.id)}
                            className="px-2.5 py-1 bg-green-100 text-green-700 text-xs rounded-lg hover:bg-green-200">Enable</button>
                      }
                      <button onClick={() => { if (confirm('Delete this record? This cannot be undone.')) del.mutate(r.id) }}
                        className="px-2.5 py-1 bg-red-100 text-red-700 text-xs rounded-lg hover:bg-red-200">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {(records ?? []).length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No records found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* View Record Modal */}
      {(viewRecord || loadingView) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setViewRecord(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-base font-bold text-gray-900">Record Details</h2>
                {viewRecord && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    #{viewRecord.record.global_sequence} · <span className="text-blue-600 font-mono">{viewRecord.record.record_code}</span> · {viewRecord.record.status}
                    {batchMap[viewRecord.record.batch_id] && (
                      <> · <span className="text-blue-600">{batchMap[viewRecord.record.batch_id].full}</span></>
                    )}
                  </p>
                )}
              </div>
              <button onClick={() => setViewRecord(null)}
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 text-lg">
                ✕
              </button>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto flex-1">
              {loadingView ? (
                <div className="flex justify-center py-12">
                  <div className="w-7 h-7 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : viewRecord ? (
                (() => {
                  const refFields = (viewRecord.field_config ?? [])
                    .filter((fc: any) => fc.is_reference)
                    .sort((a: any, b: any) => a.sort_order - b.sort_order)
                  const inputFields = (viewRecord.field_config ?? [])
                    .filter((fc: any) => !fc.is_reference)
                    .sort((a: any, b: any) => a.sort_order - b.sort_order)

                  return (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0 border-b border-gray-200">
                        <tr>
                          <th className="text-left px-5 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide w-1/2">Reference Field</th>
                          <th className="text-left px-5 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Value</th>
                          <th className="text-left px-5 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">User Fills</th>
                          <th className="text-left px-5 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide w-24">Type</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {refFields.map((fc: any, idx: number) => {
                          const inputField = inputFields[idx]
                          return (
                            <tr key={fc.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                              <td className="px-5 py-2.5 font-medium text-blue-700">{fc.label}</td>
                              <td className="px-5 py-2.5 font-semibold text-gray-900">
                                {(viewRecord.record.values as Record<string, string>)[fc.column_key] || '—'}
                              </td>
                              <td className="px-5 py-2.5 text-gray-600">{inputField?.label ?? '—'}</td>
                              <td className="px-5 py-2.5">
                                {inputField && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                    inputField.field_type === 'dropdown' ? 'bg-purple-100 text-purple-700' :
                                    inputField.field_type === 'date'     ? 'bg-blue-100 text-blue-700' :
                                    inputField.field_type === 'number'   ? 'bg-amber-100 text-amber-700' :
                                    'bg-gray-100 text-gray-600'
                                  }`}>
                                    {inputField.field_type}
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )
                })()
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
