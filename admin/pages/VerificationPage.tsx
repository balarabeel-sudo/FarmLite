import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import AdminLayout from '../AdminLayout'
import { useStaff } from '../AdminStaffContext'
import { logAdminAction } from '../adminAuth'

const A = { surface: '#FFFFFF', border: '#E3E7E3', green: '#16A34A', text: '#0F1A0F', textMuted: '#6B7280', bg: '#F7F8F7', red: '#DC2626', amber: '#B45309', amberBg: '#FEF3C7' }

type Company = {
  id: string
  name: string
  category: string
  business_type: string | null
  description: string | null
  country: string | null
  state: string | null
  city: string | null
  address: string | null
  registration_country: string | null
  registration_authority: string | null
  registration_number: string | null
  registered_business_name: string | null
  registration_document_url: string | null
  representative_name: string | null
  representative_role: string | null
  representative_email: string | null
  representative_phone: string | null
  status: string
  review_note: string | null
  created_at: string
}

const STATUS_LABEL: Record<string, { text: string; bg: string; color: string }> = {
  pending: { text: 'Pending', bg: '#FEF3C7', color: '#92400E' },
  needs_review: { text: 'Needs Review', bg: '#FEF3C7', color: '#92400E' },
  rejected: { text: 'Rejected', bg: '#FEE2E2', color: '#991B1B' },
}

const FILTERS: { value: string; label: string }[] = [
  { value: 'queue', label: 'Awaiting Review' },
  { value: 'rejected', label: 'Rejected' },
]

export default function VerificationPage() {
  const staff = useStaff()
  const canVerify = staff.permissions.has('companies.verify')

  const [filter, setFilter] = useState('queue')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [companies, setCompanies] = useState<Company[]>([])
  const [selected, setSelected] = useState<Company | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState('')

  const COLUMNS = `
    id, name, category, business_type, description, country, state, city, address,
    registration_country, registration_authority, registration_number, registered_business_name, registration_document_url,
    representative_name, representative_role, representative_email, representative_phone, status, review_note, created_at
  `.replace(/\s+/g, ' ').trim()

  const load = async () => {
    setError(false)
    setLoading(true)
    const statuses = filter === 'queue' ? ['pending', 'needs_review'] : ['rejected']
    const { data, error } = await supabase.from('companies').select(COLUMNS).in('status', statuses).order('created_at', { ascending: true })
    if (error) {
      setError(true)
      setLoading(false)
      return
    }
    setCompanies((data || []) as any)
    setLoading(false)
  }

  useEffect(() => { load() }, [filter])

  const openCompany = (c: Company) => {
    setSelected(c)
    setNote('')
  }

  const decide = async (status: 'verified' | 'rejected' | 'needs_review') => {
    if (!selected) return
    setSaving(status)
    const { error } = await supabase.from('companies').update({
      status,
      review_note: status === 'verified' ? null : (note.trim() || null),
    }).eq('id', selected.id)
    setSaving('')

    if (!error) {
      await logAdminAction(
        status === 'verified' ? 'Approved company verification' : status === 'rejected' ? 'Rejected company verification' : 'Requested more information from company',
        { type: 'company', id: selected.id, label: selected.name },
        note.trim() ? { note: note.trim() } : undefined,
      )
      setSelected(null)
      load()
    }
  }

  return (
    <AdminLayout title="Verification">
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {FILTERS.map((f) => (
          <div
            key={f.value}
            onClick={() => setFilter(f.value)}
            style={{
              padding: '7px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
              background: filter === f.value ? A.green : A.surface,
              color: filter === f.value ? 'white' : A.textMuted,
              border: `1px solid ${filter === f.value ? A.green : A.border}`,
            }}>
            {f.label}
          </div>
        ))}
      </div>

      <div style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: '10px', overflow: 'hidden' }}>
        {loading ? (
          <p style={{ padding: '20px', fontSize: '13px', color: A.textMuted }}>Loading...</p>
        ) : error ? (
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: A.textMuted, marginBottom: '10px' }}>Could not load companies.</p>
            <span onClick={load} style={{ fontSize: '13px', fontWeight: 700, color: A.green, cursor: 'pointer' }}>Try again</span>
          </div>
        ) : companies.length === 0 ? (
          <p style={{ padding: '20px', fontSize: '13px', color: A.textMuted }}>
            {filter === 'queue' ? 'No pending company verifications.' : 'No rejected companies.'}
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: A.bg, textAlign: 'left' }}>
                {['Company', 'Category', 'Registered in', 'Status', 'Submitted'].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: A.textMuted, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => {
                const s = STATUS_LABEL[c.status]
                return (
                  <tr key={c.id} onClick={() => openCompany(c)} style={{ borderTop: `1px solid ${A.border}`, cursor: 'pointer' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: A.text }}>{c.name}</td>
                    <td style={{ padding: '10px 16px', color: A.textMuted }}>{c.category}</td>
                    <td style={{ padding: '10px 16px', color: A.textMuted }}>{c.registration_country || '—'}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ background: s.bg, color: s.color, fontSize: '11px', fontWeight: 700, padding: '3px 9px', borderRadius: '999px' }}>{s.text}</span>
                    </td>
                    <td style={{ padding: '10px 16px', color: A.textMuted }}>{new Date(c.created_at).toLocaleDateString()}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <div onClick={() => setSelected(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', justifyContent: 'flex-end' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: A.surface, width: '640px', maxWidth: '100%', height: '100%', overflowY: 'auto', padding: '24px' }}>
            <p style={{ fontSize: '18px', fontWeight: 800, color: A.text }}>{selected.name}</p>
            <p style={{ fontSize: '12.5px', color: A.textMuted, marginTop: '4px' }}>
              {selected.category}{selected.business_type ? ` · ${selected.business_type}` : ''}
            </p>

            <div style={{ display: 'flex', gap: '20px', marginTop: '20px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '260px' }}>
                <SectionLabel text="Business Information" />
                <Field label="Description" value={selected.description} />
                <Field label="Location" value={[selected.city, selected.state, selected.country].filter(Boolean).join(', ')} />
                <Field label="Address" value={selected.address} />

                <SectionLabel text="Registration" />
                <Field label="Registration country" value={selected.registration_country} />
                <Field label="Authority" value={selected.registration_authority} />
                <Field label="Registration number" value={selected.registration_number} />
                <Field label="Registered business name" value={selected.registered_business_name} />

                <SectionLabel text="Representative" />
                <Field label="Name" value={selected.representative_name} />
                <Field label="Role" value={selected.representative_role} />
                <Field label="Email" value={selected.representative_email} />
                <Field label="Phone" value={selected.representative_phone} />
              </div>

              <div style={{ flex: 1, minWidth: '220px' }}>
                <SectionLabel text="Registration Document" />
                {selected.registration_document_url ? (
                  selected.registration_document_url.toLowerCase().endsWith('.pdf') ? (
                    <a href={selected.registration_document_url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', padding: '30px 16px', textAlign: 'center', border: `1px dashed ${A.border}`, borderRadius: '10px', fontSize: '13px', fontWeight: 700, color: A.green, textDecoration: 'none' }}>
                      Open PDF certificate
                    </a>
                  ) : (
                    <a href={selected.registration_document_url} target="_blank" rel="noopener noreferrer">
                      <img src={selected.registration_document_url} alt="Registration document" style={{ width: '100%', borderRadius: '10px', border: `1px solid ${A.border}` }} />
                    </a>
                  )
                ) : (
                  <p style={{ fontSize: '12.5px', color: A.textMuted }}>No document uploaded.</p>
                )}
              </div>
            </div>

            {selected.review_note && (
              <div style={{ background: A.amberBg, borderRadius: '8px', padding: '10px 12px', marginTop: '20px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, color: A.amber, marginBottom: '3px' }}>Previous note to company</p>
                <p style={{ fontSize: '12.5px', color: A.amber }}>{selected.review_note}</p>
              </div>
            )}

            {canVerify && (
              <div style={{ marginTop: '24px', borderTop: `1px solid ${A.border}`, paddingTop: '18px' }}>
                <p style={{ fontSize: '12px', fontWeight: 600, color: A.text, marginBottom: '6px' }}>Note (shown to the company if rejected or needs review)</p>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Optional note..." style={{ width: '100%', padding: '9px 11px', borderRadius: '8px', border: `1px solid ${A.border}`, fontSize: '13px', boxSizing: 'border-box', marginBottom: '14px', resize: 'none' }} />
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <Btn label="Approve" color={A.green} onClick={() => decide('verified')} busy={saving === 'verified'} />
                  <Btn label="Request Information" color={A.amber} onClick={() => decide('needs_review')} busy={saving === 'needs_review'} />
                  <Btn label="Reject" color={A.red} onClick={() => decide('rejected')} busy={saving === 'rejected'} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

function SectionLabel({ text }: { text: string }) {
  return <p style={{ fontSize: '11px', fontWeight: 700, color: A.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', margin: '16px 0 8px' }}>{text}</p>
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div style={{ marginBottom: '8px' }}>
      <p style={{ fontSize: '11px', color: A.textMuted }}>{label}</p>
      <p style={{ fontSize: '13px', color: A.text, fontWeight: 500 }}>{value || '—'}</p>
    </div>
  )
}

function Btn({ label, color, onClick, busy }: { label: string; color: string; onClick: () => void; busy: boolean }) {
  return (
    <div onClick={busy ? undefined : onClick} style={{ padding: '9px 16px', borderRadius: '8px', background: color, color: 'white', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
      {busy ? '...' : label}
    </div>
  )
}
