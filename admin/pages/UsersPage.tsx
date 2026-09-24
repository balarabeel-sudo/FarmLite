import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import AdminLayout from '../AdminLayout'
import { useStaff } from '../AdminStaffContext'
import { logAdminAction } from '../adminAuth'

const A = { surface: '#FFFFFF', border: '#E3E7E3', green: '#16A34A', text: '#0F1A0F', textMuted: '#6B7280', bg: '#F7F8F7', red: '#DC2626', blue: '#2563EB', amber: '#B45309' }

type User = {
  user_id: string
  full_name: string | null
  username: string | null
  role: string
  is_verified: boolean
  is_premium: boolean
  premium_until: string | null
  account_status: string
  farmlite_id: string | null
  created_at: string
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  active: { bg: '#DCFCE7', color: '#166534' },
  restricted: { bg: '#FEF3C7', color: '#92400E' },
  suspended: { bg: '#FEE2E2', color: '#991B1B' },
}

const STATUS_FILTERS = ['all', 'active', 'restricted', 'suspended']

const PREMIUM_DURATIONS = [
  { label: '1 month', days: 30 },
  { label: '3 months', days: 90 },
  { label: '1 year', days: 365 },
  { label: 'Lifetime', days: null as number | null },
]

export default function UsersPage() {
  const staff = useStaff()
  const canManage = staff.permissions.has('users.manage')
  const canManagePremium = staff.permissions.has('users.manage_premium')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [premiumMenuFor, setPremiumMenuFor] = useState('')

  const load = async () => {
    setError(false)
    setLoading(true)
    let q = supabase.from('profiles').select('user_id, full_name, username, role, is_verified, is_premium, premium_until, account_status, farmlite_id, created_at').order('created_at', { ascending: false })
    if (statusFilter !== 'all') q = q.eq('account_status', statusFilter)
    const term = search.trim().replace(/[%,()*\\]/g, ' ').trim()
    if (term) q = q.or(`full_name.ilike.%${term}%,username.ilike.%${term}%`)
    const { data, error } = await q.limit(200)
    if (error) {
      setError(true)
      setLoading(false)
      return
    }
    setUsers((data || []) as any)
    setLoading(false)
  }

  useEffect(() => { load() }, [statusFilter])
  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [search])

  const setAccountStatus = async (u: User, status: string) => {
    if (!window.confirm(`${status === 'active' ? 'Restore' : status === 'suspended' ? 'Suspend' : 'Restrict'} ${u.full_name || u.username}?`)) return
    const { error } = await supabase.from('profiles').update({ account_status: status }).eq('user_id', u.user_id)
    if (!error) {
      await logAdminAction(`Set user account status to ${status}`, { type: 'user', id: u.user_id, label: u.full_name || u.username || u.user_id })
      load()
    }
  }

  const grantPremium = async (u: User, days: number | null) => {
    const until = days ? new Date(Date.now() + days * 86400000).toISOString() : null
    const { error } = await supabase.from('profiles').update({ is_premium: true, premium_until: until }).eq('user_id', u.user_id)
    if (!error) {
      await logAdminAction('Granted user Premium', { type: 'user', id: u.user_id, label: u.full_name || u.username || u.user_id }, { until })
      setPremiumMenuFor('')
      load()
    }
  }

  const removePremium = async (u: User) => {
    const { error } = await supabase.from('profiles').update({ is_premium: false, premium_until: null }).eq('user_id', u.user_id)
    if (!error) {
      await logAdminAction('Removed user Premium', { type: 'user', id: u.user_id, label: u.full_name || u.username || u.user_id })
      load()
    }
  }

  return (
    <AdminLayout title="Users">
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or username..."
          style={{ padding: '9px 12px', borderRadius: '8px', border: `1px solid ${A.border}`, fontSize: '13px', minWidth: '240px' }}
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
            {s}
          </div>
        ))}
      </div>

      <div style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: '10px', overflow: 'visible' }}>
        {loading ? (
          <p style={{ padding: '20px', fontSize: '13px', color: A.textMuted }}>Loading users...</p>
        ) : error ? (
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: A.textMuted, marginBottom: '10px' }}>Could not load users.</p>
            <span onClick={load} style={{ fontSize: '13px', fontWeight: 700, color: A.green, cursor: 'pointer' }}>Try again</span>
          </div>
        ) : users.length === 0 ? (
          <p style={{ padding: '20px', fontSize: '13px', color: A.textMuted }}>No users match this filter.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: A.bg, textAlign: 'left' }}>
                {['User', 'FarmLite ID', 'Role', 'Status', 'Premium', ''].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: A.textMuted, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const s = STATUS_STYLE[u.account_status] || STATUS_STYLE.active
                return (
                  <tr key={u.user_id} style={{ borderTop: `1px solid ${A.border}` }}>
                    <td style={{ padding: '10px 16px' }}>
                      <p style={{ fontWeight: 600, color: A.text }}>{u.full_name || u.username || 'FarmLite user'}{u.is_verified ? ' ✓' : ''}</p>
                      {u.username && <p style={{ fontSize: '11px', color: A.textMuted }}>@{u.username}</p>}
                    </td>
                    <td style={{ padding: '10px 16px', color: A.textMuted, fontSize: '11.5px' }}>{u.farmlite_id || '—'}</td>
                    <td style={{ padding: '10px 16px', color: A.textMuted, textTransform: 'capitalize' }}>{u.role}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ background: s.bg, color: s.color, fontSize: '11px', fontWeight: 700, padding: '3px 9px', borderRadius: '999px', textTransform: 'capitalize' }}>{u.account_status}</span>
                    </td>
                    <td style={{ padding: '10px 16px', position: 'relative' }}>
                      <span style={{ color: u.is_premium ? A.blue : A.textMuted, fontWeight: u.is_premium ? 700 : 400, fontSize: '12px' }}>
                        {u.is_premium ? (u.premium_until ? `Active · ${new Date(u.premium_until).toLocaleDateString()}` : 'Active') : '—'}
                      </span>
                      {canManagePremium && (
                        <>
                          <span
                            onClick={() => setPremiumMenuFor(premiumMenuFor === u.user_id ? '' : u.user_id)}
                            style={{ marginLeft: '10px', fontSize: '11.5px', fontWeight: 700, color: A.amber, cursor: 'pointer' }}>
                            {u.is_premium ? 'Manage' : '+ Grant'}
                          </span>
                          {premiumMenuFor === u.user_id && (
                            <div style={{ position: 'absolute', top: '100%', left: '16px', zIndex: 5, background: A.surface, border: `1px solid ${A.border}`, borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: '8px', minWidth: '140px' }}>
                              {PREMIUM_DURATIONS.map((d) => (
                                <div key={d.label} onClick={() => grantPremium(u, d.days)} style={{ padding: '6px 8px', fontSize: '12px', color: A.text, cursor: 'pointer', borderRadius: '5px' }}>
                                  {d.label}
                                </div>
                              ))}
                              {u.is_premium && (
                                <div onClick={() => removePremium(u)} style={{ padding: '6px 8px', fontSize: '12px', color: A.red, cursor: 'pointer', borderTop: `1px solid ${A.border}`, marginTop: '4px' }}>
                                  Remove Premium
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {canManage && (
                        <>
                          {u.account_status !== 'active' && (
                            <span onClick={() => setAccountStatus(u, 'active')} style={{ fontSize: '12px', fontWeight: 700, color: A.green, cursor: 'pointer', marginRight: '10px' }}>Restore</span>
                          )}
                          {u.account_status !== 'restricted' && (
                            <span onClick={() => setAccountStatus(u, 'restricted')} style={{ fontSize: '12px', fontWeight: 700, color: A.amber, cursor: 'pointer', marginRight: '10px' }}>Restrict</span>
                          )}
                          {u.account_status !== 'suspended' && (
                            <span onClick={() => setAccountStatus(u, 'suspended')} style={{ fontSize: '12px', fontWeight: 700, color: A.red, cursor: 'pointer' }}>Suspend</span>
                          )}
                        </>
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
