import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'
import PremiumTick from './PremiumTick'
import { isPremiumActive } from './premiumShared'
import { COLORS, ErrorBanner, LoadMoreButton } from './shared'
import { formatDate, roleLabel, cleanSearch, type Group, type MyRole } from './groupsShared'

type Member = { user_id: string; role: string; joined_at: string }
type Prof = { user_id: string; full_name: string | null; username: string | null; profile_image: string | null; role: string | null; is_premium: boolean; premium_until: string | null }
type Req = { id: string; user_id: string; created_at: string }

const PAGE = 20
const PROFILE_COLS = 'user_id, full_name, username, profile_image, role, is_premium, premium_until'
const rank = (r: string) => (r === 'admin' ? 0 : r === 'moderator' ? 1 : 2)

export default function GroupMembersTab({ group, myRole, userId, onChanged }: {
  group: Group; myRole: MyRole; userId: string; onChanged: () => void
}) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [profiles, setProfiles] = useState<Record<string, Prof>>({})
  const [following, setFollowing] = useState<Set<string>>(new Set())
  const [requests, setRequests] = useState<Req[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const reqId = useRef(0)

  const isMod = myRole === 'owner' || myRole === 'admin' || myRole === 'moderator'

  const loadProfiles = async (ids: string[]) => {
    const need = ids.filter((id) => !profiles[id])
    if (need.length) {
      const { data } = await supabase.from('profiles').select(PROFILE_COLS).in('user_id', need)
      setProfiles((prev) => {
        const next = { ...prev }
        for (const p of (data || []) as Prof[]) next[p.user_id] = p
        return next
      })
    }
    if (ids.length) {
      const { data } = await supabase.from('follows').select('following_id').eq('follower_id', userId).in('following_id', ids)
      setFollowing((prev) => {
        const next = new Set(prev)
        for (const r of (data || []) as any[]) next.add(r.following_id)
        return next
      })
    }
  }

  const fetchPage = async (offset: number): Promise<Member[] | null> => {
    const term = cleanSearch(search)
    let ids: string[] | null = null
    if (term) {
      const { data } = await supabase.from('profiles').select('user_id').or(`full_name.ilike.%${term}%,username.ilike.%${term}%`).limit(50)
      const found: string[] = (data || []).map((r: any) => r.user_id)
      if (found.length === 0) return []
      ids = found
    }
    let q = supabase.from('community_members').select('user_id, role, joined_at').eq('community_id', group.id)
    if (ids) q = q.in('user_id', ids)
    const { data, error: e } = await q.order('joined_at', { ascending: true }).range(offset, offset + PAGE - 1)
    if (e) return null
    return (data || []) as Member[]
  }

  const loadRequests = async () => {
    if (!isMod || group.privacy !== 'private') { setRequests([]); return }
    const { data } = await supabase.from('community_join_requests').select('id, user_id, created_at')
      .eq('community_id', group.id).eq('status', 'pending').order('created_at', { ascending: true }).limit(50)
    const list = (data || []) as Req[]
    setRequests(list)
    loadProfiles(list.map((r) => r.user_id))
  }

  const load = async () => {
    const my = ++reqId.current
    setLoading(true)
    setError('')
    const page = await fetchPage(0)
    if (my !== reqId.current) return
    if (page === null) { setError('Could not load members. Please try again.'); setLoading(false); return }
    setMembers(page)
    setHasMore(page.length === PAGE)
    await loadProfiles(page.map((m) => m.user_id))
    if (my === reqId.current) setLoading(false)
  }

  const loadMore = async () => {
    if (loadingMore) return
    setLoadingMore(true)
    const page = await fetchPage(members.length)
    if (page) {
      setMembers((prev) => {
        const seen = new Set(prev.map((m) => m.user_id))
        return [...prev, ...page.filter((m) => !seen.has(m.user_id))]
      })
      setHasMore(page.length === PAGE)
      await loadProfiles(page.map((m) => m.user_id))
    }
    setLoadingMore(false)
  }

  useEffect(() => { loadRequests() }, [group.id, myRole, group.privacy])
  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [group.id, search])

  const toggleFollow = async (id: string) => {
    const was = following.has(id)
    setFollowing((prev) => { const n = new Set(prev); if (was) n.delete(id); else n.add(id); return n })
    const { error: e } = was
      ? await supabase.from('follows').delete().eq('follower_id', userId).eq('following_id', id)
      : await supabase.from('follows').insert({ follower_id: userId, following_id: id })
    if (e) setFollowing((prev) => { const n = new Set(prev); if (was) n.add(id); else n.delete(id); return n })
  }

  const rpc = async (key: string, fn: string, args: Record<string, unknown>, after: () => void) => {
    setBusy(key); setError(''); setMenuFor(null)
    const { error: e } = await supabase.rpc(fn, args)
    setBusy(null)
    if (e) { setError(e.message); return }
    after()
  }

  const review = (r: Req, approve: boolean) =>
    rpc(r.id, 'group_review_request', { p_request: r.id, p_approve: approve }, () => {
      setRequests((prev) => prev.filter((x) => x.id !== r.id))
      if (approve) { onChanged(); load() }
    })

  const setRole = (id: string, role: string) =>
    rpc(id, 'group_set_member_role', { p_id: group.id, p_user: id, p_role: role }, () =>
      setMembers((prev) => prev.map((m) => m.user_id === id ? { ...m, role } : m)))

  const remove = (id: string, name: string) => {
    if (!window.confirm(`Remove ${name} from this group?`)) return
    rpc(id, 'group_remove_member', { p_id: group.id, p_user: id }, () => {
      setMembers((prev) => prev.filter((m) => m.user_id !== id))
      onChanged()
    })
  }

  const actionsFor = (m: Member, name: string) => {
    if (m.user_id === userId || m.user_id === group.owner_id || !isMod) return []
    const out: { label: string; danger?: boolean; run: () => void }[] = []
    if (myRole === 'owner' || myRole === 'admin') {
      if (m.role === 'member') out.push({ label: 'Make moderator', run: () => setRole(m.user_id, 'moderator') })
      if (m.role === 'moderator') out.push({ label: 'Remove moderator role', run: () => setRole(m.user_id, 'member') })
      if (myRole === 'owner' && m.role !== 'admin') out.push({ label: 'Make admin', run: () => setRole(m.user_id, 'admin') })
      if (myRole === 'owner' && m.role === 'admin') out.push({ label: 'Remove admin role', run: () => setRole(m.user_id, 'member') })
    }
    const canRemove = myRole === 'owner' || (myRole === 'admin' && m.role !== 'admin') || (myRole === 'moderator' && m.role === 'member')
    if (canRemove) out.push({ label: 'Remove from group', danger: true, run: () => remove(m.user_id, name) })
    return out
  }

  const sorted = search ? members : [...members].sort((a, b) => rank(a.role) - rank(b.role))

  const person = (id: string) => {
    const p = profiles[id]
    return { name: p?.full_name || p?.username || 'Farmxie user', p }
  }

  const avatar = (p?: Prof) => (
    <div style={{ width: '42px', height: '42px', borderRadius: '21px', background: 'var(--fx-tint-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
      {p?.profile_image ? <img src={p.profile_image} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="user" size={18} color={COLORS.green} />}
    </div>
  )

  return (
    <div>
      <ErrorBanner text={error} />

      {requests.length > 0 && (
        <div style={{ background: COLORS.card, borderRadius: '14px', padding: '12px', marginBottom: '12px', border: '1px solid var(--fx-bd-amber)' }}>
          <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.text, marginBottom: '10px' }}>Requests to join ({requests.length})</p>
          {requests.map((r) => {
            const { name, p } = person(r.user_id)
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <div onClick={() => p?.username && navigate(`/u/${p.username}`)} style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0, cursor: p?.username ? 'pointer' : 'default' }}>
                  {avatar(p)}
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</p>
                    <p style={{ fontSize: '10.5px', color: COLORS.textMuted }}>Requested {formatDate(r.created_at)}</p>
                  </div>
                </div>
                <div role="button" onClick={busy === r.id ? undefined : () => review(r, true)} style={{ padding: '7px 12px', borderRadius: '9px', background: COLORS.green, color: 'white', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', opacity: busy === r.id ? 0.6 : 1 }}>Approve</div>
                <div role="button" onClick={busy === r.id ? undefined : () => review(r, false)} style={{ padding: '7px 12px', borderRadius: '9px', border: `1px solid ${COLORS.border}`, color: COLORS.textMuted, fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}>Reject</div>
              </div>
            )
          })}
        </div>
      )}

      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search members" aria-label="Search members"
        style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: `1px solid ${COLORS.border}`, marginBottom: '12px', fontSize: '13px', boxSizing: 'border-box', background: COLORS.card }} />

      {loading ? (
        <p style={{ textAlign: 'center', fontSize: '12.5px', color: COLORS.textMuted, padding: '24px' }}>Loading members...</p>
      ) : sorted.length === 0 ? (
        <div style={{ background: COLORS.card, padding: '28px 16px', textAlign: 'center', borderRadius: '14px', color: COLORS.textMuted, fontSize: '12.5px' }}>
          {search ? 'No members match your search.' : 'No members yet.'}
        </div>
      ) : (
        <div style={{ background: COLORS.card, borderRadius: '14px', padding: '4px 12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          {sorted.map((m, i) => {
            const { name, p } = person(m.user_id)
            const badge = roleLabel(m.user_id === group.owner_id ? 'owner' : m.role)
            const actions = actionsFor(m, name)
            return (
              <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderTop: i ? `1px solid ${COLORS.border}` : 'none', position: 'relative' }}>
                <div onClick={() => p?.username && navigate(`/u/${p.username}`)} style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0, cursor: p?.username ? 'pointer' : 'default' }}>
                  {avatar(p)}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</p>
                      {!!p && isPremiumActive(p.is_premium, p.premium_until) && <PremiumTick size={13} />}
                      {badge && <span style={{ fontSize: '9.5px', fontWeight: 800, padding: '2px 7px', borderRadius: '8px', background: badge === 'Moderator' ? 'var(--fx-tint-blue)' : 'var(--fx-tint-green)', color: badge === 'Moderator' ? 'var(--fx-blue-text)' : 'var(--fx-green-dark)', flexShrink: 0 }}>{badge}</span>}
                    </div>
                    <p style={{ fontSize: '10.5px', color: COLORS.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p?.username ? `@${p.username} · ` : ''}{p?.role ? `${p.role} · ` : ''}Joined {formatDate(m.joined_at)}
                    </p>
                  </div>
                </div>
                {m.user_id !== userId && p?.username && (
                  <div role="button" onClick={() => toggleFollow(m.user_id)} style={{ padding: '6px 12px', borderRadius: '9px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', background: following.has(m.user_id) ? COLORS.bg : COLORS.green, color: following.has(m.user_id) ? COLORS.textMuted : 'white', border: following.has(m.user_id) ? `1px solid ${COLORS.border}` : 'none' }}>
                    {following.has(m.user_id) ? 'Following' : 'Follow'}
                  </div>
                )}
                {actions.length > 0 && (
                  <>
                    <div role="button" aria-label="Member options" onClick={() => setMenuFor(menuFor === m.user_id ? null : m.user_id)} style={{ padding: '6px', cursor: 'pointer', display: 'flex', opacity: busy === m.user_id ? 0.4 : 1 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill={COLORS.textMuted} aria-hidden="true"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
                    </div>
                    {menuFor === m.user_id && (
                      <>
                        <div onClick={() => setMenuFor(null)} style={{ position: 'fixed', inset: 0, zIndex: 20 }} />
                        <div style={{ position: 'absolute', right: 0, top: '44px', zIndex: 21, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '10px', boxShadow: '0 6px 20px rgba(0,0,0,0.12)', minWidth: '170px', overflow: 'hidden' }}>
                          {actions.map((a) => (
                            <div key={a.label} onClick={a.run} style={{ padding: '11px 14px', fontSize: '12.5px', fontWeight: 600, color: a.danger ? COLORS.red : COLORS.text, cursor: 'pointer' }}>{a.label}</div>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      <LoadMoreButton onClick={loadMore} loading={loadingMore} hasMore={hasMore && !loading} />
    </div>
  )
}
