import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import Icon from '../Icons'
import { ListCardSkeleton } from '../LoadingSkeleton'
import NetworkError from '../NetworkError'
import ImageUploader from '../ImageUploader'
import { formatMoney } from '../moneyUtils'
import { validatePhone, cleanPhone, whatsappLink } from '../phoneUtils'
import { COLORS, inputStyle, labelStyle, ErrorBanner, PAGE_SIZE, LoadMoreButton, PremiumBadge } from '../shared'

type ListingType = 'buy' | 'rent'
type Status = 'available' | 'unavailable'
type Condition = '' | 'new' | 'used'

type Seller = {
  full_name: string | null
  username: string | null
  profile_image: string | null
  phone: string | null
  is_premium: boolean
}

type Equipment = {
  id: string
  seller_id: string
  name: string
  category: string | null
  description: string | null
  listing_type: ListingType
  price: number
  currency: string
  unit: string | null
  location: string | null
  images: string[] | null
  status: Status
  whatsapp: string | null
  negotiable: boolean
  condition: 'new' | 'used' | null
  seller: Seller | null
}

type TypeFilter = 'all' | ListingType

const CURRENCIES = ['NGN', 'USD', 'GHS', 'KES']
const RENT_UNITS = ['hour', 'day', 'week', 'month', 'season']
const BUY_UNITS = ['piece', 'set']

type Form = {
  name: string
  category: string
  listingType: ListingType
  price: string
  currency: string
  unit: string
  condition: Condition
  negotiable: boolean
  location: string
  whatsapp: string
  description: string
  status: Status
  images: string[]
}

const EMPTY_FORM: Form = {
  name: '', category: '', listingType: 'rent', price: '', currency: 'NGN', unit: 'day', condition: '',
  negotiable: false, location: '', whatsapp: '', description: '', status: 'available', images: [],
}

const COLUMNS =
  'id, seller_id, name, category, description, listing_type, price, currency, unit, location, images, status, whatsapp, negotiable, condition, seller:profiles!equipment_seller_id_fkey(full_name, username, profile_image, phone, is_premium)'

export default function EquipmentPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [items, setItems] = useState<Equipment[]>([])
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [myDefaults, setMyDefaults] = useState({ location: '', whatsapp: '' })
  const [imageCap, setImageCap] = useState(5)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<TypeFilter>((searchParams.get('type') as TypeFilter) || 'all')
  const [mineOnly, setMineOnly] = useState(searchParams.get('mine') === '1')
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Form>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [formError, setFormError] = useState('')

  const [detail, setDetail] = useState<Equipment | null>(null)

  const setField = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }))

  const itemsQuery = (from: number, to: number) => {
    let q = supabase.from('equipment').select(COLUMNS)
    if (mineOnly) {
      q = q.eq('seller_id', user!.id)
    } else {
      q = user ? q.or(`status.eq.available,seller_id.eq.${user.id}`) : q.eq('status', 'available')
    }
    if (filter !== 'all') q = q.eq('listing_type', filter)
    const term = search.trim().replace(/[%,()*\\]/g, ' ').trim()
    if (term) q = q.ilike('name', `%${term}%`)
    return q.order('created_at', { ascending: false }).range(from, to)
  }

  const load = async () => {
    if (!user) return
    setNetError(false)
    setLoading(true)

    const [itemsRes, savedRes, meRes] = await Promise.all([
      itemsQuery(0, PAGE_SIZE - 1),
      supabase.from('saved_items').select('equipment_id').eq('user_id', user.id).not('equipment_id', 'is', null),
      supabase.from('profiles').select('location, whatsapp, is_premium').eq('user_id', user.id).maybeSingle(),
    ])

    if (itemsRes.error) {
      setNetError(true)
      setLoading(false)
      return
    }

    const page = (itemsRes.data || []) as any as Equipment[]
    setItems(page)
    setHasMore(page.length === PAGE_SIZE)
    setSavedIds(new Set((savedRes.data || []).map((r: any) => r.equipment_id)))
    const me = meRes.data as any
    setMyDefaults({ location: me?.location || '', whatsapp: me?.whatsapp || '' })
    setImageCap(me?.is_premium ? 10 : 5)
    setLoading(false)
  }

  const loadMore = async () => {
    if (!user || loadingMore) return
    setLoadingMore(true)
    const { data, error } = await itemsQuery(items.length, items.length + PAGE_SIZE - 1)
    if (!error) {
      const more = (data || []) as any as Equipment[]
      setItems((prev) => [...prev, ...more])
      setHasMore(more.length === PAGE_SIZE)
    }
    setLoadingMore(false)
  }

  useEffect(() => { load() }, [user, filter, mineOnly])

  useEffect(() => {
    if (!user) return
    const timer = setTimeout(() => load(), 300)
    return () => clearTimeout(timer)
  }, [search])

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

  const openEdit = (it: Equipment) => {
    setDetail(null)
    setEditingId(it.id)
    setForm({
      name: it.name,
      category: it.category || '',
      listingType: it.listing_type,
      price: String(it.price),
      currency: it.currency || 'NGN',
      unit: it.unit || (it.listing_type === 'rent' ? 'day' : 'piece'),
      condition: it.condition || '',
      negotiable: !!it.negotiable,
      location: it.location || '',
      whatsapp: it.whatsapp || '',
      description: it.description || '',
      status: it.status,
      images: it.images || [],
    })
    setFormError('')
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const changeType = (t: ListingType) => {
    setForm((f) => ({ ...f, listingType: t, unit: t === 'rent' ? 'day' : 'piece' }))
  }

  const handleSave = async () => {
    if (!user || uploading) return
    setFormError('')

    const priceNum = Number(form.price)
    if (!form.name.trim()) return setFormError('Enter the equipment name.')
    if (form.price.trim() === '' || Number.isNaN(priceNum) || priceNum < 0) return setFormError('Enter a valid price.')
    if (form.images.length === 0) return setFormError('Add at least one photo.')
    const phoneErr = validatePhone(form.whatsapp)
    if (phoneErr) return setFormError(phoneErr)

    const payload = {
      name: form.name.trim(),
      category: form.category.trim() || null,
      description: form.description.trim() || null,
      listing_type: form.listingType,
      price: priceNum,
      currency: form.currency,
      unit: form.unit || null,
      condition: form.condition || null,
      negotiable: form.negotiable,
      location: form.location.trim() || null,
      whatsapp: cleanPhone(form.whatsapp) || null,
      status: form.status,
      images: form.images,
    }

    setSaving(true)
    const { error } = editingId
      ? await supabase.from('equipment').update(payload).eq('id', editingId).eq('seller_id', user.id)
      : await supabase.from('equipment').insert({ ...payload, seller_id: user.id })
    setSaving(false)

    if (error) {
      setFormError(error.message || 'Could not save this equipment listing.')
      return
    }

    closeForm()
    load()
  }

  const handleDelete = async () => {
    if (!user || !editingId) return
    if (!window.confirm('Delete this listing? This cannot be undone.')) return
    const { error } = await supabase.from('equipment').delete().eq('id', editingId).eq('seller_id', user.id)
    if (error) {
      setFormError('Could not delete the listing. Try again.')
      return
    }
    closeForm()
    load()
  }

  const toggleSave = async (equipmentId: string) => {
    if (!user) return
    if (savedIds.has(equipmentId)) {
      await supabase.from('saved_items').delete().eq('user_id', user.id).eq('equipment_id', equipmentId)
      setSavedIds((prev) => { const next = new Set(prev); next.delete(equipmentId); return next })
    } else {
      await supabase.from('saved_items').insert({ user_id: user.id, equipment_id: equipmentId })
      setSavedIds((prev) => new Set(prev).add(equipmentId))
    }
  }

  const filtered = items

  const onHeaderAdd = () => (showForm ? closeForm() : openNew())

  if (netError) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <Header onBack={() => navigate('/')} onAdd={onHeaderAdd} open={showForm} />
        <NetworkError onRetry={load} />
      </div>
    )
  }

  const units = form.listingType === 'rent' ? RENT_UNITS : BUY_UNITS

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '30px' }}>
      <Header onBack={() => navigate('/')} onAdd={onHeaderAdd} open={showForm} />

      <div style={{ padding: '16px' }}>
        {mineOnly && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#DCFCE7', borderRadius: '10px', padding: '9px 12px', marginBottom: '12px' }}>
            <p style={{ flex: 1, fontSize: '12px', fontWeight: 700, color: COLORS.greenDark }}>Showing your equipment</p>
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
            placeholder="Search equipment..."
            style={{ width: '100%', padding: '11px 14px 11px 36px', borderRadius: '12px', border: `1px solid ${COLORS.border}`, fontSize: '13px', boxSizing: 'border-box', background: COLORS.card }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {(['all', 'buy', 'rent'] as TypeFilter[]).map((f) => (
            <Chip key={f} active={filter === f} onClick={() => setFilter(f)} label={f === 'all' ? 'All' : f === 'buy' ? 'Buy' : 'Rent'} />
          ))}
        </div>

        {showForm && (
          <div style={{ background: COLORS.card, borderRadius: '16px', padding: '16px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px', color: COLORS.text }}>{editingId ? 'Edit equipment' : 'List equipment'}</p>
            <ErrorBanner text={formError} />

            <p style={labelStyle}>Photos</p>
            <div style={{ marginBottom: '12px' }}>
              <ImageUploader value={form.images} onChange={(urls) => setField('images', urls)} folder="equipment" max={imageCap} onBusyChange={setUploading} />
            </div>

            <input value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="Name, e.g. Tractor (New Holland)" maxLength={100} style={inputStyle} />
            <input value={form.category} onChange={(e) => setField('category', e.target.value)} placeholder="Category, e.g. Tractors, Irrigation" maxLength={60} style={inputStyle} />

            <p style={labelStyle}>Type</p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <Chip active={form.listingType === 'rent'} onClick={() => changeType('rent')} label="For Rent" />
              <Chip active={form.listingType === 'buy'} onClick={() => changeType('buy')} label="For Sale" />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input value={form.price} onChange={(e) => setField('price', e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Price" inputMode="decimal" style={{ ...inputStyle, flex: 2 }} />
              <select value={form.currency} onChange={(e) => setField('currency', e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <select value={form.unit} onChange={(e) => setField('unit', e.target.value)} style={inputStyle}>
              {units.map((u) => <option key={u} value={u}>{form.listingType === 'rent' ? `per ${u}` : `per ${u}`}</option>)}
            </select>

            <p style={labelStyle}>Condition</p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <Chip active={form.condition === 'new'} onClick={() => setField('condition', form.condition === 'new' ? '' : 'new')} label="New" />
              <Chip active={form.condition === 'used'} onClick={() => setField('condition', form.condition === 'used' ? '' : 'used')} label="Used" />
            </div>

            <div onClick={() => setField('negotiable', !form.negotiable)} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', cursor: 'pointer' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '6px', border: `1.5px solid ${form.negotiable ? COLORS.green : COLORS.border}`, background: form.negotiable ? COLORS.green : COLORS.card, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {form.negotiable && <Icon name="check" size={13} color="white" strokeWidth={3} />}
              </div>
              <p style={{ fontSize: '12.5px', color: COLORS.text }}>Price is negotiable</p>
            </div>

            <input value={form.location} onChange={(e) => setField('location', e.target.value)} placeholder="Location" maxLength={80} style={inputStyle} />
            <input value={form.whatsapp} onChange={(e) => setField('whatsapp', e.target.value)} placeholder="WhatsApp, e.g. +2348012345678" inputMode="tel" style={inputStyle} />
            <textarea value={form.description} onChange={(e) => setField('description', e.target.value)} placeholder="Description: model, year, power, delivery..." rows={3} maxLength={1000} style={{ ...inputStyle, resize: 'none' }} />

            {editingId && (
              <>
                <p style={labelStyle}>Status</p>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <Chip active={form.status === 'available'} onClick={() => setField('status', 'available')} label="Available" />
                  <Chip active={form.status === 'unavailable'} onClick={() => setField('status', 'unavailable')} label="Unavailable" />
                </div>
              </>
            )}

            <div onClick={saving || uploading ? undefined : handleSave} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: COLORS.green, color: 'white', padding: '11px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', opacity: saving || uploading ? 0.6 : 1 }}>
              <Icon name={editingId ? 'check' : 'upload'} size={15} color="white" />
              {saving ? 'Saving...' : uploading ? 'Uploading photos...' : editingId ? 'Save Changes' : 'Post Equipment'}
            </div>

            {editingId && (
              <div onClick={handleDelete} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '10px', padding: '10px', borderRadius: '10px', border: '1px solid #FECACA', color: COLORS.red, fontWeight: 700, fontSize: '12.5px', cursor: 'pointer' }}>
                <Icon name="trash" size={14} color={COLORS.red} /> Delete Listing
              </div>
            )}
          </div>
        )}

        {loading ? (
          <ListCardSkeleton count={5} />
        ) : filtered.length === 0 ? (
          <div style={{ background: COLORS.card, padding: '32px 20px', textAlign: 'center', borderRadius: '14px', color: COLORS.textMuted, fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
              <Icon name="tractor" size={28} color={COLORS.textMuted} />
            </div>
            {items.length === 0 ? 'No equipment listed yet. Tap + to add the first one.' : 'No equipment matches your search or filter.'}
          </div>
        ) : (
          filtered.map((it) => (
            <div key={it.id} onClick={() => setDetail(it)} style={{ background: COLORS.card, borderRadius: '14px', padding: '12px', marginBottom: '10px', display: 'flex', gap: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', cursor: 'pointer' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '10px', flexShrink: 0, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
                {it.images?.[0] ? <img src={it.images[0]} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="tractor" size={26} color={COLORS.orange} />}
                {(it.images?.length || 0) > 1 && (
                  <div style={{ position: 'absolute', left: '3px', bottom: '3px', display: 'flex', alignItems: 'center', gap: '2px', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '999px' }}>
                    <Icon name="image" size={9} color="white" /> {it.images?.length}
                  </div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name}</p>
                {it.location && (
                  <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <Icon name="mapPin" size={10} color={COLORS.textMuted} /> {it.location}
                  </p>
                )}
                <p style={{ fontSize: '12.5px', fontWeight: 800, color: COLORS.green, marginTop: '4px' }}>
                  {formatMoney(Number(it.price), it.currency)}{it.unit ? ` / ${it.unit}` : ''}
                </p>
                {it.seller_id === user?.id && (
                  <p style={{ fontSize: '10px', fontWeight: 700, color: it.status === 'available' ? COLORS.orange : COLORS.red, marginTop: '3px' }}>
                    {it.status === 'available' ? 'Your listing' : 'Your listing · Unavailable'}
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div onClick={(e) => { e.stopPropagation(); toggleSave(it.id) }} style={{ cursor: 'pointer' }}>
                  <Icon name="bookmark" size={16} color={savedIds.has(it.id) ? COLORS.orange : COLORS.textMuted} />
                </div>
                <div style={{ padding: '5px 11px', borderRadius: '8px', background: it.listing_type === 'rent' ? COLORS.orange : COLORS.green, color: 'white', fontSize: '10.5px', fontWeight: 700 }}>
                  {it.listing_type === 'rent' ? 'Rent' : 'Buy'}
                </div>
              </div>
            </div>
          ))
        )}

        <LoadMoreButton onClick={loadMore} loading={loadingMore} hasMore={hasMore && !loading} />
      </div>

      {detail && (
        <DetailSheet
          item={detail}
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

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '7px 16px', borderRadius: '10px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
        background: active ? COLORS.green : COLORS.card,
        color: active ? 'white' : COLORS.textMuted,
        border: `1px solid ${active ? COLORS.green : COLORS.border}`,
      }}>
      {label}
    </div>
  )
}

function DetailSheet({ item: it, isMine, saved, onToggleSave, onEdit, onClose }: {
  item: Equipment
  isMine: boolean
  saved: boolean
  onToggleSave: () => void
  onEdit: () => void
  onClose: () => void
}) {
  const images = it.images || []
  const callNumber = it.seller?.phone || ''

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: COLORS.card, width: '100%', maxWidth: '480px', maxHeight: '92vh', overflowY: 'auto', borderRadius: '20px 20px 0 0' }}>
        <div style={{ position: 'relative' }}>
          {images.length > 0 ? (
            <div style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory' }}>
              {images.map((url) => (
                <img key={url} src={url} alt={it.name} style={{ width: '100%', height: '240px', objectFit: 'cover', flexShrink: 0, scrollSnapAlign: 'start' }} />
              ))}
            </div>
          ) : (
            <div style={{ height: '160px', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="tractor" size={40} color={COLORS.orange} />
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
            <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text, flex: 1 }}>{it.name}</p>
            <div onClick={onToggleSave} style={{ cursor: 'pointer', display: 'flex', padding: '2px' }}>
              <Icon name="bookmark" size={20} color={saved ? COLORS.orange : COLORS.textMuted} />
            </div>
          </div>

          <p style={{ fontSize: '18px', fontWeight: 800, color: COLORS.green, marginTop: '6px' }}>
            {formatMoney(Number(it.price), it.currency)}{it.unit ? ` / ${it.unit}` : ''}
            {it.negotiable && <span style={{ fontSize: '11px', fontWeight: 700, color: COLORS.orange, marginLeft: '8px' }}>Negotiable</span>}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '12px' }}>
            <DetailRow icon="tag" text={`${it.listing_type === 'rent' ? 'For rent' : 'For sale'}${it.category ? ` · ${it.category}` : ''}`} />
            {it.condition && <DetailRow icon="check" text={it.condition === 'new' ? 'New' : 'Used'} />}
            {it.location && <DetailRow icon="mapPin" text={it.location} />}
            {it.status !== 'available' && <DetailRow icon="alertTriangle" text="Not available right now" color={COLORS.red} />}
          </div>

          {it.description && <p style={{ fontSize: '13px', color: COLORS.text, lineHeight: 1.5, marginTop: '14px' }}>{it.description}</p>}

          {it.seller && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '16px', padding: '12px', background: COLORS.bg, borderRadius: '12px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '19px', background: '#DCFCE7', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {it.seller.profile_image ? <img src={it.seller.profile_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="user" size={18} color={COLORS.green} />}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text }}>{it.seller.full_name || it.seller.username || 'Seller'}</p>
                {it.seller.is_premium && <PremiumBadge />}
              </div>
                {it.seller.username && <p style={{ fontSize: '11px', color: COLORS.textMuted }}>@{it.seller.username}</p>}
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
                {it.whatsapp && (
                  <a href={whatsappLink(it.whatsapp)} target="_blank" rel="noopener noreferrer" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: COLORS.green, color: 'white', padding: '12px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', textDecoration: 'none' }}>
                    <Icon name="message" size={15} color="white" /> WhatsApp
                  </a>
                )}
                {callNumber && (
                  <a href={`tel:${cleanPhone(callNumber)}`} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', border: `1px solid ${COLORS.green}`, color: COLORS.green, padding: '12px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', textDecoration: 'none' }}>
                    <Icon name="phone" size={15} color={COLORS.green} /> Call
                  </a>
                )}
                {!it.whatsapp && !callNumber && (
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
        <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>Equipment</p>
      </div>
      <div onClick={onAdd} style={{ width: '36px', height: '36px', borderRadius: '10px', background: COLORS.green, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <Icon name={open ? 'close' : 'plus'} size={18} color="white" />
      </div>
    </div>
  )
}
