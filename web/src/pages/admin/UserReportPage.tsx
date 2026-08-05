import { useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../api/client'

function getUserReport(userId: string, page: number, limit: number) {
  return apiClient
    .get(`/admin/users/${userId}/report`, { params: { page, limit } })
    .then(r => r.data.data)
}

export function UserReportPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const userName = searchParams.get('name') ?? 'User'

  const [page, setPage] = useState(1)
  const limit = 50
  const [expandedSub, setExpandedSub] = useState<string | null>(null)

  const { data: report, isLoading, isError } = useQuery({
    queryKey: ['user-report', id, page],
    queryFn: () => getUserReport(id!, page, limit),
    enabled: !!id,
  })

  const accuracyColor = (acc: number) =>
    acc >= 90 ? 'text-green-600' : acc >= 70 ? 'text-amber-600' : 'text-red-600'

  const accuracyBadge = (acc: number) =>
    acc >= 90 ? 'bg-green-100 text-green-700' :
    acc >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/admin/users')}
          className="text-blue-600 hover:underline text-sm flex items-center gap-1">
          ← Users
        </button>
        <span className="text-gray-400">/</span>
        <h1 className="text-xl font-bold text-gray-900">{userName}'s Report</h1>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700 font-medium">No submissions found for this user yet.</p>
          <p className="text-red-500 text-sm mt-1">Submissions will appear here once the user completes records.</p>
        </div>
      )}

      {report && (
        <>
          {/* Summary card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
            <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-500">Total records submitted</p>
                <p className="text-2xl font-bold text-gray-900">{report.total_records}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Overall accuracy</p>
                <p className={`text-3xl font-bold ${accuracyColor(report.avg_accuracy)}`}>
                  {report.avg_accuracy.toFixed(1)}%
                </p>
              </div>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  report.avg_accuracy >= 90 ? 'bg-green-500' :
                  report.avg_accuracy >= 70 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(report.avg_accuracy, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-gray-400">0%</span>
              <span className="text-xs text-gray-400">100%</span>
            </div>
          </div>

          {/* Submissions table */}
          <div className="space-y-2">
            {(report.submissions ?? []).map((sub: any) => (
              <div key={sub.submission_id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Row header */}
                <button
                  onClick={() => setExpandedSub(expandedSub === sub.submission_id ? null : sub.submission_id)}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                      #{sub.sequence_number}
                    </span>
                    <span className="text-sm text-gray-500">{sub.submitted_at}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${accuracyBadge(sub.accuracy)}`}>
                      {sub.accuracy.toFixed(1)}%
                    </span>
                    <span className="text-xs text-gray-400">{sub.correct_count}/{sub.total_count} correct</span>
                    <span className="text-gray-400 text-xs ml-1">{expandedSub === sub.submission_id ? '▲' : '▼'}</span>
                  </div>
                </button>

                {/* Field breakdown */}
                {expandedSub === sub.submission_id && (
                  <div className="border-t border-gray-100">
                    <div className="grid grid-cols-4 px-5 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <span>Field</span>
                      <span>Expected</span>
                      <span>Entered</span>
                      <span className="text-center">Result</span>
                    </div>
                    {(sub.fields ?? [])
                      .sort((a: any, b: any) => a.field_label?.localeCompare(b.field_label ?? '') ?? 0)
                      .map((field: any, idx: number) => (
                        <div key={idx}
                          className={`grid grid-cols-4 px-5 py-2.5 border-b border-gray-50 text-sm ${
                            idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'
                          }`}
                        >
                          <span className="font-medium text-gray-700 pr-2 truncate">{field.field_label}</span>
                          <span className="text-gray-600 pr-2 truncate">{field.expected || '—'}</span>
                          <span className={`pr-2 truncate ${field.correct ? 'text-gray-600' : 'text-red-600 font-medium'}`}>
                            {field.entered || '(blank)'}
                          </span>
                          <span className="text-center text-base">
                            {field.correct ? '✅' : '❌'}
                          </span>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {report.total_pages > 1 && (
            <div className="flex items-center justify-between mt-5">
              <p className="text-sm text-gray-500">
                Page {report.page} of {report.total_pages} &nbsp;·&nbsp; {report.total_records} total records
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setPage(p => p - 1); setExpandedSub(null) }}
                  disabled={report.page <= 1}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50"
                >
                  ← Prev
                </button>
                {/* Page number buttons — show up to 7 pages */}
                {Array.from({ length: Math.min(report.total_pages, 7) }, (_, i) => {
                  const p = report.total_pages <= 7 ? i + 1 :
                    report.page <= 4 ? i + 1 :
                    report.page >= report.total_pages - 3 ? report.total_pages - 6 + i :
                    report.page - 3 + i
                  return (
                    <button key={p}
                      onClick={() => { setPage(p); setExpandedSub(null) }}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                        p === report.page
                          ? 'bg-blue-600 text-white'
                          : 'border border-gray-300 hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      {p}
                    </button>
                  )
                })}
                <button
                  onClick={() => { setPage(p => p + 1); setExpandedSub(null) }}
                  disabled={report.page >= report.total_pages}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
