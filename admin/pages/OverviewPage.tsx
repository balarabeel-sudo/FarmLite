import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import AdminLayout from '../AdminLayout'
import { useStaff } from '../AdminStaffContext'

const A = { surface: '#FFFFFF', border: '#E3E7E3', green: '#16A34A', text: '#0F1A0F', textMuted: '#6B7280', amber: '#B45309', amberBg: '#FEF3C7' }

type Counts = {
  users: number
  companies: number
  listings: number
  posts: number
  groups: number
  equipment: number
  pendingCompanies: number
}

export default function OverviewPage() {
  const navigate = useNavigate()
  const staff = useStaff()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [counts, setCounts] = useState<Counts | null>(null)

  const load = async () => {
    setError(false)
    setLoading(true)
    const head = { count: 'exact' as const, head: true }
    const results = await Promise.all([
      supabase.from('profiles').select('user_id', head),
      supabase.from('companies').select('id', head),
      supabase.from('marketplace_listings').select('id', head),
      supabase.from('posts').select('id', head),
      supabase.from('communities').select('id', head),
      supabase.from('equipment').select('id', head),
      supabase.from('companies').select('id', head).eq('status', 'pending'),
    ])
    if (results.some((r) => r.error)) {
      setError(true)
      setLoading(false)
      return
    }
    const [users, companies, listings, posts, groups, equipment, pendingCompanies] = results.map((r) => r.count || 0)
    setCounts({ users, companies, listings, posts, groups, equipment, pendingCompanies })
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <AdminLayout title="Overview">
      {loading ? (
        <p style={{ fontSize: '13px', color: A.textMuted }}>Loading platform statistics...</p>
      ) : error ? (
        <div style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: '10px', padding: '20px', textAlign: 'center' }}>
          <p style={{ fontSize: '13px', color: A.textMuted, marginBottom: '10px' }}>Could not load statistics.</p>
          <span onClick={load} style={{ fontSize: '13px', fontWeight: 700, color: A.green, cursor: 'pointer' }}>Try again</span>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '14px', marginBottom: '24px' }}>
            <Kpi label="Users" value={counts!.users} onClick={() => navigate('/admin/users')} />
            <Kpi label="Companies" value={counts!.companies} onClick={() => navigate('/admin/companies')} />
            <Kpi label="Marketplace Listings" value={counts!.listings} onClick={() => navigate('/admin/marketplace')} />
            <Kpi label="Community Posts" value={counts!.posts} onClick={() => navigate('/admin/community')} />
            <Kpi label="Groups" value={counts!.groups} onClick={() => navigate('/admin/groups')} />
            <Kpi label="Equipment Listings" value={counts!.equipment} onClick={() => navigate('/admin/equipment')} />
          </div>

          <p style={{ fontSize: '13px', fontWeight: 700, color: A.text, marginBottom: '10px' }}>Needs attention</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {counts!.pendingCompanies > 0 ? (
              <div
                onClick={() => navigate('/admin/verification')}
                style={{ background: A.amberBg, border: '1px solid #FDE68A', borderRadius: '10px', padding: '14px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13.5px', fontWeight: 600, color: A.amber }}>Pending company verifications</span>
                <span style={{ fontSize: '15px', fontWeight: 800, color: A.amber }}>{counts!.pendingCompanies}</span>
              </div>
            ) : (
              <div style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: '10px', padding: '14px 16px', fontSize: '13px', color: A.textMuted }}>
                No pending company verifications.
              </div>
            )}
          </div>

          <p style={{ fontSize: '11.5px', color: A.textMuted, marginTop: '24px' }}>
            Signed in as {staff.fullName} · {staff.roleName}
          </p>
        </>
      )}
    </AdminLayout>
  )
}

function Kpi({ label, value, onClick }: { label: string; value: number; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: '10px', padding: '16px', cursor: 'pointer' }}>
      <p style={{ fontSize: '22px', fontWeight: 800, color: A.text }}>{value.toLocaleString()}</p>
      <p style={{ fontSize: '12px', color: A.textMuted, marginTop: '4px' }}>{label}</p>
    </div>
  )
}
