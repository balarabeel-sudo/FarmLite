import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import Icon from '../Icons'
import { GridCardSkeleton } from '../LoadingSkeleton'
import NetworkError from '../NetworkError'
import ImageUploader from '../ImageUploader'
import { validatePhone, cleanPhone, whatsappLink } from '../phoneUtils'
import { PremiumBadge } from '../shared'
import { PAGE_SIZE, LoadMoreButton } from '../shared'

const COLORS = {
  bg: '#F8FAF6',
  card: '#FFFFFF',
  border: '#E5EFE5',
  green: '#16A34A',
  greenDark: '#166534',
  orange: '#F59E0B',
  text: '#1A2E1A',
  textMuted: '#5B6B5B',
  red: '#DC2626',
}

type Category = 'crop' | 'livestock' | 'seed'
type Status = 'available' | 'sold' | 'inactive'

type Seller = {
  full_name: string | null
  username: string | null
  profile_image: string | null
  phone: string | null
  is_premium: boolean
}

type Listing = {
  id: string
  seller_id: string
  category: Category
  title: string
  description: string | null
  price: number
  currency: string
  unit: string | null
  quantity: number | null
  location: string | null
  whatsapp: string | null
  negotiable: boolean
  images: string[] | null
  status: Status
  seller: Seller | null
}

type CategoryFilter = 'all' | Category

const CATEGORIES: { value: CategoryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'crop', label: 'Crops' },
  { value: 'livestock', label: 'Livestock' },
  { value: 'seed', label: 'Seeds' },
]

const UNITS = ['kg', 'bag', 'ton', 'piece', 'litre', 'crate', 'bunch']
const CURRENCIES = ['NGN', 'USD', 'GHS', 'KES']
const STATUSES: { value: Status; label: string }[] = [
  { value: 'available', label: 'Available' },
  { value: 'sold', label: 'Sold' },
  { value: 'inactive', label: 'Hidden' },
]

type Form = {
  category: Category
  title: string
  price: string
  currency: string
  unit: string
  quantity: string
  location: string
  whatsapp: string
  negotiable: boolean
  status: Status
  description: string
  images: string[]
}

const EMPTY_FORM: Form = {
  category: 'crop', title: '', price: '', currency: 'NGN', unit: 'kg', quantity: '',
  location: '', whatsapp: '', negotiable: false, status: 'available', description: '', images: [],
}

const LISTING_COLUMNS =
  'id, seller_id, category, title, description, price, currency, unit, quantity, location, whatsapp, negotiable, images, status, seller:profiles!marketplace_listings_seller_id_fkey(full_name, username, profile_image, phone, is_premium)'

export default function MarketplacePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [listings, setListings] = useState<Listing[]>([])
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [myDefaults, setMyDefaults] = useState({ location: '', whatsapp: '' })
  const [imageCap, setImageCap] = useState(5)

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<CategoryFilter>((searchParams.get('category') as CategoryFilter) || 'all')
  const [mineOnly, setMineOnly] = useState(searchParams.get('mine') === '1')
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Form>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [detail, setDetail] = useState<Listing | null>(null)

  const setField = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }))

  // Builds the listings query for the current search/category filters.
  const listingsQuery = (from: number, to: number) => {
    let q = supabase.from('marketplace_listings').select(LISTING_COLUMNS)
    if (mineOnly) {
      q = q.eq('seller_id', user!.id)
    } else {
      q = user ? q.or(`status.eq.available,seller_id.eq.${user.id}`) : q.eq('status', 'available')
    }
    if (filter !== 'all') q = q.eq('category', filter)
    const term = search.trim().replace(/[%,()*\\]/g, ' ').trim()
    if (term) q = q.ilike('title', `%${term}%`)
    return q.order('created_at', { ascending: false }).range(from, to)
  }

  const load = async () => {
    if (!user) return
    setNetError(false)
    setLoading(true)

    const [listingsRes, savedRes, meRes] = await Promise.all([
      listingsQuery(0, PAGE_SIZE - 1),
      supabase.from('saved_items').select('listing_id').eq('user_id', user.id).not('listing_id', 'is', null),
      supabase.from('profiles').select('location, whatsapp, is_premium').eq('user_id', user.id).maybeSingle(),
    ])

    if (listingsRes.error) {
      setNetError(true)
      setLoading(false)
      return
    }

    const page = (listingsRes.data || []) as any as Listing[]
    setListings(page)
    setHasMore(page.length === PAGE_SIZE)
    setSavedIds(new Set((savedRes.data || []).map((r: any) => r.listing_id)))
    const me = meRes.data as any
    setMyDefaults({ location: me?.location || '', whatsapp: me?.whatsapp || '' })
    setImageCap(me?.is_premium ? 10 : 5)
    setLoading(false)
  }

  const loadMore = async () => {
    if (!user || loadingMore) return
    setLoadingMore(true)
    const { data, error } = await listingsQuery(listings.length, listings.length + PAGE_SIZE - 1)
    if (!error) {
      const more = (data || []) as any as Listing[]
      setListings((prev) => [...prev, ...more])
      setHasMore(more.length === PAGE_SIZE)
    }
    setLoadingMore(false)
  }

  useEffect(() => { load() }, [user, filter, mineOnly])

  // Waits until the user pauses typing before searching again.
  useEffect(() => {
    if (!user) return
    const timer = setTimeout(() => load(), 300)
    return () => clearTimeout(timer)
  }, [search])

  // Opens a listing directly when arriving from the Home page (/marketplace?listing=<id>),
  // fetching it on its own if it is not on the currently loaded page.
  useEffect(() => {
    const id = searchParams.get('listing')
    if (!id) return
    setSearchParams({}, { replace: true })
    const found = listings.find((l) => l.id === id)
    if (found) {
      setDetail(found)
      return
    }
    supabase.from('marketplace_listings').select(LISTING_COLUMNS).eq('id', id).maybeSingle().then(({ data }) => {
      if (data) setDetail(data as any)
    })
  }, [searchParams])

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError('')
  }

  const openNew = () => {
    setEditingId(null)
    setForm({ ...EMPTY_FORM, location: myDefaults.location, whatsapp: myDefaults.whatsapp })
    setFormError('')
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openEdit = (l: Listing) => {
    setDetail(null)
    setEditingId(l.id)
    setForm({
      category: l.category,
      title: l.title,
      price: String(l.price),
      currency: l.currency || 'NGN',
      unit: l.unit || 'kg',
      quantity: l.quantity != null ? String(l.quantity) : '',
      location: l.location || '',
      whatsapp: l.whatsapp || '',
      negotiable: !!l.negotiable,
      status: l.status,
      description: l.description || '',
      images: l.images || [],
    })
    setFormError('')
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSave = async () => {
    if (!user) return
    setFormError('')

    const priceNum = Number(form.price)
    const qtyNum = form.quantity.trim() === '' ? null : Number(form.quantity)

    if (!form.title.trim()) return setFormError('Enter a title.')
    if (form.price.trim() === '' || Number.isNaN(priceNum) || priceNum < 0) return setFormError('Enter a valid price.')
    if (qtyNum !== null && (Number.isNaN(qtyNum) || qtyNum < 0)) return setFormError('Enter a valid quantity.')
    if (form.images.length === 0) return setFormError('Add at least one photo.')
    const phoneErr = validatePhone(form.whatsapp)
    if (phoneErr) return setFormError(phoneErr)

    const payload = {
      category: form.category,
      title: form.title.trim(),
      description: form.description.trim() || null,
      price: priceNum,
      currency: form.currency,
      unit: form.unit,
      quantity: qtyNum,
      location: form.location.trim() || null,
      whatsapp: cleanPhone(form.whatsapp) || null,
      negotiable: form.negotiable,
      status: form.status,
      images: form.images,
    }

    setSaving(true)
    const { error } = editingId
      ? await supabase.from('marketplace_listings').update(payload).eq('id', editingId).eq('seller_id', user.id)
      : await supabase.from('marketplace_listings').insert({ ...payload, seller_id: user.id })
    setSaving(false)

    if (error) {
      setFormError(error.message || 'Could not save your listing.')
      return
    }

    closeForm()
    load()
  }

  const handleDelete = async () => {
    if (!user || !editingId) return
    if (!window.confirm('Delete this listing? This cannot be undone.')) return
    const { error } = await supabase.from('marketplace_listings').delete().eq('id', editingId).eq('seller_id', user.id)
    if (error) {
      setFormError('Could not delete the listing. Try again.')
      return
    }
    closeForm()
    load()
  }

  const toggleSave = async (listingId: string) => {
    if (!user) return
    if (savedIds.has(listingId)) {
      await supabase.from('saved_items').delete().eq('user_id', user.id).eq('listing_id', listingId)
      setSavedIds((prev) => { const next = new Set(prev); next.delete(listingId); return next })
    } else {
      await supabase.from('saved_items').insert({ user_id: user.id, listing_id: listingId })
      setSavedIds((prev) => new Set(prev).add(listingId))
    }
  }

  const filtered = listings

  const onHeaderAdd = () => (showForm ? closeForm() : openNew())

  if (netError) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <Header onBack={() => navigate('/')} onAdd={onHeaderAdd} open={showForm} />
        <NetworkError onRetry={load} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '30px' }}>
      <Header onBack={() => navigate('/')} onAdd={onHeaderAdd} open={showForm} />

      <div style={{ padding: '16px' }}>
        {mineOnly && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#DCFCE7', borderRadius: '10px', padding: '9px 12px', marginBottom: '12px' }}>
            <p style={{ flex: 1, fontSize: '12px', fontWeight: 700, color: COLORS.greenDark }}>Showing your listings</p>
            <span onClick={() => setMineOnly(false)} style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.greenDark, cursor: 'pointer' }}>Show all</span>
          </div>
        )}
        <div style={{ position: 'relative', marginBottom: '12px' }}>
          <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}>
            <Icon name="search" size={16} color={COLORS.textMuted} />
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search crops, livestock, seeds..."
            style={{ width: '100%', padding: '11px 14px 11px 36px', borderRadius: '12px', border: `1px solid ${COLORS.border}`, fontSize: '13px', boxSizing: 'border-box', background: COLORS.card }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto' }}>
          {CATEGORIES.map((c) => (
            <div
              key={c.value}
              onClick={() => setFilter(c.value)}
              style={{
                whiteSpace: 'nowrap', padding: '8px 16px', borderRadius: '10px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
                background: filter === c.value ? COLORS.green : COLORS.card,
                color: filter === c.value ? 'white' : COLORS.textMuted,
                border: `1px solid ${filter === c.value ? COLORS.green : COLORS.border}`,
              }}>
              {c.label}
            </div>
          ))}
        </div>

        {showForm && (
          <div style={{ background: COLORS.card, borderRadius: '16px', padding: '16px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px', color: COLORS.text }}>{editingId ? 'Edit listing' : 'New listing'}</p>

            {formError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '10px 12px', marginBottom: '10px' }}>
                <p style={{ fontSize: '11.5px', color: COLORS.red }}>{formError}</p>
              </div>
            )}

            <p style={labelStyle}>Photos</p>
            <div style={{ marginBottom: '12px' }}>
              <ImageUploader value={form.images} onChange={(urls) => setField('images', urls)} folder="listings" max={imageCap} />
            </div>

            <select value={form.category} onChange={(e) => setField('category', e.target.value as Category)} style={inputStyle}>
              <option value="crop">Crop</option>
              <option value="livestock">Livestock</option>
              <option value="seed">Seed</option>
            </select>
            <input value={form.title} onChange={(e) => setField('title', e.target.value)} placeholder="Title, e.g. Maize (White), 50 bags" maxLength={100} style={inputStyle} />

            <div style={{ display: 'flex', gap: '8px' }}>
              <input value={form.price} onChange={(e) => setField('price', e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Price" inputMode="decimal" style={{ ...inputStyle, flex: 2 }} />
              <select value={form.currency} onChange={(e) => setField('currency', e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <select value={form.unit} onChange={(e) => setField('unit', e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                {UNITS.map((u) => <option key={u} value={u}>per {u}</option>)}
              </select>
              <input value={form.quantity} onChange={(e) => setField('quantity', e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Quantity (optional)" inputMode="decimal" style={{ ...inputStyle, flex: 1 }} />
            </div>

            <div onClick={() => setField('negotiable', !form.negotiable)} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', cursor: 'pointer' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '6px', border: `1.5px solid ${form.negotiable ? COLORS.green : COLORS.border}`, background: form.negotiable ? COLORS.green : COLORS.card, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {form.negotiable && <Icon name="check" size={13} color="white" strokeWidth={3} />}
              </div>
              <p style={{ fontSize: '12.5px', color: COLORS.text }}>Price is negotiable</p>
            </div>

            <input value={form.location} onChange={(e) => setField('location', e.target.value)} placeholder="Location, e.g. Kaduna, Nigeria" maxLength={80} style={inputStyle} />
            <input value={form.whatsapp} onChange={(e) => setField('whatsapp', e.target.value)} placeholder="WhatsApp, e.g. +2348012345678" inputMode="tel" style={inputStyle} />
            <textarea value={form.description} onChange={(e) => setField('description', e.target.value)} placeholder="Description: quality, harvest date, delivery..." rows={3} maxLength={1000} style={{ ...inputStyle, resize: 'none' }} />

            {editingId && (
              <>
                <p style={labelStyle}>Status</p>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  {STATUSES.map((s) => (
                    <div
                      key={s.value}
                      onClick={() => setField('status', s.value)}
                      style={{
                        padding: '7px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                        background: form.status === s.value ? COLORS.green : COLORS.card,
                        color: form.status === s.value ? 'white' : COLORS.textMuted,
                        border: `1px solid ${form.status === s.value ? COLORS.green : COLORS.border}`,
                      }}>
                      {s.label}
                    </div>
                  ))}
                </div>
              </>
            )}

            <div onClick={saving ? undefined : handleSave} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: COLORS.green, color: 'white', padding: '11px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              <Icon name={editingId ? 'check' : 'upload'} size={15} color="white" />
              {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Post Listing'}
            </div>

            {editingId && (
              <div onClick={handleDelete} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '10px', padding: '10px', borderRadius: '10px', border: '1px solid #FECACA', color: COLORS.red, fontWeight: 700, fontSize: '12.5px', cursor: 'pointer' }}>
                <Icon name="trash" size={14} color={COLORS.red} /> Delete Listing
              </div>
            )}
          </div>
        )}

        {loading ? (
          <GridCardSkeleton count={6} />
        ) : filtered.length === 0 ? (
          <div style={{ background: COLORS.card, padding: '32px 20px', textAlign: 'center', borderRadius: '14px', color: COLORS.textMuted, fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
              <Icon name="package" size={28} color={COLORS.textMuted} />
            </div>
            {listings.length === 0 ? 'No listings yet. Tap + to add the first one.' : 'No listings match your search or filter.'}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {filtered.map((l) => (
              <div key={l.id} onClick={() => setDetail(l)} style={{ background: COLORS.card, borderRadius: '14px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', cursor: 'pointer' }}>
                <div style={{ width: '100%', height: '100px', background: '#E5EFE5', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  {l.images?.[0] ? <img src={l.images[0]} alt={l.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="leaf" size={26} color={COLORS.green} />}

                  <div
                    onClick={(e) => { e.stopPropagation(); toggleSave(l.id) }}
                    style={{ position: 'absolute', top: '6px', right: '6px', width: '26px', height: '26px', borderRadius: '13px', background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <Icon name="bookmark" size={13} color={savedIds.has(l.id) ? COLORS.orange : COLORS.textMuted} />
                  </div>

                  {(l.images?.length || 0) > 1 && (
                    <div style={{ position: 'absolute', left: '6px', bottom: '6px', display: 'flex', alignItems: 'center', gap: '3px', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '999px' }}>
                      <Icon name="image" size={10} color="white" /> {l.images?.length}
                    </div>
                  )}

                  {l.status !== 'available' && (
                    <div style={{ position: 'absolute', left: '6px', top: '6px', background: l.status === 'sold' ? COLORS.red : COLORS.textMuted, color: 'white', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px' }}>
                      {l.status === 'sold' ? 'Sold' : 'Hidden'}
                    </div>
                  )}
                </div>
                <div style={{ padding: '10px' }}>
                  <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.title}</p>
                  <p style={{ fontSize: '12.5px', fontWeight: 800, color: COLORS.green, marginTop: '4px' }}>{l.currency} {Number(l.price).toLocaleString()}{l.unit ? `/${l.unit}` : ''}</p>
                  {l.location && (
                    <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Icon name="mapPin" size={10} color={COLORS.textMuted} /> {l.location}
                    </p>
                  )}
                  {l.seller_id === user?.id && (
                    <p style={{ fontSize: '10px', color: COLORS.orange, marginTop: '4px', fontWeight: 700 }}>Your listing</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <LoadMoreButton onClick={loadMore} loading={loadingMore} hasMore={hasMore && !loading} />
      </div>

      {detail && (
        <DetailSheet
          listing={detail}
          isMine={detail.seller_id === user?.id}
          saved={savedIds.has(detail.id)}
          onToggleSave={() => toggleSave(detail.id)}
          onEdit={() => openEdit(detail)}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  )
}

function DetailSheet({ listing: l, isMine, saved, onToggleSave, onEdit, onClose }: {
  listing: Listing
  isMine: boolean
  saved: boolean
  onToggleSave: () => void
  onEdit: () => void
  onClose: () => void
}) {
  const images = l.images || []
  const waNumber = l.whatsapp || ''
  const callNumber = l.seller?.phone || ''
  const categoryLabel = CATEGORIES.find((c) => c.value === l.category)?.label || l.category

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: COLORS.card, width: '100%', maxWidth: '480px', maxHeight: '92vh', overflowY: 'auto', borderRadius: '20px 20px 0 0' }}>
        <div style={{ position: 'relative' }}>
          {images.length > 0 ? (
            <div style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory' }}>
              {images.map((url) => (
                <img key={url} src={url} alt={l.title} style={{ width: '100%', height: '240px', objectFit: 'cover', flexShrink: 0, scrollSnapAlign: 'start' }} />
              ))}
            </div>
          ) : (
            <div style={{ height: '160px', background: '#E5EFE5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="leaf" size={36} color={COLORS.green} />
            </div>
          )}
          <div onClick={onClose} style={{ position: 'absolute', top: '12px', right: '12px', width: '32px', height: '32px', borderRadius: '16px', background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Icon name="close" size={16} color="white" />
          </div>
          {images.length > 1 && (
            <div style={{ position: 'absolute', left: '12px', bottom: '10px', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '11px', fontWeight: 700, padding: '3px 9px', borderRadius: '999px' }}>
              Swipe for {images.length} photos
            </div>
          )}
        </div>

        <div style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
            <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text, flex: 1 }}>{l.title}</p>
            <div onClick={onToggleSave} style={{ cursor: 'pointer', display: 'flex', padding: '2px' }}>
              <Icon name="bookmark" size={20} color={saved ? COLORS.orange : COLORS.textMuted} />
            </div>
          </div>

          <p style={{ fontSize: '18px', fontWeight: 800, color: COLORS.green, marginTop: '6px' }}>
            {l.currency} {Number(l.price).toLocaleString()}{l.unit ? ` / ${l.unit}` : ''}
            {l.negotiable && <span style={{ fontSize: '11px', fontWeight: 700, color: COLORS.orange, marginLeft: '8px' }}>Negotiable</span>}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '12px' }}>
            <DetailRow icon="tag" text={categoryLabel} />
            {l.quantity != null && <DetailRow icon="package" text={`${Number(l.quantity).toLocaleString()} ${l.unit || ''} available`} />}
            {l.location && <DetailRow icon="mapPin" text={l.location} />}
            {l.status !== 'available' && <DetailRow icon="alertTriangle" text={l.status === 'sold' ? 'This item has been sold' : 'Hidden from other buyers'} color={COLORS.red} />}
          </div>

          {l.description && <p style={{ fontSize: '13px', color: COLORS.text, lineHeight: 1.5, marginTop: '14px' }}>{l.description}</p>}

          {l.seller && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '16px', padding: '12px', background: COLORS.bg, borderRadius: '12px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '19px', background: '#DCFCE7', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {l.seller.profile_image ? <img src={l.seller.profile_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="user" size={18} color={COLORS.green} />}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text }}>{l.seller.full_name || l.seller.username || 'Seller'}</p>
                  {l.seller.is_premium && <PremiumBadge />}
                </div>
                {l.seller.username && <p style={{ fontSize: '11px', color: COLORS.textMuted }}>@{l.seller.username}</p>}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            {isMine ? (
              <div onClick={onEdit} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: COLORS.green, color: 'white', padding: '12px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                <Icon name="edit" size={15} color="white" /> Edit Listing
              </div>
            ) : (
              <>
                {waNumber && (
                  <a href={whatsappLink(waNumber)} target="_blank" rel="noopener noreferrer" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: COLORS.green, color: 'white', padding: '12px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', textDecoration: 'none' }}>
                    <Icon name="message" size={15} color="white" /> WhatsApp
                  </a>
                )}
                {callNumber && (
                  <a href={`tel:${cleanPhone(callNumber)}`} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', border: `1px solid ${COLORS.green}`, color: COLORS.green, padding: '12px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', textDecoration: 'none' }}>
                    <Icon name="phone" size={15} color={COLORS.green} /> Call
                  </a>
                )}
                {!waNumber && !callNumber && (
                  <p style={{ fontSize: '12px', color: COLORS.textMuted }}>The seller has not added contact details yet.</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ icon, text, color = COLORS.textMuted }: { icon: string; text: string; color?: string }) {
  return (
    <p style={{ fontSize: '12.5px', color, display: 'flex', alignItems: 'center', gap: '6px' }}>
      <Icon name={icon} size={14} color={color} /> {text}
    </p>
  )
}

function Header({ onBack, onAdd, open }: { onBack: () => void; onAdd: () => void; open: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px',
      background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div onClick={onBack} style={{ cursor: 'pointer', display: 'flex' }}>
          <Icon name="arrowLeft" size={22} color={COLORS.text} />
        </div>
        <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>Marketplace</p>
      </div>
      <div onClick={onAdd} style={{ width: '36px', height: '36px', borderRadius: '10px', background: COLORS.green, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <Icon name={open ? 'close' : 'plus'} size={18} color="white" />
      </div>
    </div>
  )
}

const labelStyle: CSSProperties = { fontSize: '12px', fontWeight: 700, color: COLORS.text, marginBottom: '6px' }

const inputStyle: CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`,
  marginBottom: '10px', fontSize: '13px', boxSizing: 'border-box', background: COLORS.bg,
}
