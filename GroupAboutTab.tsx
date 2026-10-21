import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'
import ImageUploader from './ImageUploader'
import { COLORS, inputStyle, labelStyle, ErrorBanner } from './shared'
import { GROUP_CATEGORIES, categoryLabel, formatDate, reasonText, type Group, type MyRole } from './groupsShared'

type Person = { user_id: string; full_name: string | null; username: string | null; profile_image: string | null }
type StaffRow = { user_id: string; role: string }
type ReportRow = { report_id: string; post_id: string; reason: string; description: string | null; created_at: string; excerpt: string }

const card = { background: COLORS.card, borderRadius: '14px', padding: '14px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' } as const
const heading = { fontSize: '13px', fontWeight: 800, color: COLORS.text, marginBottom: '8px' } as const

export default function GroupAboutTab({ group, myRole, onChanged }: { group: Group; myRole: MyRole; onChanged: () => void }) {
  const navigate = useNavigate()
  const isOwner = myRole === 'owner'
  const isAdmin = myRole === 'owner' || myRole === 'admin'
  const isMod = isAdmin || myRole === 'moderator'

  const [people, setPeople] = useState<Record<string, Person>>({})
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [reports, setReports] = useState<ReportRow[]>([])
  const [error, setError] = useState('')

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [name, setName] = useState(group.name)
  const [description, setDescription] = useState(group.description || '')
  const [purpose, setPurpose] = useState(group.purpose || '')
  const [category, setCategory] = useState(group.category || '')
  const [privacy, setPrivacy] = useState<'public' | 'private'>(group.privacy)
  const [country, setCountry] = useState(group.country || '')
  const [icon, setIcon] = useState<string[]>(group.icon_url ? [group.icon_url] : [])
  const [cover, setCover] = useState<string[]>(group.cover_url ? [group.cover_url] : [])

  const [editingRules, setEditingRules] = useState(false)
  const [rulesDraft, setRulesDraft] = useState<string[]>(group.rules)
  const [savingRules, setSavingRules] = useState(false)

  const loadPeople = async (ids: string[]) => {
    if (!ids.length) return
    const { data } = await supabase.from('profiles').select('user_id, full_name, username, profile_image').in('user_id', ids)
    setPeople((prev) => {
      const n = { ...prev }
      for (const p of (data || []) as Person[]) n[p.user_id] = p
      return n
    })
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('community_members').select('user_id, role').eq('community_id', group.id).in('role', ['admin', 'moderator']).limit(50)
      const rows = ((data || []) as StaffRow[]).filter((r) => r.user_id !== group.owner_id)
      setStaff(rows)
      loadPeople([group.owner_id, ...rows.map((r) => r.user_id)])
    })()
  }, [group.id, group.owner_id])

  const loadReports = async () => {
    if (!isMod) return
    const { data } = await supabase.rpc('group_reports', { p_id: group.id })
    setReports((data || []) as ReportRow[])
  }
  useEffect(() => { loadReports() }, [group.id, myRole])

  const person = (id: string) => people[id]
  const personRow = (id: string, badge: string) => {
    const p = person(id)
    return (
      <div key={id} onClick={() => p?.username && navigate(`/u/${p.username}`)} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', cursor: p?.username ? 'pointer' : 'default' }}>
        <div style={{ width: '34px', height: '34px', borderRadius: '17px', background: 'var(--fx-tint-green)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {p?.profile_image ? <img src={p.profile_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="user" size={15} color={COLORS.green} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text }}>{p?.full_name || p?.username || 'Farmxie user'}</p>
          {p?.username && <p style={{ fontSize: '10.5px', color: COLORS.textMuted }}>@{p.username}</p>}
        </div>
        <span style={{ fontSize: '9.5px', fontWeight: 800, padding: '2px 8px', borderRadius: '8px', background: badge === 'Moderator' ? '#E0F2FE' : 'var(--fx-tint-green)', color: badge === 'Moderator' ? '#075985' : 'var(--fx-green-dark)' }}>{badge}</span>
      </div>
    )
  }

  const saveInfo = async () => {
    if (saving || uploading) return
    if (name.trim().length < 3) { setError('Group name must be at least 3 characters.'); return }
    if (!category) { setError('Choose an agriculture category.'); return }
    setError(''); setSaving(true)
    const { error: e } = await supabase.from('communities').update({
      name: name.trim(), description: description.trim() || null, purpose: purpose.trim() || null,
      category, privacy, country: country.trim() || null, icon_url: icon[0] || null, cover_url: cover[0] || null,
    }).eq('id', group.id)
    setSaving(false)
    if (e) { setError(e.message || 'Could not save your changes.'); return }
    setEditing(false)
    onChanged()
  }

  const saveRules = async () => {
    setSavingRules(true); setError('')
    const { error: e } = await supabase.rpc('group_set_rules', { p_id: group.id, p_rules: rulesDraft })
    setSavingRules(false)
    if (e) { setError(e.message); return }
    setEditingRules(false)
    onChanged()
  }

  const removePost = async (r: ReportRow) => {
    if (!window.confirm('Remove this post from the group?')) return
    const { data, error: e } = await supabase.from('posts').delete().eq('id', r.post_id).select('id')
    if (e || !data?.length) { setError('Could not remove this post.'); return }
    setReports((prev) => prev.filter((x) => x.report_id !== r.report_id))
    onChanged()
  }

  return (
    <div>
      <ErrorBanner text={error} />

      {isOwner && !editing && (
        <div role="button" onClick={() => setEditing(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, background: COLORS.card, color: COLORS.text, fontWeight: 700, fontSize: '12.5px', cursor: 'pointer', marginBottom: '12px' }}>
          <Icon name="edit" size={14} color={COLORS.text} /> Edit group information
        </div>
      )}

      {isOwner && editing && (
        <div style={{ ...card, boxShadow: '0 2px 10px rgba(0,0,0,0.08)' }}>
          <p style={heading}>Edit group</p>
          <p style={labelStyle}>Group photo</p>
          <div style={{ marginBottom: '12px' }}><ImageUploader value={icon} onChange={setIcon} folder="avatars" max={1} onBusyChange={setUploading} /></div>
          <p style={labelStyle}>Cover photo</p>
          <div style={{ marginBottom: '12px' }}><ImageUploader value={cover} onChange={setCover} folder="covers" max={1} onBusyChange={setUploading} /></div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name" maxLength={80} aria-label="Group name" style={inputStyle} />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description" rows={2} maxLength={500} aria-label="Description" style={{ ...inputStyle, resize: 'none' }} />
          <textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Purpose and community goals" rows={3} maxLength={600} aria-label="Purpose" style={{ ...inputStyle, resize: 'none' }} />
          <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category" style={inputStyle}>
            <option value="">Choose a category</option>
            {GROUP_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country or region (optional)" maxLength={80} aria-label="Country" style={inputStyle} />
          <p style={labelStyle}>Who can join?</p>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            {(['public', 'private'] as const).map((k) => (
              <div key={k} role="radio" aria-checked={privacy === k} onClick={() => setPrivacy(k)} style={{ flex: 1, textAlign: 'center', padding: '9px', borderRadius: '10px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${privacy === k ? COLORS.green : COLORS.border}`, background: privacy === k ? 'var(--fx-tint-green3)' : COLORS.card, color: COLORS.text }}>
                {k === 'public' ? 'Public' : 'Private'}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div role="button" onClick={() => { setEditing(false); setError('') }} style={{ flex: 1, textAlign: 'center', padding: '10px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '12.5px', fontWeight: 700, color: COLORS.textMuted, cursor: 'pointer' }}>Cancel</div>
            <div role="button" onClick={saveInfo} style={{ flex: 1, textAlign: 'center', padding: '10px', borderRadius: '10px', background: COLORS.green, fontSize: '12.5px', fontWeight: 700, color: 'white', cursor: 'pointer', opacity: saving || uploading ? 0.6 : 1 }}>
              {saving ? 'Saving...' : uploading ? 'Uploading...' : 'Save'}
            </div>
          </div>
        </div>
      )}

      <div style={card}>
        <p style={heading}>About this group</p>
        <p style={{ fontSize: '12.5px', color: COLORS.text, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{group.description || 'No description yet.'}</p>
        {group.purpose && (
          <>
            <p style={{ ...heading, marginTop: '14px' }}>Purpose and goals</p>
            <p style={{ fontSize: '12.5px', color: COLORS.text, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{group.purpose}</p>
          </>
        )}
        <div style={{ marginTop: '14px', display: 'grid', gap: '8px' }}>
          {[
            ['Category', categoryLabel(group.category) || 'Not set'],
            ['Privacy', group.privacy === 'private' ? 'Private · people request to join, only members see posts' : 'Public · anyone can join and see posts'],
            ...(group.country ? [['Location', group.country]] : []),
            ['Members', String(group.members_count)],
            ['Posts', String(group.posts_count)],
            ['Created', formatDate(group.created_at)],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: '10px', fontSize: '12px' }}>
              <span style={{ width: '70px', flexShrink: 0, color: COLORS.textMuted, fontWeight: 700 }}>{k}</span>
              <span style={{ color: COLORS.text }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={heading}>Group rules</p>
          {isAdmin && !editingRules && (
            <div role="button" onClick={() => { setRulesDraft(group.rules); setEditingRules(true) }} style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.green, cursor: 'pointer', marginBottom: '8px' }}>Edit rules</div>
          )}
        </div>
        {editingRules ? (
          <>
            {rulesDraft.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input value={r} onChange={(e) => setRulesDraft((prev) => prev.map((x, j) => j === i ? e.target.value : x))} maxLength={300} placeholder={`Rule ${i + 1}`} aria-label={`Rule ${i + 1}`} style={inputStyle} />
                <div role="button" aria-label="Remove rule" onClick={() => setRulesDraft((prev) => prev.filter((_, j) => j !== i))} style={{ marginBottom: '10px', cursor: 'pointer', display: 'flex' }}><Icon name="close" size={16} color={COLORS.textMuted} /></div>
              </div>
            ))}
            {rulesDraft.length < 15 && <div role="button" onClick={() => setRulesDraft((prev) => [...prev, ''])} style={{ fontSize: '12px', fontWeight: 700, color: COLORS.green, cursor: 'pointer', marginBottom: '12px' }}>+ Add rule</div>}
            <div style={{ display: 'flex', gap: '10px' }}>
              <div role="button" onClick={() => setEditingRules(false)} style={{ flex: 1, textAlign: 'center', padding: '9px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '12.5px', fontWeight: 700, color: COLORS.textMuted, cursor: 'pointer' }}>Cancel</div>
              <div role="button" onClick={savingRules ? undefined : saveRules} style={{ flex: 1, textAlign: 'center', padding: '9px', borderRadius: '10px', background: COLORS.green, fontSize: '12.5px', fontWeight: 700, color: 'white', cursor: 'pointer', opacity: savingRules ? 0.6 : 1 }}>{savingRules ? 'Saving...' : 'Save rules'}</div>
            </div>
          </>
        ) : group.rules.length === 0 ? (
          <p style={{ fontSize: '12px', color: COLORS.textMuted }}>This group has not set any rules yet.</p>
        ) : (
          <ol style={{ margin: 0, paddingLeft: '18px' }}>
            {group.rules.map((r, i) => <li key={i} style={{ fontSize: '12.5px', color: COLORS.text, lineHeight: 1.55, marginBottom: '6px' }}>{r}</li>)}
          </ol>
        )}
      </div>

      <div style={card}>
        <p style={heading}>Created by and admins</p>
        {personRow(group.owner_id, 'Owner')}
        {staff.map((s) => personRow(s.user_id, s.role === 'admin' ? 'Admin' : 'Moderator'))}
      </div>

      {isMod && (
        <div style={card}>
          <p style={heading}>Reported posts ({reports.length})</p>
          {reports.length === 0 ? (
            <p style={{ fontSize: '12px', color: COLORS.textMuted }}>No open reports for this group.</p>
          ) : reports.map((r) => (
            <div key={r.report_id} style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: '10px', marginTop: '10px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: COLORS.red }}>{reasonText(r.reason)} · {formatDate(r.created_at)}</p>
              <p style={{ fontSize: '12.5px', color: COLORS.text, margin: '4px 0', lineHeight: 1.5 }}>{r.excerpt}</p>
              {r.description && <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '6px' }}>“{r.description}”</p>}
              <div role="button" onClick={() => removePost(r)} style={{ display: 'inline-block', padding: '6px 12px', borderRadius: '9px', background: 'var(--fx-tint-red2)', color: COLORS.red, fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}>Remove post</div>
            </div>
          ))}
          <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginTop: '10px' }}>Farmxie staff also review every report. Removing a post here does not replace their review.</p>
        </div>
      )}
    </div>
  )
}
