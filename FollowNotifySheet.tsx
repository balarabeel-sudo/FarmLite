import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'

const COLORS = {
  card: '#FFFFFF',
  border: '#E5EFE5',
  green: '#16A34A',
  text: '#1A2E1A',
  textMuted: '#5B6B5B',
}

// Bottom sheet from the profile "..." menu: get a notification when this person / company you follow
// publishes a new post and / or lists a new product. Only shown to people who follow them.
export default function FollowNotifySheet({ open, onClose, kind, targetId, name }: {
  open: boolean
  onClose: () => void
  kind: 'user' | 'company'
  targetId: string
  name: string
}) {
  const { user } = useAuth()
  const [posts, setPosts] = useState(false)
  const [listings, setListings] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !user) return
    let cancelled = false
    setLoaded(false)
    setError('')
    supabase
      .from('follow_notify_prefs')
      .select('notify_posts, notify_listings')
      .eq('user_id', user.id)
      .eq('kind', kind)
      .eq('target_id', targetId)
      .maybeSingle()
      .then(({ data, error: e }: { data: any; error: any }) => {
        if (cancelled) return
        if (e) setError('Could not load your settings. Try again.')
        setPosts(!!data?.notify_posts)
        setListings(!!data?.notify_listings)
        setLoaded(true)
      }, () => { if (!cancelled) { setError('Could not load your settings. Try again.'); setLoaded(true) } })
    return () => { cancelled = true }
  }, [open, user, kind, targetId])

  if (!open) return null

  const save = async (nextPosts: boolean, nextListings: boolean) => {
    if (!user || busy) return
    const prev = { posts, listings }
    setPosts(nextPosts)
    setListings(nextListings)
    setBusy(true)
    setError('')
    const { error: e } = nextPosts || nextListings
      ? await supabase.from('follow_notify_prefs').upsert(
        { user_id: user.id, kind, target_id: targetId, notify_posts: nextPosts, notify_listings: nextListings, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,kind,target_id' },
      )
      : await supabase.from('follow_notify_prefs').delete().eq('user_id', user.id).eq('kind', kind).eq('target_id', targetId)
    setBusy(false)
    if (e) {
      setPosts(prev.posts)
      setListings(prev.listings)
      setError('Could not save. Try again.')
    }
  }

  const Switch = ({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) => (
    <div role="switch" aria-checked={on} onClick={() => loaded && !busy && onChange(!on)} style={{ width: '44px', height: '26px', borderRadius: '13px', background: on ? COLORS.green : '#D1D9D1', position: 'relative', cursor: loaded ? 'pointer' : 'default', flexShrink: 0, transition: 'background 0.15s', opacity: loaded ? 1 : 0.5 }}>
      <div style={{ position: 'absolute', top: '3px', left: on ? '21px' : '3px', width: '20px', height: '20px', borderRadius: '50%', background: 'white', transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
    </div>
  )

  const allOn = posts && listings

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 80, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: COLORS.card, width: '100%', maxWidth: '480px', borderRadius: '20px 20px 0 0', padding: '8px 16px 22px', boxSizing: 'border-box' }}>
        <div style={{ width: '38px', height: '4px', borderRadius: '2px', background: COLORS.border, margin: '4px auto 12px' }} />
        <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>Notifications</p>
        <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginTop: '3px', lineHeight: 1.45 }}>Choose what {name} sends you a notification for.</p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 0', borderBottom: `1px solid ${COLORS.border}`, marginTop: '6px' }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '13.5px', fontWeight: 700, color: COLORS.text }}>All notifications</p>
            <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '1px' }}>New posts and new listings</p>
          </div>
          <Switch on={allOn} onChange={(v) => save(v, v)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 0', borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '13.5px', fontWeight: 700, color: COLORS.text }}>Posts</p>
            <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '1px' }}>When {name} shares a new post</p>
          </div>
          <Switch on={posts} onChange={(v) => save(v, listings)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 0' }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '13.5px', fontWeight: 700, color: COLORS.text }}>Listings</p>
            <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '1px' }}>When {name} lists a new product</p>
          </div>
          <Switch on={listings} onChange={(v) => save(posts, v)} />
        </div>

        {error && <p style={{ fontSize: '12px', color: '#DC2626', marginTop: '4px' }}>{error}</p>}
        <div role="button" onClick={onClose} style={{ marginTop: '10px', textAlign: 'center', padding: '12px', borderRadius: '12px', background: '#F1F5F1', fontSize: '13px', fontWeight: 700, color: COLORS.text, cursor: 'pointer' }}>Done</div>
      </div>
    </div>
  )
}
