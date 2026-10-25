import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import NetworkError from '../NetworkError'
import Icon from '../Icons'
import { COLORS, LoadMoreButton } from '../shared'
import { followTarget } from '../followShared'
import { PersonAvatar, PersonTick, dismissSuggestedPerson, fetchSuggestedPeople, personName } from '../peopleShared'
import type { SuggestedPerson } from '../peopleShared'

const PAGE = 20

// Route: /people  (full "People you may know" list)
export default function PeoplePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [people, setPeople] = useState<SuggestedPerson[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [netError, setNetError] = useState(false)
  const [followed, setFollowed] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setNetError(false)
    setLoading(true)
    const r = await fetchSuggestedPeople(PAGE, 0)
    if (r.error) setNetError(true)
    else { setPeople(r.people); setHasMore(r.people.length === PAGE) }
    setLoading(false)
  }, [])

  useEffect(() => { if (user) load() }, [user?.id, load])

  const more = async () => {
    setLoadingMore(true)
    const r = await fetchSuggestedPeople(PAGE, people.length)
    if (!r.error) {
      // Someone followed meanwhile stays visible as "Following"; ids already listed are not added twice.
      setPeople((prev) => { const seen = new Set(prev.map((p) => p.user_id)); return [...prev, ...r.people.filter((p) => !seen.has(p.user_id))] })
      setHasMore(r.people.length === PAGE)
    }
    setLoadingMore(false)
  }

  const follow = async (p: SuggestedPerson) => {
    if (!user || busy.has(p.user_id)) return
    setBusy((s) => new Set(s).add(p.user_id))
    const ok = await followTarget(user.id, 'user', p.user_id)
    if (ok) setFollowed((s) => new Set(s).add(p.user_id))
    setBusy((s) => { const n = new Set(s); n.delete(p.user_id); return n })
  }

  const dismiss = async (p: SuggestedPerson) => {
    setPeople((prev) => prev.filter((x) => x.user_id !== p.user_id))
    await dismissSuggestedPerson(p.user_id)
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div onClick={() => navigate(-1)} style={{ cursor: 'pointer', display: 'flex' }}><Icon name="arrowLeft" size={22} color={COLORS.text} /></div>
        <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text, margin: 0 }}>People you may know</p>
      </div>
      <div style={{ padding: '14px 16px' }}>
        {netError ? (
          <NetworkError onRetry={load} />
        ) : loading ? (
          <p style={{ fontSize: '12.5px', color: COLORS.textMuted }}>Loading...</p>
        ) : people.length === 0 ? (
          <div style={{ background: COLORS.card, borderRadius: '14px', padding: '24px 16px', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, margin: 0 }}>No suggestions right now</p>
            <p style={{ fontSize: '12px', color: COLORS.textMuted, lineHeight: 1.6, margin: '6px 0 0' }}>Join groups and follow a few people. New suggestions will appear here as Farmxie grows.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {people.map((p) => {
              const isFollowed = followed.has(p.user_id)
              return (
                <div key={p.user_id} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: COLORS.card, borderRadius: '14px', padding: '12px' }}>
                  <div onClick={() => navigate(`/u/${p.username}`)} style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0, cursor: 'pointer' }}>
                    <PersonAvatar p={p} size={52} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <p style={{ fontSize: '13.5px', fontWeight: 800, color: COLORS.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{personName(p)}</p>
                        <PersonTick p={p} />
                      </div>
                      <p style={{ fontSize: '11.5px', color: COLORS.textMuted, margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.reason_text}</p>
                      <p style={{ fontSize: '11px', color: COLORS.textMuted, margin: '2px 0 0' }}>{p.followers_count.toLocaleString()} {p.followers_count === 1 ? 'follower' : 'followers'}</p>
                    </div>
                  </div>
                  <div onClick={isFollowed ? () => navigate(`/u/${p.username}`) : () => follow(p)} role="button" style={{
                    padding: '8px 16px', borderRadius: '999px', fontSize: '12.5px', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
                    background: isFollowed ? 'transparent' : COLORS.green, color: isFollowed ? COLORS.textMuted : 'white',
                    border: `1px solid ${isFollowed ? COLORS.border : COLORS.green}`, opacity: busy.has(p.user_id) ? 0.6 : 1,
                  }}>{isFollowed ? 'Following' : 'Follow'}</div>
                  {!isFollowed && (
                    <div onClick={() => dismiss(p)} role="button" aria-label="Remove suggestion" style={{ cursor: 'pointer', display: 'flex', padding: 2 }}>
                      <Icon name="close" size={16} color={COLORS.textMuted} />
                    </div>
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
