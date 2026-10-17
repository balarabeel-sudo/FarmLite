import { Fragment, useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import Icon from './Icons'
import SponsoredCard from './SponsoredCard'
import type { AdData } from './SponsoredCard'
import PostCard, { POST_SELECT } from './PostCard'
import type { PostCardData } from './PostCard'
import GroupComposer from './GroupComposer'
import GroupPoll, { fetchPollStates } from './GroupPoll'
import type { PollData, PollState } from './GroupPoll'
import { ListCardSkeleton } from './LoadingSkeleton'
import NetworkError from './NetworkError'
import { COLORS, ErrorBanner, LoadMoreButton } from './shared'
import type { Group, MyRole } from './groupsShared'

const PAGE = 10
// A paid ad (labelled "Sponsored") appears after every this many posts in the Discussion tab.
const AD_EVERY = 10
const POLL_COLS = 'id, post_id, community_id, created_by, description, multiple, closes_at, closed_at, group_poll_options(id, label, position)'

type Row = PostCardData & { pinned_at: string | null; poll: PollData | null }

// Discussion tab and Polls tab share this feed. Likes, comments, reports and sharing all use the existing PostCard systems.
export default function GroupFeed({ group, myRole, userId, kind, canPost, onChanged }: {
  group: Group; myRole: MyRole; userId: string; kind: 'discussion' | 'polls'; canPost: boolean; onChanged: () => void
}) {
  const isMod = myRole === 'owner' || myRole === 'admin' || myRole === 'moderator'
  const [rows, setRows] = useState<Row[]>([])
  const [pinned, setPinned] = useState<Row[]>([])
  const [pollStates, setPollStates] = useState<Record<string, PollState>>({})
  const [liked, setLiked] = useState<Set<string>>(new Set())
  const [saved, setSaved] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Row | null>(null)
  const [editText, setEditText] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const reqId = useRef(0)
  const [groupAds, setGroupAds] = useState<AdData[]>([])

  // Ads bought for this group; a failure here never affects the feed.
  useEffect(() => {
    setGroupAds([])
    if (kind !== 'discussion') return
    let cancelled = false
    supabase.rpc('ads_for_group', { p_group: group.id, p_limit: 4 }).then(
      ({ data, error: e }: { data: any; error: any }) => { if (!cancelled && !e) setGroupAds((data || []) as AdData[]) },
      () => {},
    )
    return () => { cancelled = true }
  }, [group.id, kind])

  const select = `${POST_SELECT}, pinned_at, group_polls${kind === 'polls' ? '!inner' : ''}(${POLL_COLS})`

  const normalize = (p: any): Row => {
    const gp = Array.isArray(p.group_polls) ? p.group_polls[0] : p.group_polls
    // inside the group page the card shows the author (not the group) as the header
    return { ...p, community_id: null, communities: null, poll: gp || null } as Row
  }

  const hydrate = async (list: Row[]) => {
    const ids = list.map((r) => r.id)
    if (!ids.length) return
    const pollIds = list.filter((r) => r.poll).map((r) => r.poll!.id)
    const [l, s, ps] = await Promise.all([
      supabase.from('post_likes').select('post_id').eq('user_id', userId).in('post_id', ids),
      supabase.from('saved_items').select('post_id').eq('user_id', userId).in('post_id', ids),
      fetchPollStates(pollIds, userId),
    ])
    setLiked((prev) => new Set([...prev, ...(l.data || []).map((x: any) => x.post_id)]))
    setSaved((prev) => new Set([...prev, ...(s.data || []).map((x: any) => x.post_id)]))
    setPollStates((prev) => ({ ...prev, ...ps }))
  }

  const base = () => supabase.from('posts').select(select).eq('community_id', group.id)

  const load = async () => {
    const my = ++reqId.current
    setLoading(true); setNetError(false); setError('')
    let q = base().order('created_at', { ascending: false }).limit(PAGE)
    if (kind === 'discussion') q = q.is('pinned_at', null)
    const [main, pin] = await Promise.all([
      q,
      kind === 'discussion'
        ? base().not('pinned_at', 'is', null).order('pinned_at', { ascending: false }).limit(3)
        : Promise.resolve({ data: [], error: null } as any),
    ])
    if (my !== reqId.current) return
    if (main.error || pin.error) { setNetError(true); setLoading(false); return }
    const list = ((main.data || []) as any[]).map(normalize)
    const pins = ((pin.data || []) as any[]).map(normalize)
    setRows(list); setPinned(pins); setHasMore(list.length === PAGE)
    await hydrate([...pins, ...list])
    if (my === reqId.current) setLoading(false)
  }

  const loadMore = async () => {
    if (loadingMore || rows.length === 0) return
    setLoadingMore(true)
    let q = base().order('created_at', { ascending: false }).lt('created_at', rows[rows.length - 1].created_at).limit(PAGE)
    if (kind === 'discussion') q = q.is('pinned_at', null)
    const { data, error: e } = await q
    if (!e) {
      const more = ((data || []) as any[]).map(normalize)
      setRows((prev) => {
        const seen = new Set(prev.map((r) => r.id))
        return [...prev, ...more.filter((r) => !seen.has(r.id))]
      })
      setHasMore(more.length === PAGE)
      await hydrate(more)
    }
    setLoadingMore(false)
  }

  useEffect(() => { load() }, [group.id, kind])

  const refreshPoll = async (pollId: string) => {
    const ps = await fetchPollStates([pollId], userId)
    setPollStates((prev) => ({ ...prev, ...ps }))
    // closing a poll changes the poll row itself
    const { data } = await supabase.from('group_polls').select(POLL_COLS).eq('id', pollId).maybeSingle()
    if (data) {
      const patch = (r: Row) => r.poll?.id === pollId ? { ...r, poll: data as any } : r
      setRows((prev) => prev.map(patch)); setPinned((prev) => prev.map(patch))
    }
  }

  const togglePin = async (r: Row) => {
    setError('')
    const { error: e } = await supabase.rpc('group_pin_post', { p_post: r.id, p_pin: !r.pinned_at })
    if (e) { setError(e.message); return }
    load()
  }

  const remove = async (r: Row) => {
    if (!window.confirm(r.user_id === userId ? 'Delete this post?' : 'Remove this post from the group?')) return
    setError('')
    const { data, error: e } = await supabase.from('posts').delete().eq('id', r.id).select('id')
    if (e || !data?.length) { setError('Could not delete this post.'); return }
    setRows((prev) => prev.filter((x) => x.id !== r.id)); setPinned((prev) => prev.filter((x) => x.id !== r.id))
    onChanged()
  }

  const saveEdit = async () => {
    if (!editing || savingEdit) return
    const text = editText.trim()
    if (!text) return
    setSavingEdit(true)
    const { data, error: e } = await supabase.from('posts').update({ content: text }).eq('id', editing.id).eq('user_id', userId).select('id')
    setSavingEdit(false)
    if (e || !data?.length) { setError('Could not save your changes.'); setEditing(null); return }
    const patch = (r: Row) => r.id === editing.id ? { ...r, content: text } : r
    setRows((prev) => prev.map(patch)); setPinned((prev) => prev.map(patch))
    setEditing(null)
  }

  const card = (r: Row) => {
    const own = r.user_id === userId
    const actions: { label: string; danger?: boolean; onClick: () => void }[] = []
    if (isMod) actions.push({ label: r.pinned_at ? 'Unpin post' : 'Pin post', onClick: () => togglePin(r) })
    if (own && !r.poll) actions.push({ label: 'Edit post', onClick: () => { setEditing(r); setEditText(r.content) } })
    if (own || isMod) actions.push({ label: own ? 'Delete post' : 'Remove post', danger: true, onClick: () => remove(r) })
    return (
      <PostCard key={r.id + (r.content.length)} post={r} initialLiked={liked.has(r.id)} initialSaved={saved.has(r.id)}
        pinned={!!r.pinned_at} menuActions={actions} emphasize={!!r.poll}>
        {r.poll && (
          <GroupPoll poll={r.poll} state={pollStates[r.poll.id]} canVote={canPost}
            canManage={r.poll.created_by === userId || isMod} onChanged={refreshPoll} />
        )}
      </PostCard>
    )
  }

  return (
    <div>
      {canPost && <GroupComposer groupId={group.id} avatar={group.icon_url || group.cover_url} onPosted={() => { load(); onChanged() }} defaultMode={kind === 'polls' ? 'poll' : 'post'} />}
      <ErrorBanner text={error} />

      {netError ? (
        <NetworkError onRetry={load} />
      ) : loading ? (
        <ListCardSkeleton count={3} />
      ) : rows.length === 0 && pinned.length === 0 ? (
        <div style={{ background: COLORS.card, padding: '32px 20px', textAlign: 'center', borderRadius: '14px', color: COLORS.textMuted, fontSize: '12.5px', lineHeight: 1.6 }}>
          {kind === 'discussion' ? (
            <>
              <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, marginBottom: '6px' }}>Your group is ready to grow! 🌱</p>
              <p>Be the first to start a discussion and help this community thrive.</p>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}><Icon name="check" size={24} color={COLORS.textMuted} /></div>
              <p>No polls yet. Members can start one from the box above.</p>
            </>
          )}
        </div>
      ) : (
        <>
          {pinned.map(card)}
          {rows.map((r, i) => {
            const adIndex = (i + 1) / AD_EVERY - 1
            const ad = kind === 'discussion' && (i + 1) % AD_EVERY === 0 && groupAds.length > 0 ? groupAds[adIndex % groupAds.length] : null
            return (
              <Fragment key={r.id}>
                {card(r)}
                {ad && <SponsoredCard ad={ad} layout="wide" placement="groups" />}
              </Fragment>
            )
          })}
        </>
      )}

      <LoadMoreButton onClick={loadMore} loading={loadingMore} hasMore={hasMore && !loading} />

      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setEditing(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: COLORS.card, width: '100%', maxWidth: '480px', borderRadius: '18px 18px 0 0', padding: '16px' }}>
            <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, marginBottom: '10px' }}>Edit post</p>
            <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={5} maxLength={2000} aria-label="Post text"
              style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '13px', boxSizing: 'border-box', background: COLORS.bg, resize: 'none', marginBottom: '12px' }} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <div role="button" onClick={() => setEditing(null)} style={{ flex: 1, textAlign: 'center', padding: '10px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '12.5px', fontWeight: 700, color: COLORS.textMuted, cursor: 'pointer' }}>Cancel</div>
              <div role="button" onClick={saveEdit} style={{ flex: 1, textAlign: 'center', padding: '10px', borderRadius: '10px', background: COLORS.green, fontSize: '12.5px', fontWeight: 700, color: 'white', cursor: 'pointer', opacity: savingEdit || !editText.trim() ? 0.6 : 1 }}>{savingEdit ? 'Saving...' : 'Save'}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
