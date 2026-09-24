import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import AdminLayout from '../AdminLayout'
import { useStaff } from '../AdminStaffContext'
import { logAdminAction } from '../adminAuth'

const A = { surface: '#FFFFFF', border: '#E3E7E3', green: '#16A34A', text: '#0F1A0F', textMuted: '#6B7280', bg: '#F7F8F7', red: '#DC2626', blue: '#2563EB', amber: '#B45309' }

type Company = {
  id: string
  name: string
  category: string
  status: string
  is_premium: boolean
  premium_until: string | null
  trusted_partner: boolean
  followers_count: number
  created_at: string
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pending: { bg: '#FEF3C7', color: '#92400E' },
  needs_review: { bg: '#FEF3C7', color: '#92400E' },
  verified: { bg: '#DCFCE7', color: '#166534' },
  rejected: { bg: '#FEE2E2', color: '#991B1B' },
  suspended: { bg: '#F3F4F6', color: '#4B5563' },
}

const STATUS_FILTERS = ['all', 'verified', 'pending', 'needs_review', 'rejected', 'suspended']

export default function AdminCompaniesPage() {
  const staff = useStaff()
  const canManage = staff.permissions.has('companies.manage')
  const canManageTrustedPartner = staff.permissions.has('companies.manage_trusted_partner')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [companies, setCompanies] = useState<Company[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const load = async () => {
    setError(false)
    setLoading(true)
    let q = supabase.from('companies').select('id, name, category, status, is_premium, premium_until, trusted_partner, followers_count, created_at').order('created_at', { ascending: false })
    if (statusFilter !== 'all') q = q.eq('status', statusFilter)
    const term = search.trim().replace(/[%,()*\\]/g, ' ').trim()
    if (term) q = q.ilike('name', `%${term}%`)
    const { data, error } = await q.limit(200)
    if (error) {
      setError(true)
      setLoading(false)
      return
    }
    setCompanies((data || []) as any)
    setLoading(false)
  }

  useEffect(() => { load() }, [statusFilter])
  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [search])

  const setStatus = async (c: Company, status: string) => {
    const { error } = await supabase.from('companies').update({ status }).eq('id', c.id)
    if (!error) {
      await logAdminAction(status === 'suspended' ? 'Suspended company' : 'Restored company', { type: 'company', id: c.id, label: c.name })
      load()
    }
  }

  const toggleTrustedPartner = async (c: Company) => {
    const { error } = await supabase.from('companies').update({ trusted_partner: !c.trusted_partner }).eq('id', c.id)
    if (!error) {
      await logAdminAction(c.trusted_partner ? 'Removed Trusted Partner status' : 'Granted Trusted Partner status', { type: 'company', id: c.id, label: c.name })
      load()
    }
  }

  return (
    <AdminLayout title="Companies">
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search companies..."
          style={{ padding: '9px 12px', borderRadius: '8px', border: `1px solid ${A.border}`, fontSize: '13px', minWidth: '220px' }}
        />
        {STATUS_FILTERS.map((s) => (
          <div
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: '7px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize',
              background: statusFilter === s ? A.green : A.surface,
              color: statusFilter === s ? 'white' : A.textMuted,
              border: `1px solid ${statusFilter === s ? A.green : A.border}`,
            }}>
            {s.replace('_', ' ')}
          </div>
        ))}
      </div>

      <div style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: '10px', overflow: 'hidden' }}>
        {loading ? (
          <p style={{ padding: '20px', fontSize: '13px', color: A.textMuted }}>Loading companies...</p>
        ) : error ? (
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: A.textMuted, marginBottom: '10px' }}>Could not load companies.</p>
            <span onClick={load} style={{ fontSize: '13px', fontWeight: 700, color: A.green, cursor: 'pointer' }}>Try again</span>
          </div>
        ) : companies.length === 0 ? (
          <p style={{ padding: '20px', fontSize: '13px', color: A.textMuted }}>No companies match this filter.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: A.bg, textAlign: 'left' }}>
                {['Company', 'Category', 'Status', 'Premium', 'Trusted Partner', 'Followers', ''].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: A.textMuted, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => {
                const s = STATUS_STYLE[c.status] || STATUS_STYLE.pending
                return (
                  <tr key={c.id} style={{ borderTop: `1px solid ${A.border}` }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: A.text }}>{c.name}</td>
                    <td style={{ padding: '10px 16px', color: A.textMuted }}>{c.category}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ background: s.bg, color: s.color, fontSize: '11px', fontWeight: 700, padding: '3px 9px', borderRadius: '999px', textTransform: 'capitalize' }}>{c.status.replace('_', ' ')}</span>
                    </td>
                    <td style={{ padding: '10px 16px', color: c.is_premium ? A.blue : A.textMuted, fontWeight: c.is_premium ? 700 : 400 }}>
                      {c.is_premium ? (c.premium_until ? `Active · ${new Date(c.premium_until).toLocaleDateString()}` : 'Active') : '—'}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      {canManageTrustedPartner ? (
                        <span onClick={() => toggleTrustedPartner(c)} style={{ cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: c.trusted_partner ? A.amber : A.textMuted }}>
                          {c.trusted_partner ? '⭐ Remove' : '+ Grant'}
                        </span>
                      ) : (
                        c.trusted_partner ? <span style={{ color: A.amber }}>⭐</span> : '—'
                      )}
                    </td>
                    <td style={{ padding: '10px 16px', color: A.textMuted }}>{c.followers_count}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                      {canManage && (c.status === 'verified' || c.status === 'suspended') && (
                        c.status === 'verified' ? (
                          <span onClick={() => setStatus(c, 'suspended')} style={{ fontSize: '12px', fontWeight: 700, color: A.red, cursor: 'pointer' }}>Suspend</span>
                        ) : (
                          <span onClick={() => setStatus(c, 'verified')} style={{ fontSize: '12px', fontWeight: 700, color: A.green, cursor: 'pointer' }}>Restore</span>
                        )
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  )
}
