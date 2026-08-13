import { useState, useRef } from 'react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import type { User } from '../../types/auth'

const STORAGE_KEY = 'receipt_org_branding'

interface OrgBranding {
  orgName: string
  orgAddress: string
  orgPhone: string
  orgEmail: string
  franchiseLine: string
}

interface AdminFields extends OrgBranding {
  dob: string
  gender: string
  state: string
  district: string
  pincode: string
  referredBy: string
  workType: string
  device: string
  amount: string
  amountWords: string
  paidBy: string
  refNo: string
  purpose: string
}

const defaultBranding: OrgBranding = {
  orgName: '',
  orgAddress: '',
  orgPhone: '',
  orgEmail: '',
  franchiseLine: '',
}

function loadBranding(): OrgBranding {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? { ...defaultBranding, ...JSON.parse(saved) } : defaultBranding
  } catch { return defaultBranding }
}

function saveBranding(b: OrgBranding) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(b))
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`
}

function maskMobile(mobile: string) {
  return mobile.length >= 4 ? 'XXXXXX' + mobile.slice(-4) : mobile
}

interface Props {
  user: User
  onClose: () => void
}

export function ReceiptModal({ user, onClose }: Props) {
  const branding = loadBranding()
  const [fields, setFields] = useState<AdminFields>({
    ...branding,
    dob: '',
    gender: '',
    state: '',
    district: '',
    pincode: '',
    referredBy: '0',
    workType: 'MPF',
    device: 'WDL',
    amount: '',
    amountWords: '',
    paidBy: 'PhonePe',
    refNo: 'NIL',
    purpose: 'Consultant charges',
  })
  const [tab, setTab] = useState<'member' | 'cash'>('member')
  const [loading, setLoading] = useState(false)

  const memberRef = useRef<HTMLDivElement>(null)
  const cashRef   = useRef<HTMLDivElement>(null)

  const set = (k: keyof AdminFields, v: string) => setFields(f => ({ ...f, [k]: v }))

  const handleDownload = async () => {
    if (!memberRef.current || !cashRef.current) return
    setLoading(true)

    // Temporarily show both divs for capture
    const m = memberRef.current
    const c = cashRef.current
    const prevM = m.style.display
    const prevC = c.style.display
    m.style.display = 'block'
    c.style.display = 'block'

    try {
      saveBranding({
        orgName: fields.orgName, orgAddress: fields.orgAddress,
        orgPhone: fields.orgPhone, orgEmail: fields.orgEmail,
        franchiseLine: fields.franchiseLine,
      })

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = 210
      const pageH = 297

      const canvas1 = await html2canvas(m, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false })
      const imgData1 = canvas1.toDataURL('image/jpeg', 0.95)
      pdf.addImage(imgData1, 'JPEG', 0, 0, pageW, pageH)

      pdf.addPage()
      const canvas2 = await html2canvas(c, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false })
      const imgData2 = canvas2.toDataURL('image/jpeg', 0.95)
      pdf.addImage(imgData2, 'JPEG', 0, 0, pageW, pageH)

      pdf.save(`receipt-${user.display_id || user.name}.pdf`)
    } catch (err) {
      console.error('PDF generation failed:', err)
      alert('Failed to generate PDF. Please try again.')
    } finally {
      m.style.display = prevM
      c.style.display = prevC
      setLoading(false)
    }
  }

  const regDate = formatDate(user.created_at)

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex overflow-auto p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl mx-auto flex flex-col" style={{ minHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-lg font-bold text-gray-900">Generate Receipt — {user.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left — Form */}
          <div className="w-80 shrink-0 border-r border-gray-200 overflow-y-auto p-4 space-y-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Organization Branding</p>
            {([
              ['orgName', 'Org Name'],
              ['franchiseLine', 'Franchise Line'],
              ['orgAddress', 'Address'],
              ['orgPhone', 'Phone'],
              ['orgEmail', 'Email'],
            ] as [keyof AdminFields, string][]).map(([k, label]) => (
              <div key={k}>
                <label className="text-xs text-gray-500">{label}</label>
                <input value={fields[k]} onChange={e => set(k, e.target.value)}
                  className="mt-0.5 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs" />
              </div>
            ))}

            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide pt-2">Member Info</p>
            {([
              ['dob', 'Date of Birth'],
              ['gender', 'Gender'],
              ['state', 'State'],
              ['district', 'District'],
              ['pincode', 'Pincode'],
              ['referredBy', 'Referred By'],
              ['workType', 'Work Type'],
              ['device', 'Device'],
            ] as [keyof AdminFields, string][]).map(([k, label]) => (
              <div key={k}>
                <label className="text-xs text-gray-500">{label}</label>
                <input value={fields[k]} onChange={e => set(k, e.target.value)}
                  className="mt-0.5 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs" />
              </div>
            ))}

            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide pt-2">Payment Details</p>
            {([
              ['amount', 'Amount (₹)'],
              ['amountWords', 'Amount in Words'],
              ['paidBy', 'Paid By'],
              ['refNo', 'Reference No'],
              ['purpose', 'Purpose'],
            ] as [keyof AdminFields, string][]).map(([k, label]) => (
              <div key={k}>
                <label className="text-xs text-gray-500">{label}</label>
                <input value={fields[k]} onChange={e => set(k, e.target.value)}
                  className="mt-0.5 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs" />
              </div>
            ))}
          </div>

          {/* Right — Preview */}
          <div className="flex-1 overflow-auto bg-gray-100 p-6 flex flex-col items-center gap-6">
            {/* Tab switch */}
            <div className="flex gap-2">
              <button onClick={() => setTab('member')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium ${tab === 'member' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border'}`}>
                Member Receipt
              </button>
              <button onClick={() => setTab('cash')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium ${tab === 'cash' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border'}`}>
                Cash Receipt
              </button>
            </div>

            {/* ── Member Receipt (always rendered for PDF, hidden when not active tab) ── */}
            <div ref={memberRef}
              style={{ width: '794px', minHeight: '1123px', background: '#fff', padding: '40px', fontFamily: 'Arial, sans-serif', fontSize: '12px', display: tab === 'member' ? 'block' : 'none' }}
              className="shadow-lg">
              {/* Header */}
              <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '8px' }}>
                <div style={{ fontSize: '22px', fontWeight: 'bold' }}>{fields.orgName || 'ORGANIZATION NAME'}</div>
                <div style={{ fontSize: '11px' }}>{fields.orgAddress}</div>
                {fields.franchiseLine && <div style={{ fontSize: '11px', fontWeight: 'bold' }}>{fields.franchiseLine}</div>}
                {(fields.orgPhone || fields.orgEmail) && (
                  <div style={{ fontSize: '11px' }}>
                    {fields.orgPhone && `Office No: ${fields.orgPhone}`}
                    {fields.orgPhone && fields.orgEmail && ', '}
                    {fields.orgEmail && `Email ID: ${fields.orgEmail}`}
                  </div>
                )}
              </div>

              {/* Title row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #000', paddingBottom: '6px', marginBottom: '10px' }}>
                <div style={{ fontSize: '16px', fontWeight: 'bold', textDecoration: 'underline' }}>Registered Member &amp; Package Details (MPF)</div>
                <div style={{ textAlign: 'right', fontSize: '11px' }}>
                  <div><strong>Member ID</strong> : {user.display_id || '—'}</div>
                  <div><strong>Date</strong> : {regDate}</div>
                </div>
              </div>

              {/* Two-column body */}
              <div style={{ display: 'flex', gap: '20px' }}>
                {/* Member Details */}
                <div style={{ flex: 1, border: '1px solid #000', padding: '8px' }}>
                  <div style={{ textAlign: 'center', fontWeight: 'bold', textDecoration: 'underline', marginBottom: '8px' }}>Member Details</div>
                  {[
                    ['Member ID', user.display_id],
                    ['Name', user.name],
                    ['Date Of Reg', regDate],
                    ['Date Of Birth', fields.dob],
                    ['Mobile No', maskMobile(user.mobile)],
                    ['Email ID', user.email ?? ''],
                    ['Gender', fields.gender],
                    ['State', fields.state],
                    ['District', fields.district],
                    ['Pincode', fields.pincode],
                    ['Referred By', fields.referredBy],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: 'flex', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 'bold', width: '110px', flexShrink: 0 }}>{label}</span>
                      <span>: {val}</span>
                    </div>
                  ))}
                </div>

                {/* Work Type + Package */}
                <div style={{ width: '260px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ border: '1px solid #000', padding: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ textDecoration: 'underline', fontWeight: 'bold' }}>Work Type</div>
                        <div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '4px' }}>{fields.workType}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ textDecoration: 'underline', fontWeight: 'bold' }}>Device</div>
                        <div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '4px' }}>{fields.device}</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ border: '1px solid #000', padding: '8px' }}>
                    <div style={{ textAlign: 'center', fontWeight: 'bold', textDecoration: 'underline', marginBottom: '6px' }}>Package Details</div>
                    {[
                      ['0 To 10 Error Forms', '6/- For Each Form'],
                      ['11 To 20 Error Forms', '5/- For Each Form'],
                      ['21 To 30 Error Forms', '4/- For Each Form'],
                      ['31 To 40 Error Forms', '3/- For Each Form'],
                      ['41 To 50 Error Forms', '2/- For Each Form'],
                      ['51 To 60 Error Forms', '1/- For Each Form'],
                      ['61 To 100 Error Forms', '0.50 For Each Form'],
                      ['Above 100 Error Forms', '0.25 For Each Form'],
                    ].map(([range, rate]) => (
                      <div key={range} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px' }}>
                        <span>{range}</span><span>{rate}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px', paddingTop: '8px', borderTop: '1px solid #ccc' }}>
                <div><strong>Member Signature</strong></div>
                <div><strong>For {fields.orgName || 'ORGANIZATION'}</strong></div>
              </div>
            </div>

            {/* ── Cash Receipt ── */}
            <div ref={cashRef}
              style={{ width: '794px', minHeight: '1123px', background: '#fff', padding: '40px', fontFamily: 'Arial, sans-serif', fontSize: '12px', display: tab === 'cash' ? 'block' : 'none' }}
              className="shadow-lg">
              {/* Two cash receipts on one page (as in image) */}
              {[0, 1].map(i => (
                <div key={i} style={{ border: '1px solid #000', padding: '20px', marginBottom: i === 0 ? '40px' : '0' }}>
                  {/* Header */}
                  <div style={{ textAlign: 'center', borderBottom: '1px solid #000', paddingBottom: '8px', marginBottom: '8px' }}>
                    <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{fields.orgName || 'ORGANIZATION NAME'}</div>
                    <div style={{ fontSize: '11px' }}>{fields.orgAddress}</div>
                    {fields.franchiseLine && <div style={{ fontSize: '11px', fontWeight: 'bold' }}>{fields.franchiseLine}</div>}
                    {(fields.orgPhone || fields.orgEmail) && (
                      <div style={{ fontSize: '11px' }}>
                        {fields.orgPhone && `Office No: ${fields.orgPhone}`}
                        {fields.orgPhone && fields.orgEmail && ', '}
                        {fields.orgEmail && `Email ID: ${fields.orgEmail}`}
                      </div>
                    )}
                  </div>

                  {/* Title + member id */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', textDecoration: 'underline' }}>Cash Receipts</div>
                    <div style={{ textAlign: 'right', fontSize: '11px' }}>
                      <div><strong>Member ID</strong> &nbsp;: {user.display_id}</div>
                      <div><strong>Date</strong> &nbsp;: {regDate}</div>
                    </div>
                  </div>

                  {/* Body */}
                  {[
                    ['Received from', user.name],
                    ['Amount', fields.amount ? `${fields.amount}/- (${fields.amountWords})` : ''],
                    ['Paid By', `${fields.paidBy} (Ref : ${fields.refNo})`],
                    ['Purpose', fields.purpose],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: 'flex', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 'bold', width: '120px', flexShrink: 0 }}>{label}</span>
                      <span>: {val}</span>
                    </div>
                  ))}

                  {/* Footer */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px' }}>
                    <div><strong>Member Signature</strong></div>
                    <div><strong>For {fields.orgName || 'ORGANIZATION'}</strong></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 shrink-0">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleDownload} disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Generating PDF…' : '⬇ Download PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}
