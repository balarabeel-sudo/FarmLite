import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import AdminLayout from '../AdminLayout'
import { useStaff } from '../AdminStaffContext'
import { logAdminAction } from '../adminAuth'

const A = { surface: '#FFFFFF', border: '#E3E7E3', green: '#16A34A', text: '#0F1A0F', textMuted: '#6B7280', bg: '#F7F8F7', red: '#DC2626', amber: '#B45309' }

type Group = { fingerprint: string; kind: string; message: string; stack: string | null; total: number; users: number; last_seen: string; first_seen: string; last_24h: number; route: string | null; user_agent: string | null }
type Summary = { last_hour: number; last_24h: number; users_24h: number; by_hour: { h: string; n: number }[]; groups: Group[] }

const KIND: Record<string, string> = { js_error: 'Script error', promise: 'Failed action', react: 'Screen crash' }

const ago = (iso: string) => {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return `${Math.floor(s / 86400)} d ago`
}

// Route: /admin/health  (needs the system.view_health permission)
// Errors the app reports from real devices, grouped so one bug shows as one line.
export default function HealthPage() {
  const staff = useStaff()
  const allowed = staff.permissions.has('system.view_health')
  const [data, setData] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState('')
  const [busy, setBusy] = useState('')

  const load = async () => {
    setFailed(false)
    const { data: d, error } = await supabase.rpc('admin_health_summary')
    if (error) setFailed(true)
    else setData(d as Summary)
    setLoading(false)
  }

  useEffect(() => {
    if (!allowed) return
    load()
    const t = window.setInterval(load, 60000)
    return () => window.clearInterval(t)
  }, [allowed])

  const resolve = async (g: Group) => {
    setBusy(g.fingerprint)
    const { error } = await supabase.rpc('admin_error_resolve', { p_fingerprint: g.fingerprint })
    setBusy('')
    if (error) return
    await logAdminAction('Marked an app error as fixed', { type: 'app_error', id: g.fingerprint, label: g.message.slice(0, 80) })
    load()
  }

  const max = Math.max(1, ...(data?.by_hour || []).map((x) => x.n))
  const status = !data ? 'unknown' : data.last_hour >= 10 ? 'bad' : data.last_hour > 0 ? 'warn' : 'ok'
  const statusText = { ok: 'No errors in the last hour', warn: 'A few errors in the last hour', bad: 'Many errors in the last hour', unknown: 'Loading...' }[status]
  const statusColor = { ok: A.green, warn: A.amber, bad: A.red, unknown: A.textMuted }[status]

  return (
    <AdminLayout title="Health Center">
      {!allowed && <p style={{ fontSize: '13px', color: A.textMuted }}>You do not have permission to see the Health Center.</p>}
      {allowed && (
        <>
          {failed && <p style={{ fontSize: '13px', color: A.red, marginBottom: '12px' }}>Could not load the data. It will retry in a minute.</p>}

          <div style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: '10px', padding: '18px 20px', marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ width: 12, height: 12, borderRadius: 12, background: statusColor, flexShrink: 0 }} />
            <p style={{ fontSize: '15px', fontWeight: 800, color: A.text }}>{statusText}</p>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {[
              ['Last hour', data?.last_hour],
              ['Last 24 hours', data?.last_24h],
              ['Signed-in users affected (24 h)', data?.users_24h],
            ].map(([label, n]) => (
              <div key={label as string} style={{ flex: '1 1 160px', background: A.surface, border: `1px solid ${A.border}`, borderRadius: '10px', padding: '14px 16px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, color: A.textMuted }}>{label}</p>
                <p style={{ fontSize: '24px', fontWeight: 800, color: A.text, marginTop: '4px' }}>{loading ? '...' : n ?? 0}</p>
              </div>
            ))}
          </div>

          <div style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: '10px', padding: '16px 20px', marginBottom: '16px' }}>
            <p style={{ fontSize: '13px', fontWeight: 800, color: A.text, marginBottom: '12px' }}>Errors per hour (last 24 hours)</p>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: 70 }}>
              {(data?.by_hour || []).map((x) => (
                <div key={x.h} title={`${new Date(x.h).getHours()}:00 · ${x.n}`} style={{ flex: 1, height: `${Math.max(x.n ? 8 : 2, (x.n / max) * 100)}%`, background: x.n ? A.red : A.border, borderRadius: '2px' }} />
              ))}
            </div>
          </div>

          <div style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: '10px', padding: '16px 20px' }}>
            <p style={{ fontSize: '14px', fontWeight: 800, color: A.text }}>Open problems (last 7 days)</p>
            <p style={{ fontSize: '12px', color: A.textMuted, margin: '3px 0 10px' }}>The same error from many people shows as one line. Mark it fixed after you deploy the fix; if it comes back it will reappear.</p>
            {!loading && (data?.groups.length ?? 0) === 0 && <p style={{ fontSize: '13px', color: A.textMuted }}>Nothing reported. All clear.</p>}
            {(data?.groups || []).map((g) => (
              <div key={g.fingerprint} style={{ borderTop: `1px solid ${A.border}`, padding: '12px 0' }}>
                <div onClick={() => setOpen(open === g.fingerprint ? '' : g.fingerprint)} style={{ cursor: 'pointer' }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: A.text, wordBreak: 'break-word' }}>{g.message}</p>
                  <p style={{ fontSize: '11.5px', color: A.textMuted, marginTop: '3px' }}>
                    {KIND[g.kind] || g.kind} · {g.total} times ({g.last_24h} in 24 h) · {g.users} signed-in user{g.users === 1 ? '' : 's'} · last {ago(g.last_seen)}{g.route ? ` · ${g.route}` : ''}
                  </p>
                </div>
                {open === g.fingerprint && (
                  <div style={{ marginTop: '8px' }}>
                    {g.user_agent && <p style={{ fontSize: '11px', color: A.textMuted, marginBottom: '6px', wordBreak: 'break-word' }}>{g.user_agent}</p>}
                    {g.stack && <pre style={{ fontSize: '11px', background: A.bg, padding: '10px', borderRadius: '8px', overflowX: 'auto', whiteSpace: 'pre-wrap', color: A.text }}>{g.stack}</pre>}
                    <span role="button" onClick={() => (busy ? undefined : resolve(g))} style={{ display: 'inline-block', marginTop: '8px', padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, background: busy === g.fingerprint ? '#C9E9D2' : A.green, color: '#fff', cursor: 'pointer' }}>
                      {busy === g.fingerprint ? 'Saving...' : 'Mark as fixed'}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </AdminLayout>
  )
}
