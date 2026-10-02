import { Fragment, useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import AdminLayout from '../AdminLayout'

const A = { surface: '#FFFFFF', border: '#E3E7E3', bg: '#F7F8F7', green: '#16A34A', text: '#0F1A0F', textMuted: '#6B7280', red: '#B91C1C' }
const PAGE = 50

type Log = {
  id: string
  actor_name: string | null
  action: string
  target_type: string | null
  target_id: string | null
  target_label: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

// "wallet.dispute_release" -> "Wallet: dispute release"
function actionLabel(action: string) {
  const [area, ...rest] = action.split('.')
  const tail = rest.join('.').replace(/_/g, ' ')
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  return rest.length ? `${cap(area.replace(/_/g, ' '))}: ${tail}` : cap(action.replace(/_/g, ' '))
}

// Colour the chip by how sensitive the action is, so risky actions stand out when scanning
function actionTone(action: string) {
  if (/(reject|refund|suspend|remove|delete|disable|revoke|fail)/.test(action)) return { color: '#B91C1C', bg: '#FEE2E2' }
  if (/(release|approve|verif|grant|restore|paid)/.test(action)) return { color: '#166534', bg: '#DCFCE7' }
  return { color: '#374151', bg: '#F3F4F6' }
}

function startOfDay(d: string) { return new Date(`${d}T00:00:00`).toISOString() }
function endOfDay(d: string) { return new Date(`${d}T23:59:59.999`).toISOString() }

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [search, setSearch] = useState('')
  const [applied, setApplied] = useState({ q: '', from: '', to: '' })
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [open, setOpen] = useState<string | null>(null)

  const fetchPage = async (offset: number, f: typeof applied) => {
    let query = supabase
      .from('audit_logs')
      .select('id, actor_name, action, target_type, target_id, target_label, metadata, created_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE - 1)

    // characters that would break the PostgREST filter syntax are dropped from the search text
    const q = f.q.replace(/[,()%*]/g, ' ').trim()
    if (q) query = query.or(`action.ilike.%${q}%,actor_name.ilike.%${q}%,target_label.ilike.%${q}%,target_type.ilike.%${q}%`)
    if (f.from) query = query.gte('created_at', startOfDay(f.from))
    if (f.to) query = query.lte('created_at', endOfDay(f.to))
    return query
  }

  const load = async (f = applied) => {
    setError(false)
    setLoading(true)
    const { data, error: e } = await fetchPage(0, f)
    if (e) { setError(true); setLoading(false); return }
    setLogs((data || []) as Log[])
    setHasMore((data || []).length === PAGE)
    setLoading(false)
  }

  const loadMore = async () => {
    setLoadingMore(true)
    const { data, error: e } = await fetchPage(logs.length, applied)
    if (!e) {
      setLogs((prev) => [...prev, ...((data || []) as Log[])])
      setHasMore((data || []).length === PAGE)
    }
    setLoadingMore(false)
  }

  useEffect(() => { load() }, [])

  const apply = () => {
    const next = { q: search, from, to }
    setApplied(next)
    setOpen(null)
    load(next)
  }

  const clear = () => {
    setSearch(''); setFrom(''); setTo('')
    const next = { q: '', from: '', to: '' }
    setApplied(next)
    setOpen(null)
    load(next)
  }

  const filtered = !!(applied.q || applied.from || applied.to)
  const inputStyle = { padding: '8px 12px', borderRadius: '8px', border: `1px solid ${A.border}`, fontSize: '12.5px', background: A.surface }

  return (
    <AdminLayout title="Audit Logs">
      <p style={{ fontSize: '12.5px', color: A.textMuted, marginBottom: '14px', lineHeight: 1.5 }}>
        A permanent record of sensitive staff actions. Entries cannot be edited or deleted from the dashboard.
      </p>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
        <input
          value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') apply() }}
          placeholder="Search action, staff name or target" style={{ ...inputStyle, flex: '1 1 240px', minWidth: '200px' }}
        />
        <label style={{ fontSize: '12px', color: A.textMuted, display: 'flex', alignItems: 'center', gap: '6px' }}>
          From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ fontSize: '12px', color: A.textMuted, display: 'flex', alignItems: 'center', gap: '6px' }}>
          To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle} />
        </label>
        <button onClick={apply} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: A.green, color: 'white', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}>Apply</button>
        {filtered && (
          <span onClick={clear} style={{ fontSize: '12.5px', fontWeight: 700, color: A.textMuted, cursor: 'pointer' }}>Clear</span>
        )}
      </div>

      {error ? (
        <div style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: '10px', padding: '20px', textAlign: 'center' }}>
          <p style={{ fontSize: '13px', color: A.textMuted, marginBottom: '10px' }}>Could not load the audit log. You may not have permission to view it.</p>
          <span onClick={() => load()} style={{ fontSize: '13px', fontWeight: 700, color: A.green, cursor: 'pointer' }}>Try again</span>
        </div>
      ) : (
        <div style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: '10px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', minWidth: '760px' }}>
            <thead>
              <tr style={{ background: A.bg, textAlign: 'left' }}>
                {['When', 'Staff', 'Action', 'Target'].map((h) => (
                  <th key={h} style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: A.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: `1px solid ${A.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} style={{ padding: '18px 14px', color: A.textMuted }}>Loading...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: '18px 14px', color: A.textMuted }}>{filtered ? 'No entries match your search.' : 'No entries yet.'}</td></tr>
              ) : (
                logs.map((l) => {
                  const tone = actionTone(l.action)
                  const isOpen = open === l.id
                  const meta = l.metadata && Object.keys(l.metadata).length > 0 ? l.metadata : null
                  return (
                    <Fragment key={l.id}>
                      <tr onClick={() => setOpen(isOpen ? null : l.id)} style={{ cursor: 'pointer', borderBottom: isOpen ? 'none' : `1px solid ${A.border}`, background: isOpen ? A.bg : 'transparent' }}>
                        <td style={{ padding: '11px 14px', color: A.textMuted, whiteSpace: 'nowrap' }}>{new Date(l.created_at).toLocaleString()}</td>
                        <td style={{ padding: '11px 14px', color: A.text, fontWeight: 600 }}>{l.actor_name || 'System'}</td>
                        <td style={{ padding: '11px 14px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 9px', borderRadius: '999px', background: tone.bg, color: tone.color, whiteSpace: 'nowrap' }}>{actionLabel(l.action)}</span>
                        </td>
                        <td style={{ padding: '11px 14px', color: A.text }}>
                          {l.target_label || l.target_id || '-'}
                          {l.target_type && <span style={{ color: A.textMuted }}> · {l.target_type}</span>}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr style={{ borderBottom: `1px solid ${A.border}`, background: A.bg }}>
                          <td colSpan={4} style={{ padding: '4px 14px 14px' }}>
                            <p style={{ fontSize: '11.5px', color: A.textMuted, marginBottom: '6px' }}>Action ID: {l.id}</p>
                            {meta ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {Object.entries(meta).map(([k, v]) => (
                                  <p key={k} style={{ fontSize: '12.5px', color: A.text }}>
                                    <span style={{ color: A.textMuted }}>{k.replace(/_/g, ' ')}: </span>
                                    {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                  </p>
                                ))}
                              </div>
                            ) : (
                              <p style={{ fontSize: '12.5px', color: A.textMuted }}>No extra details.</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && hasMore && (
        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <button onClick={loadMore} disabled={loadingMore} style={{ padding: '9px 22px', borderRadius: '8px', border: `1px solid ${A.green}`, background: A.surface, color: A.green, fontSize: '12.5px', fontWeight: 700, cursor: loadingMore ? 'default' : 'pointer', opacity: loadingMore ? 0.6 : 1 }}>
            {loadingMore ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </AdminLayout>
  )
}
