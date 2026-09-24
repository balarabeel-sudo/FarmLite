import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import AdminLayout from '../AdminLayout'
import { useStaff } from '../AdminStaffContext'
import { logAdminAction } from '../adminAuth'

const A = { surface: '#FFFFFF', border: '#E3E7E3', green: '#16A34A', text: '#0F1A0F', textMuted: '#6B7280', red: '#DC2626', bg: '#F7F8F7' }

type Role = { id: string; name: string }
type StaffRow = { id: string; email: string; full_name: string; status: string; role_id: string; roles: { name: string } | null; created_at: string }

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: '#DCFCE7', text: '#166534' },
  invited: { bg: '#FEF3C7', text: '#92400E' },
  disabled: { bg: '#FEE2E2', text: '#991B1B' },
}

export default function StaffPage() {
  const me = useStaff()
  const canManage = me.permissions.has('staff.manage')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [roles, setRoles] = useState<Role[]>([])

  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRoleId, setInviteRoleId] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setError(false)
    setLoading(true)
    const [staffRes, rolesRes] = await Promise.all([
      supabase.from('staff').select('id, email, full_name, status, role_id, created_at, roles(name)').order('created_at', { ascending: false }),
      supabase.from('roles').select('id, name').order('name'),
    ])
    if (staffRes.error || rolesRes.error) {
      setError(true)
      setLoading(false)
      return
    }
    setStaff((staffRes.data || []) as any)
    setRoles((rolesRes.data || []) as any)
    if (!inviteRoleId && rolesRes.data?.[0]) setInviteRoleId(rolesRes.data[0].id)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const sendInvite = async () => {
    setInviteError('')
    if (!inviteEmail.trim() || !/^\S+@\S+\.\S+$/.test(inviteEmail.trim())) return setInviteError('Enter a valid email address.')
    if (!inviteName.trim()) return setInviteError('Enter the staff member\'s full name.')
    if (!inviteRoleId) return setInviteError('Choose a role.')

    setSaving(true)
    const { error } = await supabase.from('staff').insert({
      email: inviteEmail.trim().toLowerCase(),
      full_name: inviteName.trim(),
      role_id: inviteRoleId,
      status: 'invited',
    })
    setSaving(false)

    if (error) return setInviteError(error.message.includes('duplicate') ? 'This email is already staff.' : 'Could not send the invite. Try again.')

    await logAdminAction('Invited staff member', { type: 'staff', id: '', label: inviteEmail.trim() })
    setShowInvite(false)
    setInviteEmail('')
    setInviteName('')
    load()
  }

  const setStatus = async (row: StaffRow, status: 'active' | 'disabled') => {
    const { error } = await supabase.from('staff').update({ status }).eq('id', row.id)
    if (!error) {
      await logAdminAction(status === 'disabled' ? 'Disabled staff access' : 'Reactivated staff', { type: 'staff', id: row.id, label: row.email })
      load()
    }
  }

  const changeRole = async (row: StaffRow, roleId: string) => {
    const { error } = await supabase.from('staff').update({ role_id: roleId }).eq('id', row.id)
    if (!error) {
      await logAdminAction('Changed staff role', { type: 'staff', id: row.id, label: row.email })
      load()
    }
  }

  return (
    <AdminLayout title="Staff">
      {canManage && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
          <div onClick={() => setShowInvite((v) => !v)} style={{ background: A.green, color: 'white', padding: '9px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
            {showInvite ? 'Cancel' : '+ Add Staff'}
          </div>
        </div>
      )}

      {showInvite && (
        <div style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: '10px', padding: '18px', marginBottom: '20px', maxWidth: '420px' }}>
          <p style={{ fontSize: '14px', fontWeight: 700, color: A.text, marginBottom: '12px' }}>Add Staff</p>
          {inviteError && <p style={{ fontSize: '12.5px', color: A.red, marginBottom: '10px' }}>{inviteError}</p>}
          <Input label="Email" value={inviteEmail} onChange={setInviteEmail} placeholder="name@example.com" />
          <Input label="Full name" value={inviteName} onChange={setInviteName} placeholder="Full name" />
          <p style={{ fontSize: '12px', fontWeight: 600, color: A.text, marginBottom: '6px' }}>Role</p>
          <select value={inviteRoleId} onChange={(e) => setInviteRoleId(e.target.value)} style={inputStyle}>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <p style={{ fontSize: '11.5px', color: A.textMuted, margin: '10px 0 14px' }}>
            The staff member gets access once they sign up or log in to FarmLite with this exact email address.
          </p>
          <div onClick={saving ? undefined : sendInvite} style={{ background: A.green, color: 'white', textAlign: 'center', padding: '9px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Sending...' : 'Send Invitation'}
          </div>
        </div>
      )}

      <div style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: '10px', overflow: 'hidden' }}>
        {loading ? (
          <p style={{ padding: '20px', fontSize: '13px', color: A.textMuted }}>Loading staff...</p>
        ) : error ? (
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: A.textMuted, marginBottom: '10px' }}>Could not load staff.</p>
            <span onClick={load} style={{ fontSize: '13px', fontWeight: 700, color: A.green, cursor: 'pointer' }}>Try again</span>
          </div>
        ) : staff.length === 0 ? (
          <p style={{ padding: '20px', fontSize: '13px', color: A.textMuted }}>No staff members yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: A.bg, textAlign: 'left' }}>
                {['Name', 'Email', 'Role', 'Status', ''].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: A.textMuted, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map((row) => {
                const sc = STATUS_COLORS[row.status] || STATUS_COLORS.invited
                const isSelf = row.email === me.email
                return (
                  <tr key={row.id} style={{ borderTop: `1px solid ${A.border}` }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: A.text }}>{row.full_name}{isSelf ? ' (you)' : ''}</td>
                    <td style={{ padding: '10px 16px', color: A.textMuted }}>{row.email}</td>
                    <td style={{ padding: '10px 16px' }}>
                      {canManage && !isSelf ? (
                        <select value={row.role_id} onChange={(e) => changeRole(row, e.target.value)} style={{ fontSize: '12.5px', padding: '4px 6px', borderRadius: '6px', border: `1px solid ${A.border}` }}>
                          {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                      ) : (
                        row.roles?.name || '—'
                      )}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ background: sc.bg, color: sc.text, fontSize: '11px', fontWeight: 700, padding: '3px 9px', borderRadius: '999px' }}>{row.status}</span>
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                      {canManage && !isSelf && row.status !== 'invited' && (
                        row.status === 'active' ? (
                          <span onClick={() => setStatus(row, 'disabled')} style={{ fontSize: '12px', fontWeight: 700, color: A.red, cursor: 'pointer' }}>Disable</span>
                        ) : (
                          <span onClick={() => setStatus(row, 'active')} style={{ fontSize: '12px', fontWeight: 700, color: A.green, cursor: 'pointer' }}>Reactivate</span>
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

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <p style={{ fontSize: '12px', fontWeight: 600, color: A.text, marginBottom: '6px' }}>{label}</p>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 11px', borderRadius: '8px', border: `1px solid ${A.border}`,
  fontSize: '13px', boxSizing: 'border-box', marginBottom: '12px',
}
