import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import AdminLayout from '../AdminLayout'

const A = { surface: '#FFFFFF', border: '#E3E7E3', green: '#16A34A', text: '#0F1A0F', textMuted: '#6B7280', bg: '#F7F8F7' }

type Permission = { id: string; key: string; category: string; description: string }
type Role = { id: string; name: string; description: string | null; is_system: boolean }

// View-only for now: creating custom roles and editing permission grids is a
// later increment (Mataki 2) - this page shows exactly what each role can do today.
export default function RolesPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [grants, setGrants] = useState<Record<string, Set<string>>>({})
  const [openRoleId, setOpenRoleId] = useState('')

  const load = async () => {
    setError(false)
    setLoading(true)
    const [rolesRes, permsRes, rpRes] = await Promise.all([
      supabase.from('roles').select('id, name, description, is_system').order('name'),
      supabase.from('permissions').select('id, key, category, description').order('category'),
      supabase.from('role_permissions').select('role_id, permissions(key)'),
    ])
    if (rolesRes.error || permsRes.error || rpRes.error) {
      setError(true)
      setLoading(false)
      return
    }
    const map: Record<string, Set<string>> = {}
    for (const row of rpRes.data || []) {
      const key = (row as any).permissions?.key
      if (!key) continue
      if (!map[row.role_id]) map[row.role_id] = new Set()
      map[row.role_id].add(key)
    }
    setRoles((rolesRes.data || []) as any)
    setPermissions((permsRes.data || []) as any)
    setGrants(map)
    setOpenRoleId((rolesRes.data || [])[0]?.id || '')
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const categories = Array.from(new Set(permissions.map((p) => p.category)))

  return (
    <AdminLayout title="Roles & Permissions">
      {loading ? (
        <p style={{ fontSize: '13px', color: A.textMuted }}>Loading roles...</p>
      ) : error ? (
        <div style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: '10px', padding: '20px', textAlign: 'center' }}>
          <p style={{ fontSize: '13px', color: A.textMuted, marginBottom: '10px' }}>Could not load roles.</p>
          <span onClick={load} style={{ fontSize: '13px', fontWeight: 700, color: A.green, cursor: 'pointer' }}>Try again</span>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: '10px', width: '260px', flexShrink: 0, overflow: 'hidden' }}>
            {roles.map((r) => (
              <div
                key={r.id}
                onClick={() => setOpenRoleId(r.id)}
                style={{
                  padding: '12px 16px', borderBottom: `1px solid ${A.border}`, cursor: 'pointer',
                  background: openRoleId === r.id ? A.bg : 'transparent',
                }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: A.text }}>{r.name}</p>
                <p style={{ fontSize: '11px', color: A.textMuted, marginTop: '2px' }}>{(grants[r.id]?.size || 0)} permissions</p>
              </div>
            ))}
          </div>

          <div style={{ flex: 1, minWidth: '320px', background: A.surface, border: `1px solid ${A.border}`, borderRadius: '10px', padding: '18px' }}>
            {(() => {
              const role = roles.find((r) => r.id === openRoleId)
              if (!role) return null
              const roleGrants = grants[role.id] || new Set()
              return (
                <>
                  <p style={{ fontSize: '15px', fontWeight: 800, color: A.text }}>{role.name}</p>
                  {role.description && <p style={{ fontSize: '12.5px', color: A.textMuted, marginTop: '4px' }}>{role.description}</p>}

                  {categories.map((cat) => (
                    <div key={cat} style={{ marginTop: '18px' }}>
                      <p style={{ fontSize: '11px', fontWeight: 700, color: A.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '8px' }}>{cat}</p>
                      {permissions.filter((p) => p.category === cat).map((p) => {
                        const granted = roleGrants.has(p.key)
                        return (
                          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', fontSize: '12.5px', color: granted ? A.text : A.textMuted }}>
                            <span style={{ color: granted ? A.green : '#D1D5DB', fontWeight: 700 }}>{granted ? '✓' : '—'}</span>
                            {p.description}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </>
              )
            })()}
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
