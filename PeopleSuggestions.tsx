import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import Icon from './Icons'
import { COLORS } from './shared'
import { followTarget } from './followShared'
import { PersonAvatar, PersonTick, dismissSuggestedPerson, fetchSuggestedPeople, personName } from './peopleShared'
import type { SuggestedPerson } from './peopleShared'

// Horizontal "People you may know" strip for the Home feed. Shows nothing when there is nobody to suggest or on an error.
export default function PeopleSuggestions() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [people, setPeople] = useState<SuggestedPerson[] | null>(null)
  const [followed, setFollowed] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user) return
    let alive = true
    fetchSuggestedPeople(10, 0).then((r) => { if (alive) setPeople(r.error ? [] : r.people) })
    return () => { alive = false }
  }, [user?.id])

  const follow = useCallback(async (p: SuggestedPerson) => {
    if (!user || busy.has(p.user_id)) return
    setBusy((s) => new Set(s).add(p.user_id))
    const ok = await followTarget(user.id, 'user', p.user_id)
    if (ok) setFollowed((s) => new Set(s).add(p.user_id))
    setBusy((s) => { const n = new Set(s); n.delete(p.user_id); return n })
  }, [user, busy])

  const dismiss = async (p: SuggestedPerson) => {
    setPeople((prev) => (prev || []).filter((x) => x.user_id !== p.user_id))
    await dismissSuggestedPerson(p.user_id)
  }

  if (!people || people.length === 0) return null

  return (
    <div style={{ background: COLORS.card, borderRadius: '14px', padding: '14px 0 12px', margin: '0 0 12px', border: `1px solid ${COLORS.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 14px 10px' }}>
        <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, margin: 0 }}>People you may know</p>
        <span onClick={() => navigate('/people')} style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.green, cursor: 'pointer' }}>See all</span>
      </div>
      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', padding: '0 14px 2px', scrollbarWidth: 'none' }}>
        {people.map((p) => {
          const isFollowed = followed.has(p.user_id)
          return (
            <div key={p.user_id} style={{ position: 'relative', flex: '0 0 148px', border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '14px 10px 10px', textAlign: 'center', background: COLORS.card }}>
              <div onClick={() => dismiss(p)} role="button" aria-label="Remove suggestion" style={{ position: 'absolute', top: 6, right: 6, cursor: 'pointer', display: 'flex', padding: 2 }}>
                <Icon name="close" size={14} color={COLORS.textMuted} />
              </div>
              <div onClick={() => navigate(`/u/${p.username}`)} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}><PersonAvatar p={p} size={64} /></div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 8 }}>
                  <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>{personName(p)}</p>
                  <PersonTick p={p} />
                </div>
                <p style={{ fontSize: '11px', color: COLORS.textMuted, margin: '3px 0 0', lineHeight: 1.35, height: 30, overflow: 'hidden' }}>{p.reason_text}</p>
              </div>
              <div
                onClick={isFollowed ? () => navigate(`/u/${p.username}`) : () => follow(p)}
                role="button"
                style={{
                  marginTop: 8, padding: '8px 0', borderRadius: '999px', fontSize: '12.5px', fontWeight: 800, cursor: 'pointer',
                  background: isFollowed ? 'transparent' : COLORS.green, color: isFollowed ? COLORS.textMuted : 'white',
                  border: `1px solid ${isFollowed ? COLORS.border : COLORS.green}`, opacity: busy.has(p.user_id) ? 0.6 : 1,
                }}>
                {isFollowed ? 'Following' : 'Follow'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
