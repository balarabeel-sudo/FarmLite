import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import ImageUploader from '../ImageUploader'
import SponsoredCard from '../SponsoredCard'
import type { AdData } from '../SponsoredCard'
import { adError, money } from '../company/adShared'
import { COLORS, MyAdsHeader, PageShell, Card, Line, USER_PLACEMENTS, isStorageUrl, primaryBtn } from '../MyAdsShared'

type Kind = 'post' | 'listing' | 'video' | 'profile'
type Item = { id: string; title: string; image: string | null; sub: string; listing?: AdData['listing'] }
type Pkg = { days: number; amount: number; base: number; currency: string; discount_percent: number; groups_amount: number | null; groups_base: number | null }
type GroupPick = { id: string; name: string; icon_url: string | null; members_count: number }
type Placement = 'home' | 'marketplace' | 'search' | 'groups'

const MAX_GROUPS = 10
const STEPS = ['Promote', 'Write', 'Audience', 'Where', 'Duration', 'Review']
const AUDIENCES = [
  { key: 'farmer', label: 'Farmers' },
  { key: 'buyer', label: 'Buyers' },
  { key: 'agribusiness', label: 'Agribusinesses' },
  { key: 'company', label: 'Agricultural companies' },
]
const KINDS: { key: Kind; title: string; sub: string }[] = [
  { key: 'post', title: 'A post', sub: 'One of your public posts' },
  { key: 'listing', title: 'A Marketplace listing', sub: 'A product you are selling' },
  { key: 'video', title: 'A video', sub: 'One of your short videos' },
  { key: 'profile', title: 'My profile', sub: 'Get more people to visit and follow you' },
]

// Route: /my-ads/new  (optional ?type=post|listing|video|profile&id=...)
// 6-step wizard. The price and every rule are checked again on the server when you submit.
export default function MyAdNewPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [params] = useSearchParams()

  const [step, setStep] = useState(1)
  const [kind, setKind] = useState<Kind>('post')
  const [items, setItems] = useState<Item[]>([])
  const [itemsLoading, setItemsLoading] = useState(true)
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())
  const [targetId, setTargetId] = useState('')
  const [me, setMe] = useState<{ full_name: string | null; username: string | null; profile_image: string | null; is_premium: boolean; premium_until: string | null } | null>(null)

  const [headline, setHeadline] = useState('')
  const [body, setBody] = useState('')
  const [image, setImage] = useState<string | null>(null)
  const [customImage, setCustomImage] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)

  const [roles, setRoles] = useState<string[]>([])
  const [locations, setLocations] = useState<string[]>([])
  const [locDraft, setLocDraft] = useState('')

  const [placements, setPlacements] = useState<Placement[]>(['home'])
  const [pickedGroups, setPickedGroups] = useState<GroupPick[]>([])
  const [groupQuery, setGroupQuery] = useState('')
  const [groupResults, setGroupResults] = useState<GroupPick[]>([])
  const [groupsLoading, setGroupsLoading] = useState(false)

  const [packages, setPackages] = useState<Pkg[]>([])
  const [pricesLoaded, setPricesLoaded] = useState(false)
  const [days, setDays] = useState(7)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const requestKey = useRef<string>(typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : '')
  const submitting = useRef(false)

  const groupsOn = placements.includes('groups')

  // Prices, my own profile and the items that already have an open ad.
  useEffect(() => {
    if (!user) return
    supabase.rpc('ad_prices_for_user').then(({ data }) => {
      const pk = ((data as any)?.packages || []) as Pkg[]
      setPackages(pk)
      if (pk.length > 0 && !pk.some((p) => p.days === 7)) setDays(pk[0].days)
      setPricesLoaded(true)
    })
    supabase.from('profiles').select('full_name, username, profile_image, is_premium, premium_until').eq('user_id', user.id).maybeSingle()
      .then(({ data }: { data: any }) => setMe(data))
    supabase.rpc('ads_user_list').then(({ data }) => {
      const open = new Set<string>()
      ;((data || []) as any[]).forEach((a) => {
        if (['pending_review', 'approved', 'active', 'paused'].includes(a.status)) open.add(`${a.target_type}:${a.listing_id || a.post_id || a.video_id || 'me'}`)
      })
      setBusyIds(open)
    })
  }, [user])

  // Load the items of the chosen type.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    setItemsLoading(true)
    setItems([])
    const done = (rows: Item[]) => { if (!cancelled) { setItems(rows); setItemsLoading(false) } }
    if (kind === 'profile') { done([]); return }
    if (kind === 'post') {
      supabase.from('posts').select('id, content, images, created_at').eq('user_id', user.id).is('company_id', null).is('community_id', null)
        .eq('visibility', 'public').or('is_share.is.null,is_share.eq.false').order('created_at', { ascending: false }).limit(30)
        .then(({ data }: { data: any }) => done((data || []).map((p: any) => ({ id: p.id, title: (p.content || 'Photo post').slice(0, 70), image: p.images?.[0] || null, sub: new Date(p.created_at).toLocaleDateString() }))))
    } else if (kind === 'listing') {
      supabase.from('marketplace_listings').select('id, title, category, price, currency, unit, images, location, contact_for_price').eq('seller_id', user.id).is('company_id', null)
        .eq('status', 'available').eq('is_hidden_by_admin', false).order('created_at', { ascending: false }).limit(30)
        .then(({ data }: { data: any }) => done((data || []).map((l: any) => ({
          id: l.id, title: l.title, image: l.images?.[0] || null, sub: l.category || 'Listing',
          listing: { id: l.id, title: l.title, price: l.price, currency: l.currency, unit: l.unit, images: l.images, location: l.location, contact_for_price: l.contact_for_price },
        }))))
    } else {
      supabase.from('short_videos').select('id, caption, thumbnail_url, created_at').eq('user_id', user.id).eq('status', 'active').eq('is_hidden_by_admin', false)
        .order('created_at', { ascending: false }).limit(30)
        .then(({ data }: { data: any }) => done((data || []).map((v: any) => ({ id: v.id, title: (v.caption || 'Short video').slice(0, 70), image: v.thumbnail_url || null, sub: new Date(v.created_at).toLocaleDateString() }))))
    }
    return () => { cancelled = true }
  }, [kind, user])

  // Pre-select from the link (e.g. coming from one of my own posts).
  useEffect(() => {
    const t = params.get('type') as Kind | null
    if (t && ['post', 'listing', 'video', 'profile'].includes(t)) { setKind(t); if (t === 'listing') setPlacements(['home', 'marketplace']) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    const id = params.get('id')
    if (id && items.some((i) => i.id === id) && !targetId) pick(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  // Search public groups while choosing them (step 4).
  useEffect(() => {
    if (!groupsOn || step !== 4) return
    let cancelled = false
    setGroupsLoading(true)
    const timer = setTimeout(() => {
      const term = groupQuery.trim().replace(/[%_,()]/g, ' ')
      let q = supabase.from('communities').select('id, name, icon_url, members_count').eq('status', 'active').eq('privacy', 'public').order('members_count', { ascending: false }).limit(20)
      if (term) q = q.ilike('name', `%${term}%`)
      q.then(({ data }: { data: any }) => {
        if (cancelled) return
        setGroupResults((data || []) as GroupPick[])
        setGroupsLoading(false)
      })
    }, 250)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [groupsOn, step, groupQuery])

  const isBusy = (k: Kind, id: string) => busyIds.has(`${k}:${k === 'profile' ? 'me' : id}`)
  const item = items.find((i) => i.id === targetId) || null
  const chosenImage = (customImage[0] && isStorageUrl(customImage[0]) ? customImage[0] : null) || (image && isStorageUrl(image) ? image : null)

  const pick = (id: string) => {
    setTargetId(id)
    const it = items.find((i) => i.id === id)
    if (it) {
      setHeadline((h) => h || it.title.slice(0, 60))
      setImage(it.image)
      setCustomImage([])
    }
  }

  const switchKind = (k: Kind) => {
    setKind(k)
    // The Marketplace is only for listing ads.
    if (k !== 'listing') setPlacements((pl) => pl.filter((x) => x !== 'marketplace'))
    else setPlacements((pl) => (pl.includes('marketplace') ? pl : [...pl, 'marketplace']))
    setTargetId('')
    setImage(null)
    setCustomImage([])
    setHeadline('')
    if (k === 'profile') setHeadline((me?.full_name || me?.username || '').slice(0, 60))
  }

  const addLocation = () => {
    const t = locDraft.trim().slice(0, 60)
    setLocDraft('')
    if (!t || locations.length >= 10 || locations.some((x) => x.toLowerCase() === t.toLowerCase())) return
    setLocations([...locations, t])
  }

  const togglePlacement = (k: Placement) => setPlacements(placements.includes(k) ? placements.filter((x) => x !== k) : [...placements, k])
  const togglePickedGroup = (g: GroupPick) =>
    setPickedGroups((prev) => (prev.some((x) => x.id === g.id) ? prev.filter((x) => x.id !== g.id) : prev.length >= MAX_GROUPS ? prev : [...prev, g]))

  const visiblePkgs = packages.filter((p) => !groupsOn || p.groups_amount != null)
  const selectedPkg = visiblePkgs.find((p) => p.days === days) || null
  const pkgAmount = (p: Pkg) => (groupsOn && p.groups_amount != null ? p.groups_amount : p.amount)
  const pkgBase = (p: Pkg) => (groupsOn && p.groups_base != null ? p.groups_base : p.base)
  const hasLink = (t: string) => /(https?:\/\/|www\.)/i.test(t)

  const preview: AdData = useMemo(() => ({
    id: 'preview',
    target_type: kind,
    advertiser_type: 'user',
    post_id: kind === 'post' ? targetId : null,
    video_id: kind === 'video' ? targetId : null,
    username: me?.username ?? null,
    headline: headline.trim() || 'Your headline',
    body: body.trim() || null,
    image_url: chosenImage ?? (kind === 'profile' ? null : item?.image ?? null),
    company: { id: user?.id || '', name: me?.full_name || me?.username || 'You', logo_url: me?.profile_image || null, is_premium: !!me?.is_premium, premium_until: me?.premium_until ?? null },
    listing: kind === 'listing' ? item?.listing ?? null : null,
  }), [kind, targetId, headline, body, chosenImage, item, me, user])

  const validate = (s: number): string => {
    if (s === 1 && kind !== 'profile' && !targetId) return 'Choose what you want to promote.'
    if (s === 1 && isBusy(kind, targetId)) return 'This item already has an ad running or waiting. Choose another one.'
    if (s === 2) {
      if (headline.trim().length < 3) return 'Write a headline of at least 3 characters.'
      if (hasLink(headline) || hasLink(body)) return 'Links are not allowed in ads. Remove the web address.'
      if (uploading) return 'Please wait for the image upload to finish.'
    }
    if (s === 4 && placements.length === 0) return 'Choose at least one place.'
    if (s === 4 && groupsOn && pickedGroups.length === 0) return 'Choose at least one group, or turn off Groups.'
    if (s === 5 && !selectedPkg) return 'Choose how long the ad should run.'
    return ''
  }

  const next = () => {
    const m = validate(step)
    if (m) return setError(m)
    setError('')
    setStep((s) => Math.min(6, s + 1))
    window.scrollTo({ top: 0 })
  }
  const back = () => { setError(''); setStep((s) => Math.max(1, s - 1)); window.scrollTo({ top: 0 }) }

  const submit = async () => {
    if (submitting.current) return
    for (let s = 1; s <= 5; s++) {
      const m = validate(s)
      if (m) { setStep(s); return setError(m) }
    }
    setError('')
    submitting.current = true
    setSaving(true)
    const { data, error: e } = await supabase.rpc('ad_create_user', {
      p_target_type: kind,
      p_listing: kind === 'listing' ? targetId : null,
      p_post: kind === 'post' ? targetId : null,
      p_video: kind === 'video' ? targetId : null,
      p_headline: headline.trim(), p_body: body.trim() || null, p_image: chosenImage,
      p_roles: roles, p_locations: locations, p_days: days, p_placements: placements,
      p_request_key: requestKey.current || null,
      p_groups: groupsOn ? pickedGroups.map((g) => g.id) : [],
    })
    setSaving(false)
    if (e) {
      submitting.current = false
      return setError(adError(e))
    }
    navigate(`/my-ads/${data}?submitted=1`, { replace: true })
  }

  const input: CSSProperties = { width: '100%', boxSizing: 'border-box', border: `1px solid ${COLORS.border}`, borderRadius: '10px', padding: '10px 12px', fontSize: '13px', color: COLORS.text, background: COLORS.bg, outline: 'none' }
  const lbl = (t: ReactNode, top = false) => <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text, margin: `${top ? 14 : 0}px 0 6px` }}>{t}</p>
  const muted = (t: string) => <span style={{ fontWeight: 500, color: COLORS.textMuted }}>{t}</span>
  const choice = (on: boolean): CSSProperties => ({ padding: '12px 14px', borderRadius: '12px', cursor: 'pointer', background: on ? 'var(--fx-tint-green)' : COLORS.card, border: `2px solid ${on ? COLORS.green : COLORS.border}` })

  return (
    <PageShell>
      <MyAdsHeader title="Create ad" onBack={() => navigate('/my-ads')} />
      <div style={{ padding: '16px' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {STEPS.map((_, i) => <div key={i} style={{ flex: 1, height: 5, borderRadius: 3, background: i + 1 <= step ? COLORS.green : COLORS.border }} />)}
        </div>
        <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.textMuted, margin: '8px 0 14px' }}>Step {step} of 6 · <span style={{ color: COLORS.text }}>{STEPS[step - 1]}</span></p>

        {error && <div role="alert" style={{ background: 'var(--fx-tint-red)', color: COLORS.red, borderRadius: '10px', padding: '11px 14px', fontSize: '12.5px', fontWeight: 600, marginBottom: '12px' }}>{error}</div>}

        {step === 1 && (
          <Card title="What do you want to promote?">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {KINDS.map((k) => (
                <div key={k.key} onClick={() => switchKind(k.key)} style={choice(kind === k.key)}>
                  <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.text, margin: 0 }}>{k.title}</p>
                  <p style={{ fontSize: '11px', color: COLORS.textMuted, margin: '3px 0 0' }}>{k.sub}</p>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '14px' }}>
              {kind === 'profile' ? (
                isBusy('profile', 'me')
                  ? <p style={{ fontSize: '12.5px', color: COLORS.red }}>Your profile already has an ad running or waiting.</p>
                  : <p style={{ fontSize: '12.5px', color: COLORS.textMuted, lineHeight: 1.5 }}>Your ad will open your public profile.</p>
              ) : itemsLoading ? (
                <p style={{ fontSize: '12.5px', color: COLORS.textMuted }}>Loading...</p>
              ) : items.length === 0 ? (
                <div>
                  <p style={{ fontSize: '12.5px', color: COLORS.textMuted, lineHeight: 1.5 }}>
                    {kind === 'post' ? 'You have no public posts to promote. Group posts, shared posts and company posts cannot be advertised here.'
                      : kind === 'listing' ? 'You have no available listings to promote.'
                      : 'You have no videos to promote.'}
                  </p>
                  <span onClick={() => navigate(kind === 'listing' ? '/sell' : kind === 'video' ? '/videos/new' : '/create')} style={{ display: 'inline-block', marginTop: '8px', fontSize: '13px', fontWeight: 800, color: COLORS.green, cursor: 'pointer' }}>
                    {kind === 'listing' ? 'Create a listing' : kind === 'video' ? 'Upload a video' : 'Create a post'}
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {items.map((it) => {
                    const used = isBusy(kind, it.id)
                    return (
                      <div key={it.id} onClick={used ? undefined : () => pick(it.id)} style={{ ...choice(targetId === it.id), display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', opacity: used ? 0.5 : 1, cursor: used ? 'not-allowed' : 'pointer' }}>
                        <div style={{ width: 50, height: 50, borderRadius: 10, background: 'var(--fx-tint-green)', overflow: 'hidden', flexShrink: 0 }}>
                          {it.image && <img src={it.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.text, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.title}</p>
                          <p style={{ fontSize: '11px', color: COLORS.textMuted, margin: '2px 0 0' }}>{used ? 'Already has an ad' : it.sub}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </Card>
        )}

        {step === 2 && (
          <Card title="Write your ad">
            {lbl(<>Headline {muted(`(${headline.length}/60)`)}</>)}
            <input value={headline} maxLength={60} onChange={(e) => setHeadline(e.target.value)} placeholder="Short and clear" style={input} />
            {lbl(<>Description (optional) {muted(`(${body.length}/140)`)}</>, true)}
            <textarea value={body} maxLength={140} rows={2} onChange={(e) => setBody(e.target.value)} placeholder="One or two lines about your offer" style={{ ...input, resize: 'vertical', fontFamily: 'inherit' }} />
            {lbl('Image', true)}
            {item?.image && isStorageUrl(item.image) && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <img src={item.image} alt="" onClick={() => { setImage(item.image); setCustomImage([]) }} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 10, cursor: 'pointer', border: `2px solid ${!customImage[0] && image === item.image ? COLORS.green : 'transparent'}` }} />
              </div>
            )}
            <ImageUploader value={customImage} onChange={(v: string[]) => setCustomImage(v)} folder="posts" max={1} onBusyChange={setUploading} />
            {!customImage[0] && image && <span onClick={() => setImage(null)} style={{ display: 'inline-block', marginTop: '8px', fontSize: '12px', fontWeight: 700, color: COLORS.red, cursor: 'pointer' }}>Remove image</span>}
            <p style={{ fontSize: '11.5px', color: COLORS.textMuted, margin: '10px 0 0', lineHeight: 1.5 }}>Your ad opens the {kind === 'profile' ? 'profile' : kind} page inside Farmxie. Links to other websites are not allowed, and ads are plain text and images only.</p>
          </Card>
        )}

        {step === 3 && (
          <Card title="Who should see it?">
            <p style={{ fontSize: '12px', color: COLORS.textMuted, margin: '0 0 10px', lineHeight: 1.5 }}>Choose one or more groups of people. If you choose none, your ad can be shown to everyone.</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {AUDIENCES.map((r) => {
                const on = roles.includes(r.key)
                return (
                  <span key={r.key} onClick={() => setRoles(on ? roles.filter((x) => x !== r.key) : [...roles, r.key])}
                    style={{ padding: '8px 14px', borderRadius: 999, fontSize: '12px', fontWeight: 700, cursor: 'pointer', background: on ? COLORS.green : COLORS.card, color: on ? 'white' : COLORS.textMuted, border: `1px solid ${on ? COLORS.green : COLORS.border}` }}>{r.label}</span>
                )
              })}
            </div>
            {lbl('Where are your customers? (optional)', true)}
            <input value={locDraft} maxLength={60} disabled={locations.length >= 10} placeholder="Type a country, state or city, then press Enter" onChange={(e) => setLocDraft(e.target.value.replace(',', ''))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLocation() } }} onBlur={addLocation} style={input} />
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
              {locations.map((l) => (
                <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--fx-tint-green)', color: COLORS.greenDark, fontSize: '12px', fontWeight: 700, padding: '5px 6px 5px 11px', borderRadius: 999 }}>
                  {l}<span onClick={() => setLocations(locations.filter((x) => x !== l))} style={{ cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '0 5px' }}>×</span>
                </span>
              ))}
            </div>
            {locations.length === 0 && <p style={{ fontSize: '11.5px', color: COLORS.textMuted, margin: '8px 0 0' }}>No location chosen: eligible everywhere.</p>}
          </Card>
        )}

        {step === 4 && (
          <Card title="Where should your ad appear?">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {USER_PLACEMENTS.map((p) => {
                const blocked = p.key === 'marketplace' && kind !== 'listing'
                const on = placements.includes(p.key) && !blocked
                return (
                  <div key={p.key} onClick={blocked ? undefined : () => togglePlacement(p.key)} style={{ ...choice(on), display: 'flex', alignItems: 'center', gap: '12px', opacity: blocked ? 0.55 : 1, cursor: blocked ? 'not-allowed' : 'pointer' }}>
                    <span style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${on ? COLORS.green : '#B7C7B7'}`, background: on ? COLORS.green : 'transparent', color: 'white', fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{on ? '✓' : ''}</span>
                    <div>
                      <p style={{ fontSize: '13.5px', fontWeight: 800, color: COLORS.text, margin: 0 }}>{p.label}</p>
                      <p style={{ fontSize: '11.5px', color: COLORS.textMuted, margin: '2px 0 0' }}>{blocked ? 'Only available when you promote a Marketplace listing.' : p.help}</p>
                    </div>
                  </div>
                )
              })}
            </div>
            {groupsOn && (
              <div style={{ marginTop: '14px', padding: '12px', borderRadius: '12px', border: `1px solid ${COLORS.border}`, background: COLORS.bg }}>
                <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.text, margin: 0 }}>Choose your groups {muted(`(${pickedGroups.length}/${MAX_GROUPS})`)}</p>
                <p style={{ fontSize: '11.5px', color: COLORS.textMuted, margin: '3px 0 0', lineHeight: 1.5 }}>Only public groups can be chosen.</p>
                {pickedGroups.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
                    {pickedGroups.map((g) => (
                      <span key={g.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--fx-tint-green)', color: COLORS.greenDark, fontSize: '12px', fontWeight: 700, padding: '5px 6px 5px 11px', borderRadius: 999 }}>
                        {g.name}<span onClick={() => togglePickedGroup(g)} style={{ cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '0 5px' }}>×</span>
                      </span>
                    ))}
                  </div>
                )}
                <input value={groupQuery} maxLength={60} onChange={(e) => setGroupQuery(e.target.value)} placeholder="Search groups by name" style={{ ...input, marginTop: '10px' }} />
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: 260, overflowY: 'auto' }}>
                  {groupsLoading && groupResults.length === 0 ? (
                    <p style={{ fontSize: '12px', color: COLORS.textMuted }}>Loading groups...</p>
                  ) : groupResults.length === 0 ? (
                    <p style={{ fontSize: '12px', color: COLORS.textMuted }}>No public groups found.</p>
                  ) : groupResults.map((g) => {
                    const on = pickedGroups.some((x) => x.id === g.id)
                    const full = !on && pickedGroups.length >= MAX_GROUPS
                    return (
                      <div key={g.id} onClick={full ? undefined : () => togglePickedGroup(g)} style={{ ...choice(on), display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', opacity: full ? 0.5 : 1 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--fx-tint-green)', overflow: 'hidden', flexShrink: 0 }}>
                          {g.icon_url && <img src={g.icon_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{ fontSize: '12.5px', fontWeight: 800, color: COLORS.text, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</p>
                          <p style={{ fontSize: '11px', color: COLORS.textMuted, margin: '1px 0 0' }}>{g.members_count} {g.members_count === 1 ? 'member' : 'members'}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </Card>
        )}

        {step === 5 && (
          <Card title="How long should it run?">
            {!pricesLoaded ? (
              <p style={{ fontSize: '12.5px', color: COLORS.textMuted }}>Loading prices...</p>
            ) : packages.length === 0 ? (
              <p style={{ fontSize: '12.5px', color: COLORS.textMuted, lineHeight: 1.5 }}>Ads are not available for your country yet. Please check again soon.</p>
            ) : visiblePkgs.length === 0 ? (
              <p style={{ fontSize: '12.5px', color: COLORS.textMuted, lineHeight: 1.5 }}>Group ads are not available for your country yet. Go back and turn off Groups, or check again soon.</p>
            ) : (
              <>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {visiblePkgs.map((p) => (
                    <div key={p.days} onClick={() => setDays(p.days)} style={{ ...choice(days === p.days), flex: 1, textAlign: 'center', padding: '14px 6px' }}>
                      <p style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text, margin: 0 }}>{p.days} days</p>
                      <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.greenDark, margin: '6px 0 0' }}>{money(pkgAmount(p), p.currency)}</p>
                      {p.discount_percent > 0 && <p style={{ fontSize: '10.5px', color: COLORS.textMuted, margin: '4px 0 0' }}><s>{money(pkgBase(p), p.currency)}</s> · {p.discount_percent}% Premium discount</p>}
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: '11.5px', color: COLORS.textMuted, margin: '12px 0 0', lineHeight: 1.6 }}>
                  You pay only after Farmxie approves your ad. If it is rejected, you are not charged. The ad starts when your payment is confirmed. Farmxie does not guarantee a number of views, clicks, customers or sales.
                </p>
              </>
            )}
          </Card>
        )}

        {step === 6 && (
          <>
            <Card title="Preview">
              <div style={{ maxWidth: 360 }}><SponsoredCard ad={preview} layout="wide" preview /></div>
            </Card>
            <Card title="Review and submit">
              <Line label="Promoting" value={kind === 'profile' ? 'My profile' : `${KINDS.find((k) => k.key === kind)?.title.replace('A ', '').replace('My ', '')}: ${item?.title ?? ''}`} />
              <Line label="Headline" value={headline.trim()} />
              <Line label="Audience" value={roles.length ? roles.map((r) => AUDIENCES.find((a) => a.key === r)?.label).join(', ') : 'Everyone'} />
              <Line label="Location" value={locations.length ? locations.join(', ') : 'Everywhere'} />
              <Line label="Appears in" value={placements.map((k) => USER_PLACEMENTS.find((p) => p.key === k)?.label).join(', ')} />
              {groupsOn && <Line label="Groups" value={pickedGroups.map((g) => g.name).join(', ')} />}
              <Line label="Duration" value={`${days} days`} />
              <Line label="Total payable after approval" value={selectedPkg ? money(pkgAmount(selectedPkg), selectedPkg.currency) : ''} strong />
              <p style={{ fontSize: '11.5px', color: COLORS.textMuted, margin: '12px 0 0', lineHeight: 1.6 }}>Your ad is not shown until Farmxie approves it and you pay. You will be notified when the review is done.</p>
            </Card>
          </>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
          {step > 1 && <div role="button" onClick={saving ? undefined : back} style={{ padding: '11px 20px', borderRadius: '10px', background: COLORS.card, border: `1px solid ${COLORS.border}`, color: COLORS.textMuted, fontWeight: 800, fontSize: '13px', cursor: 'pointer' }}>Back</div>}
          <div style={{ flex: 1 }} />
          {step < 6 ? (
            <div role="button" onClick={next} style={{ ...primaryBtn(uploading), padding: '11px 28px' }}>Continue</div>
          ) : (
            <div role="button" onClick={saving ? undefined : submit} style={{ ...primaryBtn(saving), padding: '11px 24px' }}>{saving ? 'Submitting...' : 'Submit for review'}</div>
          )}
        </div>
      </div>
    </PageShell>
  )
}
