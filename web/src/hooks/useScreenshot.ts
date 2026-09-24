import type { FieldConfig, DataRecord } from '../types/data'

interface WatermarkOptions {
  username: string
  displayId: string
  recordSeq: string | number
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
  const { username, displayId, recordSeq, record, fieldConfig, inputValues } = options
  const refFields   = fieldConfig.filter(f => f.is_reference)
  const inputFields = fieldConfig.filter(f => !f.is_reference)
  const values      = record.values as Record<string, string>

  // Derive App No from first reference field
  const appNo = refFields[0] ? (values[refFields[0].column_key] || '—') : '—'

  const rows = inputFields.map((f, i) => {
    const ref      = refFields[i]
    const refVal   = ref ? (values[ref.column_key] || '—') : '—'
    const refLabel = ref?.label ?? ''
    const entered  = inputValues[f.column_key] || ''
    const rowBg    = i % 2 === 0 ? '#ffffff' : '#f0fdfa'
    return `
      <tr style="background:${rowBg}">
        <td style="padding:7px 14px;border-right:1px solid #99f6e4;width:50%;vertical-align:middle">
          <div style="display:flex;align-items:baseline;gap:10px">
            <span style="font-size:11px;font-weight:700;color:#0f766e;text-transform:uppercase;letter-spacing:0.05em;flex-shrink:0;min-width:120px">${escHtml(refLabel)}</span>
            <span style="font-size:13px;color:#111827;font-weight:500">${escHtml(refVal)}</span>
          </div>
        </td>
        <td style="padding:7px 14px;width:50%;vertical-align:middle">
          <div style="display:flex;align-items:baseline;gap:10px">
            <span style="font-size:11px;font-weight:700;color:#0d9488;text-transform:uppercase;letter-spacing:0.05em;flex-shrink:0;min-width:140px">${escHtml(f.label)}</span>
            <span style="font-size:13px;color:${entered ? '#111827' : '#9ca3af'};font-weight:${entered ? '500' : '400'}">${escHtml(entered || '(not entered)')}</span>
          </div>
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
  tr { border-bottom: 1px solid #ccfbf1; }
</style>
</head>
<body>

  <!-- App Header -->
  <div style="background:#0f766e;padding:10px 16px;display:flex;justify-content:space-between;align-items:center">
    <div style="color:#fff;font-weight:800;font-size:16px">MMT Associate Software</div>
    <div style="color:#99f6e4;font-size:12px;font-weight:600">Record #${escHtml(String(recordSeq))}</div>
  </div>

  <!-- Title -->
  <div style="background:#134e4a;padding:6px 16px;text-align:center">
    <span style="color:#ccfbf1;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em">Screenshot of (App No: ${escHtml(appNo)})</span>
  </div>

  <!-- Form Upload Details -->
  <div style="display:flex;border-bottom:2px solid #0f766e">
    <div style="flex:1;border-right:1px solid #99f6e4">
      <div style="background:#0d9488;padding:6px 14px;text-align:center">
        <span style="color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">Form Upload Details</span>
      </div>
      <div style="padding:10px 14px;background:#f0fdfa">
        ${[
          ['Mem ID',  displayId],
          ['Pro No',  'MMT_PRO001'],
          ['U Date',  now],
          ['App No',  appNo],
        ].map(([label, val]) => `
          <div style="display:flex;gap:12px;align-items:baseline;padding:3px 0">
            <span style="font-size:12px;font-weight:700;color:#134e4a;min-width:60px">${escHtml(label)}</span>
            <span style="font-size:12px;color:#111827;font-weight:500">${escHtml(val)}</span>
          </div>`).join('')}
      </div>
    </div>
    <div style="flex:1;display:flex;align-items:center;justify-content:center;background:#f0fdfa">
      <span style="font-size:11px;font-weight:600;color:#0f766e;text-align:center;padding:10px 14px">
        Submitted by: <strong>${escHtml(username)}</strong><br/>
        <span style="color:#0d9488;font-size:10px">${escHtml(displayId)}</span>
      </span>
    </div>
  </div>

  <!-- Column headers -->
  <div style="display:flex;background:#134e4a">
    <div style="flex:1;padding:7px 14px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;border-right:1px solid #1f6464">Reference Data</div>
    <div style="flex:1;padding:7px 14px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">Entered Data</div>
  </div>

  <!-- Rows -->
  <table>${rows}</table>

  <!-- Footer watermark -->
  <div style="background:#134e4a;padding:8px 16px;margin-top:0">
    <span style="color:#fff;font-size:12px;font-weight:600">${escHtml(username)}</span>
    <span style="color:#99f6e4;font-size:12px"> &nbsp;|&nbsp; ${escHtml(displayId)} &nbsp;|&nbsp; ${escHtml(now)} &nbsp;|&nbsp; Record #${escHtml(String(recordSeq))}</span>
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
