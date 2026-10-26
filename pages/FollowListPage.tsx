import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import NetworkError from '../NetworkError'
import Icon from '../Icons'
import { COLORS, LoadMoreButton } from '../shared'
import { followTarget, unfollowTarget } from '../followShared'
import { PersonAvatar, PersonTick, personName } from '../peopleShared'

const PAGE = 20

type Person = {
  user_id: string
  username: string
  full_name: string | null
  profile_image: string | null
  role: string | null
  is_verified: boolean
  is_premium: boolean
  premium_until: string | null
  followed_by_me: boolean
  is_me: boolean
}

// Routes: /u/:username/followers and /u/:username/following
export default function FollowListPage({ kind }: { kind: 'followers' | 'following' }) {
  const { username = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [netError, setNetError] = useState(false)
  const [notFound, setNotFound] = useState(false)
  // Follow state changed on this page (user id -> now following?)
  const [changed, setChanged] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState<Set<string>>(new Set())

  const fetchPage = useCallback(async (offset: number) => {
    const { data, error } = await supabase.rpc('profile_connections', { p_username: username, p_kind: kind, p_limit: PAGE, p_offset: offset })
    if (error) return null
    return data as { found: boolean; people: Person[] }
  }, [username, kind])

  const load = useCallback(async () => {
    setNetError(false)
    setNotFound(false)
    setLoading(true)
    const r = await fetchPage(0)
    if (!r) setNetError(true)
    else if (!r.found) setNotFound(true)
    else { setPeople(r.people); setHasMore(r.people.length === PAGE) }
    setLoading(false)
  }, [fetchPage])

  useEffect(() => { setChanged({}); setPeople([]); if (user) load() }, [user?.id, load])

  const more = async () => {
    setLoadingMore(true)
    const r = await fetchPage(people.length)
    if (r && r.found) {
      setPeople((prev) => { const seen = new Set(prev.map((p) => p.user_id)); return [...prev, ...r.people.filter((p) => !seen.has(p.user_id))] })
      setHasMore(r.people.length === PAGE)
    }
    setLoadingMore(false)
  }

  const toggle = async (p: Person) => {
    if (!user || busy.has(p.user_id)) return
    const now = changed[p.user_id] ?? p.followed_by_me
    setBusy((s) => new Set(s).add(p.user_id))
    const ok = now ? await unfollowTarget(user.id, 'user', p.user_id) : await followTarget(user.id, 'user', p.user_id)
    if (ok) setChanged((c) => ({ ...c, [p.user_id]: !now }))
    setBusy((s) => { const n = new Set(s); n.delete(p.user_id); return n })
  }

  const title = kind === 'followers' ? 'Followers' : 'Following'

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div onClick={() => navigate(-1)} style={{ cursor: 'pointer', display: 'flex' }}><Icon name="arrowLeft" size={22} color={COLORS.text} /></div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text, margin: 0 }}>{title}</p>
          <p style={{ fontSize: '11.5px', color: COLORS.textMuted, margin: 0 }}>@{username}</p>
        </div>
      </div>
      <div style={{ padding: '14px 16px' }}>
        {netError ? (
          <NetworkError onRetry={load} />
        ) : loading ? (
          <p style={{ fontSize: '12.5px', color: COLORS.textMuted }}>Loading...</p>
        ) : notFound ? (
          <p style={{ fontSize: '13px', color: COLORS.textMuted, textAlign: 'center', padding: '24px 0' }}>This profile is not available.</p>
        ) : people.length === 0 ? (
          <div style={{ background: COLORS.card, borderRadius: '14px', padding: '24px 16px', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, margin: 0 }}>{kind === 'followers' ? 'No followers yet' : 'Not following anyone yet'}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {people.map((p) => {
              const following = changed[p.user_id] ?? p.followed_by_me
              return (
                <div key={p.user_id} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: COLORS.card, borderRadius: '14px', padding: '12px' }}>
                  <div onClick={() => navigate(`/u/${p.username}`)} style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0, cursor: 'pointer' }}>
                    <PersonAvatar p={p} size={48} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <p style={{ fontSize: '13.5px', fontWeight: 800, color: COLORS.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{personName(p)}</p>
                        <PersonTick p={p} />
                      </div>
                      <p style={{ fontSize: '11.5px', color: COLORS.textMuted, margin: '2px 0 0' }}>@{p.username}</p>
                    </div>
                  </div>
                  {!p.is_me && (
                    <div onClick={() => toggle(p)} role="button" style={{
                      padding: '8px 16px', borderRadius: '999px', fontSize: '12.5px', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
                      background: following ? 'transparent' : COLORS.green, color: following ? COLORS.textMuted : 'white',
                      border: `1px solid ${following ? COLORS.border : COLORS.green}`, opacity: busy.has(p.user_id) ? 0.6 : 1,
                    }}>{following ? 'Following' : 'Follow'}</div>
                  )}
                </div>
              )
            })}
            <LoadMoreButton onClick={more} loading={loadingMore} hasMore={hasMore} />
          </div>
        )}
      </div>
    </div>
  )
}
