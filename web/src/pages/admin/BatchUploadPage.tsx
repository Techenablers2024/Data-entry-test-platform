import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listBatches, uploadBatch, deleteBatch } from '../../api/data'
import type { Batch } from '../../types/data'

export function BatchUploadPage() {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<any>(null)
  const [uploadError, setUploadError] = useState('')

  const [deleteError, setDeleteError] = useState('')

  const { data: batches, isLoading } = useQuery({
    queryKey: ['admin-batches'],
    queryFn: () => listBatches().then((r) => r.data.data),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteBatch(id),
    onSuccess: () => {
      setDeleteError('')
      qc.invalidateQueries({ queryKey: ['admin-batches'] })
    },
    onError: (err: any) => {
      setDeleteError(err.response?.data?.error ?? 'Failed to delete batch.')
    },
  })

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError('')
    setUploadResult(null)
    setUploading(true)
    try {
      const res = await uploadBatch(file)
      setUploadResult(res.data.data)
      qc.invalidateQueries({ queryKey: ['admin-batches'] })
    } catch (err: any) {
      setUploadError(err.response?.data?.error || 'Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Data Upload</h1>

      {/* Upload zone */}
      <div className="bg-white rounded-2xl border-2 border-dashed border-blue-300 p-8 text-center mb-6 hover:border-blue-400 transition-colors">
        <div className="text-4xl mb-3">📊</div>
        <p className="text-gray-700 font-medium mb-1">Upload Excel file (.xlsx)</p>
        <p className="text-gray-400 text-sm mb-4">
          Row 1: Column labels &nbsp;|&nbsp; Row 2: Types (display / text / number / date / dropdown:A|B) &nbsp;|&nbsp; Row 3+: Data
        </p>
        <button onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {uploading ? 'Uploading…' : 'Choose File'}
        </button>
        <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={handleUpload} />
      </div>

      {uploadResult && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 text-sm text-green-800">
          ✅ Uploaded successfully: <strong>{uploadResult.record_count}</strong> records added
          {uploadResult.warnings?.length > 0 && (
            <ul className="mt-2 list-disc list-inside text-amber-700">
              {uploadResult.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}
            </ul>
          )}
        </div>
      )}
      {uploadError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-700">
          ❌ {uploadError}
        </div>
      )}

      {deleteError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-700 flex items-start gap-2">
          <span>❌</span>
          <span>{deleteError}</span>
          <button onClick={() => setDeleteError('')} className="ml-auto text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Batch list */}
      <h2 className="text-base font-semibold text-gray-800 mb-3">Uploaded Batches</h2>
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="w-7 h-7 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Batch #', 'Filename', 'Records', 'Uploaded', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(batches ?? []).map((b: Batch, idx: number) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-blue-600">Batch #{idx + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{b.filename}</td>
                  <td className="px-4 py-3 text-gray-600">{b.record_count}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(b.uploaded_at).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => { if (confirm('Delete this batch? This cannot be undone.')) deleteMut.mutate(b.id) }}
                      className="px-2.5 py-1 bg-red-100 text-red-700 text-xs rounded-lg hover:bg-red-200">Delete</button>
                  </td>
                </tr>
              ))}
              {(batches ?? []).length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No batches uploaded yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
