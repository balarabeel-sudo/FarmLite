import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import AdminLayout from '../AdminLayout'
import { useStaff } from '../AdminStaffContext'

const A = {
  bg: '#F7F8F7', surface: '#FFFFFF', border: '#E3E7E3', borderSoft: '#EEF1EE',
  green: '#16A34A', greenDark: '#14532D', greenTint: '#ECF7EF',
  text: '#0F1A0F', textMuted: '#6B7280', textSoft: '#9AA39B',
  amber: '#92400E', amberChip: '#FEF3C7', red: '#B91C1C', redBg: '#FEF2F2',
}

type Settings = {
  free_posting: boolean
  premium_max_seconds: number
  free_max_seconds: number
  premium_per_day: number
  free_per_day: number
  can_edit: boolean
}
type VideoItem = {
  id: string; user_id: string; caption: string | null; video_url: string; thumbnail_url: string | null
  duration_seconds: number; likes_count: number; views_count: number; comments_count: number; created_at: string
  is_hidden_by_admin: boolean; full_name: string | null; username: string | null; profile_image: string | null; author_premium: boolean
}
type ListResult = { total: number; active: number; hidden: number; views: number; rows: VideoItem[] }

const PAGE = 20
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`

const CSS = `
.vp-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
.vp-card{background:${A.surface};border:1px solid ${A.border};border-radius:12px;padding:14px 16px}
.vp-card p.l{font-size:12px;color:${A.textMuted};font-weight:600}
.vp-card p.v{font-size:22px;font-weight:800;color:${A.text};margin-top:4px}
.vp-panel{background:${A.surface};border:1px solid ${A.border};border-radius:12px;padding:18px;margin-bottom:16px}
.vp-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-top:14px}
.vp-field label{display:block;font-size:12px;font-weight:700;color:${A.text};margin-bottom:5px}
.vp-field input{width:100%;box-sizing:border-box;padding:9px 11px;border:1px solid ${A.border};border-radius:8px;font-size:13px;background:${A.bg}}
.vp-field small{display:block;font-size:11.5px;color:${A.textMuted};margin-top:4px}
.vp-btn{border:1px solid ${A.border};background:${A.surface};color:${A.text};border-radius:8px;padding:8px 14px;font-size:12.5px;font-weight:700;cursor:pointer}
.vp-btn.primary{background:${A.green};border-color:${A.green};color:#fff}
.vp-btn.danger{background:${A.red};border-color:${A.red};color:#fff}
.vp-btn:disabled{opacity:.55;cursor:default}
.vp-row{display:flex;gap:14px;align-items:center;padding:12px 0;border-top:1px solid ${A.borderSoft}}
.vp-row:first-child{border-top:0}
.vp-thumb{width:64px;height:92px;border-radius:8px;background:#000;object-fit:cover;flex-shrink:0;position:relative}
.vp-chip{display:inline-block;border-radius:999px;padding:3px 10px;font-size:11.5px;font-weight:700}
.vp-switch{width:44px;height:26px;border-radius:13px;position:relative;cursor:pointer;flex-shrink:0;transition:background .15s}
.vp-switch i{position:absolute;top:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:left .15s}
.vp-filters{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:6px}
.vp-filters input{flex:1;min-width:200px;padding:9px 12px;border:1px solid ${A.border};border-radius:8px;font-size:13px}
.vp-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:100;display:flex;align-items:center;justify-content:center;padding:16px}
.vp-modal{background:#fff;border-radius:14px;padding:20px;max-width:420px;width:100%}
@media (max-width:900px){.vp-cards{grid-template-columns:repeat(2,1fr)}.vp-grid{grid-template-columns:1fr}.vp-row{align-items:flex-start;flex-wrap:wrap}}
`

export default function VideosPage() {
  const staff = useStaff()
  const canModerate = staff.permissions.has('videos.moderate')

  const [settings, setSettings] = useState<Settings | null>(null)
  const [form, setForm] = useState({ free_posting: false, premium_max: '60', free_max: '20', premium_day: '5', free_day: '3' })
  const [settingsError, setSettingsError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [data, setData] = useState<ListResult | null>(null)
  const [rows, setRows] = useState<VideoItem[]>([])
  const [qInput, setQInput] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'all' | 'active' | 'hidden'>('all')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)

  const [confirm, setConfirm] = useState<{ video: VideoItem; action: 'hide' | 'restore' } | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')

  const loadSettings = useCallback(async () => {
    const { data: d, error: e } = await supabase.rpc('admin_video_settings_get')
    if (e || !d) { setSettingsError('Could not load the video settings.'); return }
    const s = d as Settings
    setSettings(s)
    setForm({
      free_posting: s.free_posting,
      premium_max: String(s.premium_max_seconds),
      free_max: String(s.free_max_seconds),
      premium_day: String(s.premium_per_day),
      free_day: String(s.free_per_day),
    })
    setSettingsError('')
  }, [])

  useEffect(() => { loadSettings() }, [loadSettings])

  useEffect(() => {
    const t = setTimeout(() => setQ(qInput.trim()), 350)
    return () => clearTimeout(t)
  }, [qInput])

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    supabase.rpc('admin_videos_list', { p_search: q || null, p_status: status, p_limit: PAGE, p_offset: 0 }).then(({ data: d, error: e }) => {
      if (!alive) return
      if (e || !d) { setError('Could not load videos.'); setLoading(false); return }
      const res = d as ListResult
      setData(res)
      setRows(res.rows)
      setLoading(false)
    })
    return () => { alive = false }
  }, [q, status, tick])

  const loadMore = async () => {
    setLoadingMore(true)
    const { data: d } = await supabase.rpc('admin_videos_list', { p_search: q || null, p_status: status, p_limit: PAGE, p_offset: rows.length })
    const res = d as ListResult | null
    if (res) setRows((prev) => [...prev, ...res.rows.filter((r) => !prev.some((p) => p.id === r.id))])
    setLoadingMore(false)
  }

  const save = async () => {
    setSaving(true)
    setSettingsError('')
    setSaved(false)
    const { error: e } = await supabase.rpc('admin_video_settings_update', {
      p_free_posting: form.free_posting,
      p_premium_max: Number(form.premium_max),
      p_free_max: Number(form.free_max),
      p_premium_per_day: Number(form.premium_day),
      p_free_per_day: Number(form.free_day),
    })
    setSaving(false)
    if (e) { setSettingsError(e.message || 'Could not save.'); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    loadSettings()
  }

  const runAction = async () => {
    if (!confirm) return
    setBusy(true)
    setActionError('')
    const { error: e } = await supabase.rpc('admin_video_action', { p_id: confirm.video.id, p_action: confirm.action, p_note: note.trim() || null })
    setBusy(false)
    if (e) { setActionError(e.message || 'Could not complete this action.'); return }
    setConfirm(null)
    setNote('')
    setTick((n) => n + 1)
  }

  const canEdit = !!settings?.can_edit

  return (
    <AdminLayout title="Videos">
      <style>{CSS}</style>

      <p style={{ fontSize: 13, color: A.textMuted, marginBottom: 14, maxWidth: 640 }}>
        Control who can post short videos and how long they can be, and review the videos on Farmxie. Changes here are silent: members are not notified.
      </p>

      <div className="vp-cards">
        <div className="vp-card"><p className="l">Videos</p><p className="v">{data ? (data.active + data.hidden).toLocaleString() : '-'}</p></div>
        <div className="vp-card"><p className="l">Visible</p><p className="v">{data ? data.active.toLocaleString() : '-'}</p></div>
        <div className="vp-card"><p className="l">Hidden by staff</p><p className="v">{data ? data.hidden.toLocaleString() : '-'}</p></div>
        <div className="vp-card"><p className="l">Total views</p><p className="v">{data ? Number(data.views).toLocaleString() : '-'}</p></div>
      </div>

      <div className="vp-panel">
        <p style={{ fontSize: 15, fontWeight: 800, color: A.text }}>Posting rules</p>
        {!settings ? (
          <p style={{ fontSize: 13, color: settingsError ? A.red : A.textMuted, marginTop: 10 }}>{settingsError || 'Loading...'}</p>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14, padding: '12px 14px', background: A.bg, border: `1px solid ${A.border}`, borderRadius: 10 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: A.text }}>Let free members post videos</p>
                <p style={{ fontSize: 12, color: A.textMuted, marginTop: 2 }}>
                  When off, only Premium members can post. When on, free members can post videos up to the free length below.
                </p>
              </div>
              <div
                role="switch"
                aria-checked={form.free_posting}
                className="vp-switch"
                style={{ background: form.free_posting ? A.green : '#D1D9D1', opacity: canEdit ? 1 : 0.5, cursor: canEdit ? 'pointer' : 'default' }}
                onClick={() => canEdit && setForm((f) => ({ ...f, free_posting: !f.free_posting }))}>
                <i style={{ left: form.free_posting ? 21 : 3 }} />
              </div>
            </div>

            <div className="vp-grid">
              <div className="vp-field">
                <label>Premium: longest video (seconds)</label>
                <input type="number" min={5} max={300} value={form.premium_max} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, premium_max: e.target.value }))} />
                <small>Longer videos are cut to this length when posted.</small>
              </div>
              <div className="vp-field">
                <label>Free: longest video (seconds)</label>
                <input type="number" min={5} max={300} value={form.free_max} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, free_max: e.target.value }))} />
                <small>Cannot be longer than the Premium length.</small>
              </div>
              <div className="vp-field">
                <label>Premium: videos per day</label>
                <input type="number" min={1} max={100} value={form.premium_day} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, premium_day: e.target.value }))} />
              </div>
              <div className="vp-field">
                <label>Free: videos per day</label>
                <input type="number" min={1} max={100} value={form.free_day} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, free_day: e.target.value }))} />
              </div>
            </div>

            {settingsError && <p style={{ fontSize: 12.5, color: A.red, marginTop: 12 }}>{settingsError}</p>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
              {canEdit ? (
                <button className="vp-btn primary" disabled={saving} onClick={save}>{saving ? 'Saving...' : 'Save changes'}</button>
              ) : (
                <p style={{ fontSize: 12.5, color: A.textMuted }}>You can view these rules but not change them.</p>
              )}
              {saved && <span style={{ fontSize: 12.5, fontWeight: 700, color: A.green }}>Saved</span>}
            </div>
          </>
        )}
      </div>

      <div className="vp-panel">
        <div className="vp-filters">
          <input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search caption, name, username or video ID" />
          {(['all', 'active', 'hidden'] as const).map((s) => (
            <button key={s} className="vp-btn" onClick={() => setStatus(s)} style={status === s ? { background: A.greenTint, borderColor: A.green, color: A.greenDark } : undefined}>
              {s === 'all' ? 'All' : s === 'active' ? 'Visible' : 'Hidden'}
            </button>
          ))}
          <button className="vp-btn" onClick={() => setTick((n) => n + 1)}>Refresh</button>
        </div>

        {loading ? (
          <p style={{ fontSize: 13, color: A.textMuted, padding: '24px 0', textAlign: 'center' }}>Loading videos...</p>
        ) : error ? (
          <p style={{ fontSize: 13, color: A.red, padding: '24px 0', textAlign: 'center' }}>{error}</p>
        ) : rows.length === 0 ? (
          <p style={{ fontSize: 13, color: A.textMuted, padding: '24px 0', textAlign: 'center' }}>No videos found.</p>
        ) : (
          <>
            {rows.map((v) => {
              const name = v.full_name || v.username || 'Unknown user'
              return (
                <div key={v.id} className="vp-row">
                  <a href={v.video_url} target="_blank" rel="noreferrer" style={{ display: 'block', flexShrink: 0 }}>
                    {v.thumbnail_url
                      ? <img className="vp-thumb" src={v.thumbnail_url} alt="" />
                      : <div className="vp-thumb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11 }}>Play</div>}
                  </a>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13.5, fontWeight: 700, color: A.text, wordBreak: 'break-word' }}>{v.caption || <span style={{ color: A.textSoft, fontWeight: 500 }}>No caption</span>}</p>
                    <p style={{ fontSize: 12.5, color: A.textMuted, marginTop: 3 }}>
                      {name}{v.username ? ` · @${v.username}` : ''}{v.author_premium ? ' · Premium' : ''}
                    </p>
                    <p style={{ fontSize: 12, color: A.textSoft, marginTop: 3 }}>
                      {fmtDay(v.created_at)} · {fmtDur(v.duration_seconds)} · {v.views_count.toLocaleString()} views · {v.likes_count.toLocaleString()} likes · {v.comments_count.toLocaleString()} comments
                    </p>
                  </div>
                  <span className="vp-chip" style={v.is_hidden_by_admin ? { background: A.amberChip, color: A.amber } : { background: '#DCFCE7', color: '#166534' }}>
                    {v.is_hidden_by_admin ? 'Hidden' : 'Visible'}
                  </span>
                  {canModerate && (
                    <button
                      className={`vp-btn${v.is_hidden_by_admin ? '' : ' danger'}`}
                      onClick={() => { setActionError(''); setNote(''); setConfirm({ video: v, action: v.is_hidden_by_admin ? 'restore' : 'hide' }) }}>
                      {v.is_hidden_by_admin ? 'Restore' : 'Hide'}
                    </button>
                  )}
                </div>
              )
            })}
            {data && rows.length < data.total && (
              <div style={{ textAlign: 'center', paddingTop: 14 }}>
                <button className="vp-btn" disabled={loadingMore} onClick={loadMore}>{loadingMore ? 'Loading...' : `Load more (${data.total - rows.length} left)`}</button>
              </div>
            )}
          </>
        )}
      </div>

      {confirm && (
        <div className="vp-overlay" onClick={() => !busy && setConfirm(null)}>
          <div className="vp-modal" onClick={(e) => e.stopPropagation()}>
            <p style={{ fontSize: 16, fontWeight: 800, color: A.text }}>{confirm.action === 'hide' ? 'Hide this video?' : 'Restore this video?'}</p>
            <p style={{ fontSize: 13, color: A.textMuted, marginTop: 6, lineHeight: 1.5 }}>
              {confirm.action === 'hide'
                ? 'The video disappears from the feed. The owner is told it was hidden and can still delete it.'
                : 'The video becomes visible in the feed again. The owner is told it was restored.'}
            </p>
            {confirm.action === 'hide' && (
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 500))}
                rows={3}
                placeholder="Reason (shown to the owner, optional)"
                style={{ width: '100%', boxSizing: 'border-box', marginTop: 12, padding: '9px 11px', border: `1px solid ${A.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
              />
            )}
            {actionError && <p style={{ fontSize: 12.5, color: A.red, marginTop: 10 }}>{actionError}</p>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="vp-btn" disabled={busy} onClick={() => setConfirm(null)}>Cancel</button>
              <button className={`vp-btn ${confirm.action === 'hide' ? 'danger' : 'primary'}`} disabled={busy} onClick={runAction}>
                {busy ? 'Working...' : confirm.action === 'hide' ? 'Hide video' : 'Restore video'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
