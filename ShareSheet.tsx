import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import Icon from './Icons'

const COLORS = {
  card: '#FFFFFF',
  border: '#E5EFE5',
  green: '#16A34A',
  greenSoft: '#DCFCE7',
  text: '#1A2E1A',
  textMuted: '#5B6B5B',
}

type MyGroup = { id: string; name: string; image: string | null }

// Bottom sheet opened by the share arrow on a post.
// Share to your profile or to a group you belong to (with an optional comment), copy the link, or share outside Farmxie.
// Posts inside groups can only be shared as a link (canRepost = false).
export default function ShareSheet({ open, onClose, postId, postUrl, snippet, canRepost, onShared }: {
  open: boolean
  onClose: () => void
  postId: string
  postUrl: string
  snippet: string
  canRepost: boolean
  onShared: () => void
}) {
  const { user } = useAuth()
  const [comment, setComment] = useState('')
  const [groups, setGroups] = useState<MyGroup[]>([])
  const [groupsLoaded, setGroupsLoaded] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Load the groups I belong to the first time the sheet opens.
  useEffect(() => {
    if (!open || !user || !canRepost || groupsLoaded) return
    let cancelled = false
    supabase
      .from('community_members')
      .select('community_id, communities(id, name, icon_url, cover_url, status)')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (cancelled) return
        const list: MyGroup[] = ((data || []) as any[])
          .map((r) => (Array.isArray(r.communities) ? r.communities[0] : r.communities))
          .filter((c) => c && c.status === 'active')
          .map((c) => ({ id: c.id as string, name: c.name as string, image: (c.icon_url || c.cover_url || null) as string | null }))
        setGroups(list)
        setGroupsLoaded(true)
      }, () => { if (!cancelled) setGroupsLoaded(true) })
    return () => { cancelled = true }
  }, [open, user, canRepost, groupsLoaded])

  useEffect(() => {
    if (open) { setError(''); setNotice('') }
  }, [open])

  if (!open) return null

  const close = () => {
    if (busyKey) return
    onClose()
  }

  // Share = a new post that points at this one. Account limits and group rules are checked by the database.
  const repost = async (key: string, communityId: string | null) => {
    if (!user || busyKey) return
    setBusyKey(key)
    setError('')
    const { error: e } = await supabase.from('posts').insert({
      user_id: user.id,
      content: comment.trim(),
      shared_post_id: postId,
      community_id: communityId,
    })
    setBusyKey(null)
    if (e) {
      setError(e.message || 'Could not share. Try again.')
      return
    }
    setComment('')
    onShared()
    setNotice(communityId ? 'Shared to the group' : 'Shared to your profile')
    setTimeout(() => { setNotice(''); onClose() }, 900)
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(postUrl)
      setNotice('Link copied')
      setTimeout(() => setNotice(''), 1400)
    } catch { setError('Could not copy the link.') }
  }

  const shareOutside = async () => {
    try { await (navigator as any).share({ title: 'Farmxie', text: snippet, url: postUrl }) } catch { /* cancelled */ }
  }

  const canNativeShare = typeof navigator !== 'undefined' && !!(navigator as any).share

  const Row = ({ icon, label, sub, onClick, busy, image }: { icon?: string; label: string; sub?: string; onClick: () => void; busy?: boolean; image?: string | null }) => (
    <div role="button" onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 4px', cursor: 'pointer', opacity: busy ? 0.55 : 1 }}>
      <div style={{ width: '38px', height: '38px', borderRadius: image !== undefined ? '11px' : '50%', background: COLORS.greenSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
        {image ? <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name={icon || 'users'} size={17} color={COLORS.green} />}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontSize: '13.5px', fontWeight: 700, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{busy ? 'Sharing…' : label}</p>
        {sub && <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '1px' }}>{sub}</p>}
      </div>
    </div>
  )

  return (
    <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 80, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: COLORS.card, width: '100%', maxWidth: '480px', borderRadius: '20px 20px 0 0', padding: '8px 16px 18px', maxHeight: '88vh', overflowY: 'auto', boxSizing: 'border-box' }}>
        <div style={{ width: '38px', height: '4px', borderRadius: '2px', background: COLORS.border, margin: '4px auto 12px' }} />
        <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text, marginBottom: '8px' }}>Share post</p>

        {canRepost ? (
          <>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 500))}
              placeholder="Say something about this post (optional)"
              rows={2}
              style={{ width: '100%', boxSizing: 'border-box', resize: 'none', border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '10px 12px', fontSize: '13px', color: COLORS.text, fontFamily: 'inherit', outline: 'none', background: '#F8FAF6' }}
            />
            <Row icon="user" label="Share to your profile" sub="Followers will see it in their feed" busy={busyKey === 'me'} onClick={() => repost('me', null)} />

            {groupsLoaded && groups.length > 0 && (
              <>
                <p style={{ fontSize: '11px', fontWeight: 800, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', margin: '8px 0 2px' }}>Share to a group</p>
                {groups.map((g) => (
                  <Row key={g.id} label={g.name} image={g.image} icon="users" busy={busyKey === g.id} onClick={() => repost(g.id, g.id)} />
                ))}
              </>
            )}
          </>
        ) : (
          <p style={{ fontSize: '12.5px', color: COLORS.textMuted, lineHeight: 1.5, marginBottom: '6px' }}>Posts inside a group can only be shared as a link.</p>
        )}

        <div style={{ borderTop: `1px solid ${COLORS.border}`, marginTop: '6px', paddingTop: '2px' }}>
          <Row icon="copy" label="Copy link" onClick={copyLink} />
          {canNativeShare && <Row icon="send" label="Share outside Farmxie" sub="WhatsApp, Telegram and more" onClick={shareOutside} />}
        </div>

        {error && <p style={{ fontSize: '12px', color: '#DC2626', marginTop: '8px', lineHeight: 1.4 }}>{error}</p>}
        {notice && <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.green, marginTop: '8px' }}>{notice}</p>}
      </div>
    </div>
  )
}
