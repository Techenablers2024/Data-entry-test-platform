import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listUsers } from '../../api/admin'
import { apiClient } from '../../api/client'

function getUserReport(userId: string) {
  return apiClient.get(`/admin/users/${userId}/report`).then(r => r.data.data)
}

export function ReportsPage() {
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [expandedSub, setExpandedSub] = useState<string | null>(null)

  const { data: users } = useQuery({
    queryKey: ['admin-users-active'],
    queryFn: () => listUsers('active').then(r => r.data.data),
  })

  const { data: report, isLoading, isError } = useQuery({
    queryKey: ['user-report', selectedUserId],
    queryFn: () => getUserReport(selectedUserId),
    enabled: !!selectedUserId,
  })

  const accuracyColor = (acc: number) =>
    acc >= 90 ? 'text-green-600' : acc >= 70 ? 'text-amber-600' : 'text-red-600'

  const accuracyBg = (acc: number) =>
    acc >= 90 ? 'bg-green-100 text-green-700' : acc >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-gray-900 mb-6">User Reports</h1>

      {/* User selector */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select User</label>
        <select
          value={selectedUserId}
          onChange={e => { setSelectedUserId(e.target.value); setExpandedSub(null) }}
          className="border border-gray-300 rounded-xl px-4 py-2.5 text-sm w-full max-w-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">-- Choose a user --</option>
          {(users ?? []).map(u => (
            <option key={u.id} value={u.id}>{u.name} ({u.mobile})</option>
          ))}
        </select>
      </div>

      {/* Report */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          No submissions found for this user yet.
        </div>
      )}

      {report && (
        <>
          {/* Summary card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{report.user_name}</h2>
                <p className="text-sm text-gray-500">{report.total_records} record{report.total_records !== 1 ? 's' : ''} submitted</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 mb-1">Overall Accuracy</p>
                <p className={`text-3xl font-bold ${accuracyColor(report.avg_accuracy)}`}>
                  {report.avg_accuracy.toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Accuracy bar */}
            <div className="mt-4 h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  report.avg_accuracy >= 90 ? 'bg-green-500' :
                  report.avg_accuracy >= 70 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(report.avg_accuracy, 100)}%` }}
              />
            </div>
          </div>

          {/* Submissions list */}
          <div className="space-y-3">
            {(report.submissions ?? []).map((sub: any) => (
              <div key={sub.submission_id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                {/* Submission header */}
                <button
                  onClick={() => setExpandedSub(expandedSub === sub.submission_id ? null : sub.submission_id)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                      #{sub.sequence_number}
                    </span>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-800">Record #{sub.sequence_number}</p>
                      <p className="text-xs text-gray-500">{sub.submitted_at}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${accuracyBg(sub.accuracy)}`}>
                      {sub.accuracy.toFixed(1)}%
                    </span>
                    <span className="text-xs text-gray-500">{sub.correct_count}/{sub.total_count} correct</span>
                    <span className="text-gray-400 text-xs">{expandedSub === sub.submission_id ? '▲' : '▼'}</span>
                  </div>
                </button>

                {/* Field-by-field breakdown */}
                {expandedSub === sub.submission_id && (
                  <div className="border-t border-gray-100">
                    {/* Column headers */}
                    <div className="grid grid-cols-4 px-5 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <span>Field</span>
                      <span>Expected</span>
                      <span>Entered</span>
                      <span className="text-center">Result</span>
                    </div>
                    {(sub.fields ?? [])
                      .sort((a: any, b: any) => a.field_label.localeCompare(b.field_label))
                      .map((field: any, idx: number) => (
                        <div
                          key={idx}
                          className={`grid grid-cols-4 px-5 py-3 border-b border-gray-50 text-sm ${
                            idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                          }`}
                        >
                          <span className="font-medium text-gray-700 pr-2">{field.field_label}</span>
                          <span className="text-gray-600 pr-2">{field.expected || '—'}</span>
                          <span className={`pr-2 ${field.correct ? 'text-gray-600' : 'text-red-600 font-medium'}`}>
                            {field.entered || '(blank)'}
                          </span>
                          <span className="text-center">
                            {field.correct
                              ? <span className="text-green-600 font-bold">✓</span>
                              : <span className="text-red-500 font-bold">✗</span>
                            }
                          </span>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
