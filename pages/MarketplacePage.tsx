import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import Icon from '../Icons'
import { GridCardSkeleton } from '../LoadingSkeleton'
import NetworkError from '../NetworkError'

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

type Listing = {
  id: string
  seller_id: string
  category: 'crop' | 'livestock' | 'seed'
  title: string
  description: string | null
  price: number
  currency: string
  unit: string | null
  location: string | null
  images: string[] | null
  status: string
}

type CategoryFilter = 'all' | 'crop' | 'livestock' | 'seed'

const CATEGORIES: { value: CategoryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'crop', label: 'Crops' },
  { value: 'livestock', label: 'Livestock' },
  { value: 'seed', label: 'Seeds' },
]

export default function MarketplacePage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [listings, setListings] = useState<Listing[]>([])
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<CategoryFilter>('all')

  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<'crop' | 'livestock' | 'seed'>('crop')
  const [price, setPrice] = useState('')
  const [unit, setUnit] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')

  const load = async () => {
    if (!user) return
    setNetError(false)
    setLoading(true)

    const [listingsRes, savedRes] = await Promise.all([
      supabase.from('marketplace_listings').select('id, seller_id, category, title, description, price, currency, unit, location, images, status').order('created_at', { ascending: false }),
      supabase.from('saved_items').select('listing_id').eq('user_id', user.id).not('listing_id', 'is', null),
    ])

    if (listingsRes.error) {
      setNetError(true)
      setLoading(false)
      return
    }

    setListings((listingsRes.data || []) as any)
    setSavedIds(new Set((savedRes.data || []).map((r: any) => r.listing_id)))
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  const resetForm = () => {
    setTitle('')
    setCategory('crop')
    setPrice('')
    setUnit('')
    setLocation('')
    setDescription('')
    setFormError('')
  }

  const handleAdd = async () => {
    if (!user || !title.trim() || !price) return
    setFormError('')

    const priceNum = Number(price)
    if (!priceNum || priceNum < 0) {
      setFormError('Enter a valid price.')
      return
    }

    setSaving(true)
    const { error } = await supabase.from('marketplace_listings').insert({
      seller_id: user.id,
      category,
      title: title.trim(),
      description: description.trim() || null,
      price: priceNum,
      currency: 'NGN',
      unit: unit.trim() || null,
      location: location.trim() || null,
      status: 'available',
    })
    setSaving(false)

    if (error) {
      setFormError(error.message || 'Could not save your listing.')
      return
    }

    resetForm()
    setShowForm(false)
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

  const filtered = listings.filter((l) => {
    if (l.status !== 'available' && l.seller_id !== user?.id) return false
    if (filter !== 'all' && l.category !== filter) return false
    if (search.trim() && !l.title.toLowerCase().includes(search.trim().toLowerCase())) return false
    return true
  })

  if (netError) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <Header onBack={() => navigate('/')} onAdd={() => setShowForm(!showForm)} />
        <NetworkError onRetry={load} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '30px' }}>
      <Header onBack={() => navigate('/')} onAdd={() => { setShowForm(!showForm); if (showForm) resetForm() }} />

      <div style={{ padding: '16px' }}>
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
            <p style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px', color: COLORS.text }}>New listing</p>

            {formError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '10px 12px', marginBottom: '10px' }}>
                <p style={{ fontSize: '11.5px', color: COLORS.red }}>{formError}</p>
              </div>
            )}

            <select value={category} onChange={(e) => setCategory(e.target.value as any)} style={inputStyle}>
              <option value="crop">Crop</option>
              <option value="livestock">Livestock</option>
              <option value="seed">Seed</option>
            </select>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title, e.g. Maize (White)" style={inputStyle} />
            <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Price (NGN)" inputMode="decimal" style={inputStyle} />
            <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Unit, e.g. ton, bag, per measure" style={inputStyle} />
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location, e.g. Kaduna, Nigeria" style={inputStyle} />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" rows={3} style={{ ...inputStyle, resize: 'none', marginBottom: '12px' }} />

            <div onClick={saving ? undefined : handleAdd} style={{ background: COLORS.green, color: 'white', textAlign: 'center', padding: '11px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Posting...' : 'Post Listing'}
            </div>
          </div>
        )}

        {loading ? (
          <GridCardSkeleton count={6} />
        ) : filtered.length === 0 ? (
          <div style={{ background: COLORS.card, padding: '32px 20px', textAlign: 'center', borderRadius: '14px', color: COLORS.textMuted, fontSize: '13px' }}>
            {listings.length === 0 ? 'No listings yet. Tap + to add the first one.' : 'No listings match your search or filter.'}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {filtered.map((l) => (
              <div key={l.id} style={{ background: COLORS.card, borderRadius: '14px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ width: '100%', height: '90px', background: '#E5EFE5', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  {l.images?.[0] ? <img src={l.images[0]} alt={l.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="leaf" size={26} color={COLORS.green} />}
                  <div onClick={() => toggleSave(l.id)} style={{ position: 'absolute', top: '6px', right: '6px', width: '26px', height: '26px', borderRadius: '13px', background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <Icon name="bookmark" size={13} color={savedIds.has(l.id) ? COLORS.orange : COLORS.textMuted} />
                  </div>
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
      </div>
    </div>
  )
}

function Header({ onBack, onAdd }: { onBack: () => void; onAdd: () => void }) {
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
        <Icon name="plus" size={18} color="white" />
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`,
  marginBottom: '10px', fontSize: '13px', boxSizing: 'border-box', background: COLORS.bg,
}
