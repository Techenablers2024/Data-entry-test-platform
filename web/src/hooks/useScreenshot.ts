import type { FieldConfig, DataRecord } from '../types/data'

interface WatermarkOptions {
  username: string
  recordSeq: number
  record: DataRecord
  fieldConfig: FieldConfig[]
  inputValues: Record<string, string>
}

export async function takeScreenshot(options: WatermarkOptions): Promise<void> {
  if (!window.electronAPI?.captureHtml) throw new Error('Electron API not available')

  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  const filename = `screenshot-record${options.recordSeq}-${Date.now()}.png`

  const html = buildHtml(options, now)

  const base64 = await window.electronAPI.captureHtml(html)
  if (!base64) throw new Error('captureHtml returned null')

  const result = await window.electronAPI.saveScreenshot(
    'data:image/png;base64,' + base64, filename
  )
  if (!result.saved) return
}

function buildHtml(options: WatermarkOptions, now: string): string {
  const { username, recordSeq, record, fieldConfig, inputValues } = options
  const refFields   = fieldConfig.filter(f => f.is_reference)
  const inputFields = fieldConfig.filter(f => !f.is_reference)
  const values      = record.values as Record<string, string>

  const rows = inputFields.map((f, i) => {
    const ref     = refFields[i]
    const refVal  = ref ? (values[ref.column_key] || '—') : '—'
    const refLabel = ref?.label ?? ''
    const entered = inputValues[f.column_key] || ''
    const rowBg   = i % 2 === 0 ? '#ffffff' : '#f8fafc'
    return `
      <tr style="background:${rowBg}">
        <td style="padding:10px 16px;border-right:1px solid #bfdbfe;background:#eff6ff;width:50%;vertical-align:top">
          <div style="font-size:10px;font-weight:700;color:#3b82f6;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:3px">${escHtml(refLabel)}</div>
          <div style="font-size:13px;color:#111827;font-weight:500">${escHtml(refVal)}</div>
        </td>
        <td style="padding:10px 16px;width:50%;vertical-align:top">
          <div style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:3px">${escHtml(f.label)}</div>
          <div style="font-size:13px;color:${entered ? '#111827' : '#9ca3af'};font-weight:${entered ? '500' : '400'}">${escHtml(entered || '(not entered)')}</div>
        </td>
      </tr>`
  }).join('')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; background: #fff; }
  table { width: 100%; border-collapse: collapse; }
  tr { border-bottom: 1px solid #e5e7eb; }
</style>
</head>
<body>
  <!-- Header -->
  <div style="background:#1d4ed8;padding:12px 16px;display:flex;justify-content:space-between;align-items:center">
    <div style="color:#fff;font-weight:700;font-size:15px">DataEntry Pro</div>
    <div style="color:#bfdbfe;font-size:12px">Record #${recordSeq}</div>
  </div>

  <!-- Column headers -->
  <div style="display:flex;background:#1e3a5f">
    <div style="flex:1;padding:8px 16px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;border-right:1px solid #2d5a8e">Reference Data</div>
    <div style="flex:1;padding:8px 16px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">Entered Data</div>
  </div>

  <!-- Rows -->
  <table>${rows}</table>

  <!-- Watermark footer -->
  <div style="background:#1e293b;padding:10px 16px;margin-top:0">
    <span style="color:#fff;font-size:12px;font-weight:600">${escHtml(username)}</span>
    <span style="color:#94a3b8;font-size:12px"> &nbsp;|&nbsp; ${escHtml(now)} &nbsp;|&nbsp; Record #${recordSeq}</span>
  </div>
</body>
</html>`
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
