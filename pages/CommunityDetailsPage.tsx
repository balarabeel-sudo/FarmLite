import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import Icon from '../Icons'
import { ListCardSkeleton } from '../LoadingSkeleton'
import NetworkError from '../NetworkError'
import ReportSheet from '../ReportSheet'
import GroupFeed from '../GroupFeed'
import GroupMembersTab from '../GroupMembersTab'
import GroupAboutTab from '../GroupAboutTab'
import { COLORS } from '../shared'
import { GROUP_COLUMNS, categoryLabel, formatDate, type Group, type MyRole } from '../groupsShared'

type Tab = 'discussion' | 'polls' | 'members' | 'about'
const TABS: { key: Tab; label: string }[] = [
  { key: 'discussion', label: 'Discussion' },
  { key: 'polls', label: 'Polls' },
  { key: 'members', label: 'Members' },
  { key: 'about', label: 'About' },
]

export default function CommunityDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [group, setGroup] = useState<Group | null>(null)
  const [myRole, setMyRole] = useState<MyRole>(null)
  const [requested, setRequested] = useState(false)
  const [ownerName, setOwnerName] = useState('')
  const [pending, setPending] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)

  const tabParam = params.get('tab') as Tab | null
  const tab: Tab = TABS.some((t) => t.key === tabParam) ? (tabParam as Tab) : 'discussion'
  const setTab = (t: Tab) => setParams(t === 'discussion' ? {} : { tab: t }, { replace: true })

  const flash = (text: string) => { setMessage(text); setTimeout(() => setMessage(''), 2500) }

  const load = async (silent = false) => {
    if (!id || !user) return
    setNetError(false)
    if (!silent) setLoading(true)

    const [gRes, mRes, rRes] = await Promise.all([
      supabase.from('communities').select(GROUP_COLUMNS).eq('id', id).maybeSingle(),
      supabase.from('community_members').select('role').eq('community_id', id).eq('user_id', user.id).maybeSingle(),
      supabase.from('community_join_requests').select('id').eq('community_id', id).eq('user_id', user.id).eq('status', 'pending').maybeSingle(),
    ])
    if (gRes.error) { setNetError(true); setLoading(false); return }

    const g = gRes.data as any as Group | null
    setGroup(g)
    const role: MyRole = g && g.owner_id === user.id ? 'owner' : ((mRes.data?.role as MyRole) ?? null)
    setMyRole(role)
    setRequested(!!rRes.data)

    if (g) {
      const [owner, req] = await Promise.all([
        supabase.from('profiles').select('full_name, username').eq('user_id', g.owner_id).maybeSingle(),
        role === 'owner' || role === 'admin' || role === 'moderator'
          ? supabase.from('community_join_requests').select('id', { count: 'exact', head: true }).eq('community_id', id).eq('status', 'pending')
          : Promise.resolve({ count: 0 } as any),
      ])
      setOwnerName(owner.data?.full_name || owner.data?.username || '')
      setPending(req.count || 0)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [id, user])

  const join = async () => {
    if (!group || busy) return
    setBusy(true)
    const { data, error } = await supabase.rpc('group_join', { p_id: group.id })
    setBusy(false)
    if (error) { flash(error.message); return }
    flash(data === 'joined' ? 'You joined this group.' : 'Request sent. A group admin will review it.')
    load(true)
  }

  const cancelRequest = async () => {
    if (!group || busy) return
    setBusy(true)
    await supabase.rpc('group_cancel_request', { p_id: group.id })
    setBusy(false)
    setRequested(false)
  }

  const leave = async () => {
    if (!group || !user || busy) return
    if (!window.confirm('Leave this group?')) return
    setBusy(true)
    const { error } = await supabase.from('community_members').delete().eq('community_id', group.id).eq('user_id', user.id)
    setBusy(false)
    if (error) { flash('Could not leave the group.'); return }
    load(true)
  }

  const share = async () => {
    if (!group) return
    const url = `${window.location.origin}/communities/${group.id}`
    const data = { title: group.name, text: `Join ${group.name} on Farmxie`, url }
    if ((navigator as any).share) {
      try { await (navigator as any).share(data) } catch { /* cancelled */ }
    } else {
      try { await navigator.clipboard.writeText(url); flash('Link copied') } catch { flash(url) }
    }
  }

  const topBar = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div role="button" aria-label="Back" onClick={() => navigate(-1)} style={{ cursor: 'pointer', display: 'flex' }}><Icon name="arrowLeft" size={22} color={COLORS.text} /></div>
      <p style={{ flex: 1, fontSize: '16px', fontWeight: 800, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{group?.name || 'Group'}</p>
      {group && (
        <>
          <div role="button" aria-label="Share group" onClick={share} style={{ cursor: 'pointer', display: 'flex' }}><Icon name="share" size={20} color={COLORS.text} /></div>
          <div style={{ position: 'relative' }}>
            <div role="button" aria-label="More options" onClick={() => setMenuOpen((o) => !o)} style={{ cursor: 'pointer', display: 'flex', padding: '2px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill={COLORS.text} aria-hidden="true"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
            </div>
            {menuOpen && (
              <>
                <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 20 }} />
                <div style={{ position: 'absolute', right: 0, top: '30px', zIndex: 21, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '10px', boxShadow: '0 6px 20px rgba(0,0,0,0.12)', minWidth: '170px', overflow: 'hidden' }}>
                  <div onClick={() => { setMenuOpen(false); share() }} style={menuItem()}>Share group</div>
                  {myRole === 'owner' && <div onClick={() => { setMenuOpen(false); setTab('about') }} style={menuItem()}>Manage group</div>}
                  {myRole && myRole !== 'owner' && <div onClick={() => { setMenuOpen(false); leave() }} style={menuItem(true)}>Leave group</div>}
                  {myRole !== 'owner' && <div onClick={() => { setMenuOpen(false); setReportOpen(true) }} style={menuItem(true)}>Report group</div>}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )

  const shell = (body: ReactNode) => (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '30px' }}>{topBar}{body}</div>
  )

  if (netError) return shell(<NetworkError onRetry={() => load()} />)
  if (loading) return shell(<div style={{ padding: '16px' }}><ListCardSkeleton count={3} /></div>)
  if (!group || !user) return shell(<div style={{ padding: '40px 20px', textAlign: 'center', color: COLORS.textMuted, fontSize: '13px' }}>This group is not available.</div>)

  const isMember = myRole !== null
  const canRead = group.privacy === 'public' || isMember
  const avatar = group.icon_url || group.cover_url
  const cat = categoryLabel(group.category)

  let joinLabel = group.privacy === 'private' ? 'Request to Join' : 'Join Group'
  let joinAction: (() => void) | undefined = join
  let joinPrimary = true
  if (myRole === 'owner') { joinLabel = 'You own this group'; joinAction = undefined; joinPrimary = false }
  else if (isMember) { joinLabel = 'Joined ✓'; joinAction = leave; joinPrimary = false }
  else if (requested) { joinLabel = 'Requested · Cancel'; joinAction = cancelRequest; joinPrimary = false }

  const locked = (
    <div style={{ background: COLORS.card, padding: '32px 20px', textAlign: 'center', borderRadius: '14px', color: COLORS.textMuted, fontSize: '12.5px', lineHeight: 1.6 }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}><Icon name="lock" size={26} color={COLORS.textMuted} /></div>
      <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, marginBottom: '4px' }}>This is a private group</p>
      <p>{requested ? 'Your request is waiting for approval.' : 'Request to join to see posts, polls and members.'}</p>
    </div>
  )

  return shell(
    <>
      <div style={{ background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.greenDark})`, height: '140px', overflow: 'hidden' }}>
        {group.cover_url && <img src={group.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
      </div>

      <div style={{ background: COLORS.card, padding: '0 16px 14px', borderBottom: `1px solid ${COLORS.border}` }}>
        <div style={{ width: '72px', height: '72px', borderRadius: '18px', background: 'var(--fx-tint-green)', border: `3px solid ${COLORS.card}`, boxSizing: 'border-box', marginTop: '-30px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="users" size={28} color={COLORS.green} />}
        </div>
        <p style={{ fontSize: '18px', fontWeight: 800, color: COLORS.text, marginTop: '8px', wordBreak: 'break-word' }}>{group.name}</p>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '3px 9px', borderRadius: '10px', background: group.privacy === 'private' ? 'var(--fx-tint-amber)' : 'var(--fx-tint-green)', color: group.privacy === 'private' ? 'var(--fx-amber-text)' : 'var(--fx-green-dark)' }}>{group.privacy === 'private' ? 'Private group' : 'Public group'}</span>
          {cat && <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '3px 9px', borderRadius: '10px', background: COLORS.bg, color: COLORS.textMuted, border: `1px solid ${COLORS.border}` }}>{cat}</span>}
          {group.country && <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '3px 9px', borderRadius: '10px', background: COLORS.bg, color: COLORS.textMuted, border: `1px solid ${COLORS.border}` }}>{group.country}</span>}
        </div>
        {group.description && <p style={{ fontSize: '12.5px', color: COLORS.text, lineHeight: 1.55, marginTop: '10px', whiteSpace: 'pre-wrap' }}>{group.description}</p>}
        <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '10px', lineHeight: 1.6 }}>
          {group.members_count} {group.members_count === 1 ? 'member' : 'members'} · {group.posts_count} {group.posts_count === 1 ? 'post' : 'posts'} · Created {formatDate(group.created_at)}
          {ownerName ? ` by ${ownerName}` : ''}
        </p>

        <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
          <div role="button" onClick={busy || !joinAction ? undefined : joinAction}
            style={{ flex: 1, textAlign: 'center', padding: '11px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: joinAction ? 'pointer' : 'default', opacity: busy ? 0.6 : 1,
              background: joinPrimary ? COLORS.green : COLORS.bg, color: joinPrimary ? 'white' : COLORS.text, border: joinPrimary ? 'none' : `1px solid ${COLORS.border}` }}>
            {busy ? 'Please wait...' : joinLabel}
          </div>
          <div role="button" aria-label="Share group" onClick={share} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '11px 16px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, background: COLORS.card, color: COLORS.text, fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
            <Icon name="share" size={15} color={COLORS.text} /> Share
          </div>
        </div>
        {message && <p role="status" style={{ fontSize: '12px', color: COLORS.green, fontWeight: 700, marginTop: '10px' }}>{message}</p>}
      </div>

      <div role="tablist" style={{ display: 'flex', background: COLORS.card, position: 'sticky', top: '52px', zIndex: 9, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        {TABS.map((t) => (
          <div key={t.key} role="tab" aria-selected={tab === t.key} tabIndex={0} onClick={() => setTab(t.key)} onKeyDown={(e) => { if (e.key === 'Enter') setTab(t.key) }}
            style={{ flex: 1, textAlign: 'center', padding: '12px 2px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', color: tab === t.key ? COLORS.green : COLORS.textMuted, borderBottom: `2.5px solid ${tab === t.key ? COLORS.green : 'transparent'}` }}>
            {t.label}{t.key === 'members' && pending > 0 ? ` (${pending})` : ''}
          </div>
        ))}
      </div>

      <div style={{ padding: '14px 16px' }}>
        {tab === 'about' ? (
          <GroupAboutTab group={group} myRole={myRole} onChanged={() => load(true)} />
        ) : !canRead ? (
          locked
        ) : tab === 'members' ? (
          <GroupMembersTab group={group} myRole={myRole} userId={user.id} onChanged={() => load(true)} />
        ) : (
          <GroupFeed key={tab} group={group} myRole={myRole} userId={user.id} kind={tab} canPost={isMember} onChanged={() => load(true)} />
        )}
      </div>

      <ReportSheet open={reportOpen} onClose={() => setReportOpen(false)} type="group" contentId={group.id} targetLabel={group.name} />
    </>,
  )
}

function menuItem(danger = false) {
  return { padding: '11px 14px', fontSize: '12.5px', fontWeight: 600, color: danger ? COLORS.red : COLORS.text, cursor: 'pointer' } as const
}
