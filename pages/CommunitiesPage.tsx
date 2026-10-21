import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import Icon from '../Icons'
import { ListCardSkeleton } from '../LoadingSkeleton'
import NetworkError from '../NetworkError'
import ImageUploader from '../ImageUploader'
import { COLORS, inputStyle, labelStyle, ErrorBanner, PAGE_SIZE, LoadMoreButton } from '../shared'
import {
  GROUP_CATEGORIES, GROUP_COLUMNS, categoryLabel, activityLabel, categoryKeysForTerm, cleanSearch,
  type Group,
} from '../groupsShared'

type Tab = 'discover' | 'mine' | 'suggested'

export default function CommunitiesPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [tab, setTab] = useState<Tab>('discover')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [items, setItems] = useState<Group[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [suggestNote, setSuggestNote] = useState('')

  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set())
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set())
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [formError, setFormError] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [privacy, setPrivacy] = useState<'public' | 'private'>('public')
  const [country, setCountry] = useState('')
  const [icon, setIcon] = useState<string[]>([])
  const [cover, setCover] = useState<string[]>([])

  const reqId = useRef(0) // ignores answers of older searches

  const matches = (g: Group, term: string) => {
    const t = term.toLowerCase()
    return [g.name, g.description, g.country, categoryLabel(g.category)].some((v) => (v || '').toLowerCase().includes(t))
  }

  const loadMembership = async () => {
    if (!user) return
    const [m, r] = await Promise.all([
      supabase.from('community_members').select('community_id').eq('user_id', user.id),
      supabase.from('community_join_requests').select('community_id').eq('user_id', user.id).eq('status', 'pending'),
    ])
    setJoinedIds(new Set((m.data || []).map((x: any) => x.community_id)))
    setRequestedIds(new Set((r.data || []).map((x: any) => x.community_id)))
  }

  const discoverQuery = (from: number, to: number) => {
    let q = supabase.from('communities').select(GROUP_COLUMNS).eq('status', 'active')
    if (category) q = q.eq('category', category)
    const term = cleanSearch(search)
    if (term) {
      const parts = [`name.ilike.%${term}%`, `description.ilike.%${term}%`, `country.ilike.%${term}%`]
      const keys = categoryKeysForTerm(term)
      if (keys.length) parts.push(`category.in.(${keys.join(',')})`)
      q = q.or(parts.join(','))
    }
    return q.order('members_count', { ascending: false }).order('created_at', { ascending: false }).range(from, to)
  }

  const load = async () => {
    if (!user) return
    const my = ++reqId.current
    setNetError(false)
    setLoading(true)
    setSuggestNote('')

    if (tab === 'discover') {
      const { data, error } = await discoverQuery(0, PAGE_SIZE - 1)
      if (my !== reqId.current) return
      if (error) { setNetError(true); setLoading(false); return }
      const page = (data || []) as any as Group[]
      setItems(page)
      setHasMore(page.length === PAGE_SIZE)
    } else if (tab === 'mine') {
      const { data, error } = await supabase
        .from('community_members')
        .select(`community_id, joined_at, communities!inner(${GROUP_COLUMNS})`)
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false })
        .limit(100)
      if (my !== reqId.current) return
      if (error) { setNetError(true); setLoading(false); return }
      let list = (data || []).map((r: any) => r.communities as Group)
      const term = cleanSearch(search)
      if (term) list = list.filter((g) => matches(g, term))
      if (category) list = list.filter((g) => g.category === category)
      setItems(list)
      setHasMore(false)
    } else {
      // Suggestions use real signals only: categories of groups you are in, and your country.
      const [mine, prof] = await Promise.all([
        supabase.from('community_members').select('communities(category)').eq('user_id', user.id),
        supabase.from('profiles').select('country').eq('user_id', user.id).maybeSingle(),
      ])
      if (my !== reqId.current) return
      const myCategories = Array.from(new Set((mine.data || []).map((r: any) => r.communities?.category).filter(Boolean))) as string[]
      const myCountry = (prof.data?.country || '').trim()
      const joined = Array.from(joinedIds)

      let q = supabase.from('communities').select(GROUP_COLUMNS).eq('status', 'active').eq('privacy', 'public')
      if (joined.length) q = q.not('id', 'in', `(${joined.join(',')})`)
      const signals: string[] = []
      if (myCategories.length) signals.push(`category.in.(${myCategories.join(',')})`)
      if (myCountry) signals.push(`country.ilike.${cleanSearch(myCountry)}`)
      if (signals.length) q = q.or(signals.join(','))
      if (category) q = q.eq('category', category)
      const { data, error } = await q.order('members_count', { ascending: false }).limit(30)
      if (my !== reqId.current) return
      if (error) { setNetError(true); setLoading(false); return }
      let list = (data || []) as any as Group[]
      const term = cleanSearch(search)
      if (term) list = list.filter((g) => matches(g, term))
      setItems(list)
      setHasMore(false)
      setSuggestNote(signals.length ? 'Based on the groups you joined and your country.' : 'Join a group or add your country to your profile to get personalised suggestions.')
    }
    setLoading(false)
  }

  const loadMore = async () => {
    if (!user || loadingMore || tab !== 'discover') return
    setLoadingMore(true)
    const { data, error } = await discoverQuery(items.length, items.length + PAGE_SIZE - 1)
    if (!error) {
      const more = (data || []) as any as Group[]
      setItems((prev) => {
        const seen = new Set(prev.map((g) => g.id))
        return [...prev, ...more.filter((g) => !seen.has(g.id))]
      })
      setHasMore(more.length === PAGE_SIZE)
    }
    setLoadingMore(false)
  }

  useEffect(() => { loadMembership() }, [user])

  useEffect(() => {
    if (!user) return
    const timer = setTimeout(() => load(), search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [user, tab, search, category])

  const join = async (g: Group) => {
    if (!user || busyId) return
    setBusyId(g.id)
    setActionError('')
    const { data, error } = await supabase.rpc('group_join', { p_id: g.id })
    setBusyId(null)
    if (error) { setActionError(error.message); return }
    if (data === 'joined') {
      setJoinedIds((prev) => new Set(prev).add(g.id))
      setItems((prev) => prev.map((x) => x.id === g.id ? { ...x, members_count: x.members_count + 1 } : x))
    } else {
      setRequestedIds((prev) => new Set(prev).add(g.id))
    }
  }

  const cancelRequest = async (g: Group) => {
    if (busyId) return
    setBusyId(g.id)
    await supabase.rpc('group_cancel_request', { p_id: g.id })
    setBusyId(null)
    setRequestedIds((prev) => { const n = new Set(prev); n.delete(g.id); return n })
  }

  const resetForm = () => {
    setName(''); setDescription(''); setFormCategory(''); setPrivacy('public'); setCountry('')
    setIcon([]); setCover([]); setFormError('')
  }

  const handleCreate = async () => {
    if (!user || saving || uploading) return
    if (name.trim().length < 3) { setFormError('Group name must be at least 3 characters.'); return }
    if (!formCategory) { setFormError('Choose an agriculture category.'); return }
    setFormError('')
    setSaving(true)

    const { data, error } = await supabase.from('communities').insert({
      owner_id: user.id,
      name: name.trim(),
      description: description.trim() || null,
      category: formCategory,
      privacy,
      country: country.trim() || null,
      icon_url: icon[0] || null,
      cover_url: cover[0] || null,
    }).select('id').single()

    if (error || !data) {
      setSaving(false)
      setFormError(error?.message || 'Could not create the group.')
      return
    }
    // The creator joins their own group as admin
    await supabase.from('community_members').insert({ community_id: data.id, user_id: user.id, role: 'admin' })
    setSaving(false)
    resetForm()
    setShowForm(false)
    navigate(`/communities/${data.id}`)
  }

  const header = (
    <div style={{ background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div role="button" aria-label="Back" onClick={() => navigate('/')} style={{ cursor: 'pointer', display: 'flex' }}>
            <Icon name="arrowLeft" size={22} color={COLORS.text} />
          </div>
          <div>
            <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>Groups</p>
            <p style={{ fontSize: '11px', color: COLORS.textMuted }}>Connect, learn, and grow together.</p>
          </div>
        </div>
        <div role="button" aria-label="Create group" onClick={() => { if (showForm) resetForm(); setShowForm(!showForm) }}
          style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px', borderRadius: '10px', background: COLORS.green, cursor: 'pointer' }}>
          <Icon name={showForm ? 'close' : 'plus'} size={14} color="white" />
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'white' }}>{showForm ? 'Cancel' : 'Create'}</span>
        </div>
      </div>
      <div style={{ display: 'flex', padding: '0 8px' }}>
        {([['discover', 'Discover'], ['mine', 'My Groups'], ['suggested', 'Suggested']] as [Tab, string][]).map(([k, label]) => (
          <div key={k} role="tab" aria-selected={tab === k} tabIndex={0} onClick={() => setTab(k)} onKeyDown={(e) => { if (e.key === 'Enter') setTab(k) }}
            style={{ flex: 1, textAlign: 'center', padding: '10px 4px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', color: tab === k ? COLORS.green : COLORS.textMuted, borderBottom: `2.5px solid ${tab === k ? COLORS.green : 'transparent'}` }}>
            {label}
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '30px' }}>
      {header}

      <div style={{ padding: '14px 16px' }}>
        {showForm && (
          <div style={{ background: COLORS.card, borderRadius: '16px', padding: '16px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px', color: COLORS.text }}>Create a group</p>
            <ErrorBanner text={formError} />

            <p style={labelStyle}>Group photo</p>
            <div style={{ marginBottom: '12px' }}><ImageUploader value={icon} onChange={setIcon} folder="avatars" max={1} onBusyChange={setUploading} /></div>
            <p style={labelStyle}>Cover photo (optional)</p>
            <div style={{ marginBottom: '12px' }}><ImageUploader value={cover} onChange={setCover} folder="covers" max={1} onBusyChange={setUploading} /></div>

            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name" maxLength={80} style={inputStyle} aria-label="Group name" />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this group about? (optional)" rows={3} maxLength={500} style={{ ...inputStyle, resize: 'none' }} aria-label="Description" />

            <p style={labelStyle}>Agriculture category</p>
            <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)} style={inputStyle} aria-label="Category">
              <option value="">Choose a category</option>
              {GROUP_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>

            <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country or region (optional)" maxLength={80} style={inputStyle} aria-label="Country or region" />

            <p style={labelStyle}>Who can join?</p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              {([['public', 'Public', 'Anyone can join and read posts'], ['private', 'Private', 'People request to join; only members read posts']] as const).map(([k, t, d]) => (
                <div key={k} role="radio" aria-checked={privacy === k} tabIndex={0} onClick={() => setPrivacy(k)} onKeyDown={(e) => { if (e.key === 'Enter') setPrivacy(k) }}
                  style={{ flex: 1, padding: '10px', borderRadius: '10px', cursor: 'pointer', border: `1.5px solid ${privacy === k ? COLORS.green : COLORS.border}`, background: privacy === k ? 'var(--fx-tint-green3)' : COLORS.card }}>
                  <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text }}>{t}</p>
                  <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginTop: '2px', lineHeight: 1.4 }}>{d}</p>
                </div>
              ))}
            </div>

            <div role="button" onClick={saving ? undefined : handleCreate} style={{ background: COLORS.green, color: 'white', textAlign: 'center', padding: '11px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', opacity: saving || uploading ? 0.6 : 1 }}>
              {saving ? 'Creating...' : uploading ? 'Uploading photo...' : 'Create Group'}
            </div>
          </div>
        )}

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, topic, category or location"
          aria-label="Search groups"
          style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: `1px solid ${COLORS.border}`, marginBottom: '10px', fontSize: '13px', boxSizing: 'border-box', background: COLORS.card }}
        />

        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '4px' }}>
          {[{ key: '', label: 'All' }, ...GROUP_CATEGORIES].map((c) => {
            const active = (category || '') === c.key
            return (
              <div key={c.key || 'all'} role="button" aria-pressed={active} onClick={() => setCategory(c.key || null)}
                style={{ flexShrink: 0, padding: '6px 12px', borderRadius: '16px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', background: active ? COLORS.green : COLORS.card, color: active ? 'white' : COLORS.textMuted, border: `1px solid ${active ? COLORS.green : COLORS.border}` }}>
                {c.label}
              </div>
            )
          })}
        </div>

        {tab === 'suggested' && suggestNote && !loading && (
          <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '10px' }}>{suggestNote}</p>
        )}
        <ErrorBanner text={actionError} />

        {netError ? (
          <NetworkError onRetry={load} />
        ) : loading ? (
          <ListCardSkeleton count={4} />
        ) : items.length === 0 ? (
          <div style={{ background: COLORS.card, padding: '32px 20px', textAlign: 'center', borderRadius: '14px', color: COLORS.textMuted, fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}><Icon name="users" size={28} color={COLORS.textMuted} /></div>
            {search || category
              ? 'No groups match your search.'
              : tab === 'mine' ? 'You have not joined any groups yet. Explore Discover to find one.'
              : tab === 'suggested' ? 'No suggestions yet.'
              : 'No groups yet. Be the first to create one.'}
          </div>
        ) : (
          items.map((g) => (
            <GroupCard
              key={g.id}
              g={g}
              isMember={joinedIds.has(g.id) || g.owner_id === user?.id}
              requested={requestedIds.has(g.id)}
              busy={busyId === g.id}
              onOpen={() => navigate(`/communities/${g.id}`)}
              onJoin={() => join(g)}
              onCancel={() => cancelRequest(g)}
            />
          ))
        )}

        <LoadMoreButton onClick={loadMore} loading={loadingMore} hasMore={hasMore && !loading && tab === 'discover'} />
      </div>
    </div>
  )
}

function GroupCard({ g, isMember, requested, busy, onOpen, onJoin, onCancel }: {
  g: Group; isMember: boolean; requested: boolean; busy: boolean
  onOpen: () => void; onJoin: () => void; onCancel: () => void
}) {
  const cat = categoryLabel(g.category)
  const activity = activityLabel(g.last_activity_at)
  const avatar = g.icon_url || g.cover_url

  let label = g.privacy === 'private' ? 'Request to Join' : 'Join Group'
  let action: (() => void) | undefined = onJoin
  let primary = true
  if (isMember) { label = 'View Group'; action = onOpen; primary = false }
  else if (requested) { label = 'Requested · Cancel'; action = onCancel; primary = false }

  return (
    <div style={{ background: COLORS.card, borderRadius: '16px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
      <div onClick={onOpen} style={{ cursor: 'pointer' }}>
        <div style={{ height: '78px', background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.greenDark})` }}>
          {g.cover_url && <img src={g.cover_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
        </div>
        <div style={{ padding: '0 14px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', marginTop: '-22px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', flexShrink: 0, background: 'var(--fx-tint-green)', border: `2.5px solid ${COLORS.card}`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {avatar ? <img src={avatar} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="users" size={20} color={COLORS.green} />}
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', paddingBottom: '2px' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '10px', background: g.privacy === 'private' ? 'var(--fx-tint-amber)' : 'var(--fx-tint-green)', color: g.privacy === 'private' ? 'var(--fx-amber-text)' : 'var(--fx-green-dark)' }}>
                {g.privacy === 'private' ? 'Private' : 'Public'}
              </span>
              {cat && <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '10px', background: COLORS.bg, color: COLORS.textMuted, border: `1px solid ${COLORS.border}` }}>{cat}</span>}
            </div>
          </div>
          <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, marginTop: '8px', wordBreak: 'break-word' }}>{g.name}</p>
          {g.description && (
            <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '3px', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{g.description}</p>
          )}
          <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '8px' }}>
            {g.members_count} {g.members_count === 1 ? 'member' : 'members'}
            {g.country ? ` · ${g.country}` : ''}
            {activity ? ` · ${activity}` : ''}
          </p>
        </div>
      </div>
      <div style={{ padding: '0 14px 14px' }}>
        <div role="button" onClick={busy ? undefined : action}
          style={{ textAlign: 'center', padding: '9px', borderRadius: '10px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.6 : 1,
            background: primary ? COLORS.green : COLORS.bg, color: primary ? 'white' : COLORS.text, border: primary ? 'none' : `1px solid ${COLORS.border}` }}>
          {busy ? 'Please wait...' : label}
        </div>
      </div>
    </div>
  )
}
