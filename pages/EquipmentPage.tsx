import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import { useLocale } from '../LocaleContext'
import Icon from '../Icons'
import { GridCardSkeleton } from '../LoadingSkeleton'
import NetworkError from '../NetworkError'

const COLORS = {
  bg: '#F8FAF6',
  card: '#FFFFFF',
  border: '#E5EFE5',
  green: '#16A34A',
  orange: '#F59E0B',
  text: '#1A2E1A',
  textMuted: '#5B6B5B',
  red: '#DC2626',
}

type Equipment = {
  id: string
  seller_id: string
  name: string
  category: string | null
  description: string | null
  listing_type: 'buy' | 'rent'
  price: number
  currency: string
  unit: string | null
  location: string | null
  images: string[] | null
  status: string
}

type TypeFilter = 'all' | 'buy' | 'rent'

export default function EquipmentPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { formatPrice } = useLocale()

  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [items, setItems] = useState<Equipment[]>([])
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<TypeFilter>('all')

  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [listingType, setListingType] = useState<'buy' | 'rent'>('rent')
  const [price, setPrice] = useState('')
  const [unit, setUnit] = useState('day')
  const [location, setLocation] = useState('')

  const load = async () => {
    if (!user) return
    setNetError(false)
    setLoading(true)

    const [itemsRes, savedRes] = await Promise.all([
      supabase.from('equipment').select('id, seller_id, name, category, description, listing_type, price, currency, unit, location, images, status').order('created_at', { ascending: false }),
      supabase.from('saved_items').select('equipment_id').eq('user_id', user.id).not('equipment_id', 'is', null),
    ])

    if (itemsRes.error) {
      setNetError(true)
      setLoading(false)
      return
    }

    setItems((itemsRes.data || []) as any)
    setSavedIds(new Set((savedRes.data || []).map((r: any) => r.equipment_id)))
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  const resetForm = () => {
    setName('')
    setCategory('')
    setListingType('rent')
    setPrice('')
    setUnit('day')
    setLocation('')
    setFormError('')
  }

  const handleAdd = async () => {
    if (!user || !name.trim() || !price) return
    setFormError('')

    const priceNum = Number(price)
    if (!priceNum || priceNum < 0) {
      setFormError('Enter a valid price.')
      return
    }

    setSaving(true)
    const { error } = await supabase.from('equipment').insert({
      seller_id: user.id,
      name: name.trim(),
      category: category.trim() || null,
      listing_type: listingType,
      price: priceNum,
      currency: 'USD',
      unit: unit.trim() || null,
      location: location.trim() || null,
      status: 'available',
    })
    setSaving(false)

    if (error) {
      setFormError(error.message || 'Could not save this equipment listing.')
      return
    }

    resetForm()
    setShowForm(false)
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

  const filtered = items.filter((it) => {
    if (it.status !== 'available' && it.seller_id !== user?.id) return false
    if (filter !== 'all' && it.listing_type !== filter) return false
    if (search.trim() && !it.name.toLowerCase().includes(search.trim().toLowerCase())) return false
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
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search equipment..."
          style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: `1px solid ${COLORS.border}`, marginBottom: '12px', fontSize: '13px', boxSizing: 'border-box', background: COLORS.card }}
        />

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {(['all', 'buy', 'rent'] as TypeFilter[]).map((f) => (
            <div
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '7px 16px', borderRadius: '10px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
                background: filter === f ? COLORS.green : COLORS.card,
                color: filter === f ? 'white' : COLORS.textMuted,
                border: `1px solid ${filter === f ? COLORS.green : COLORS.border}`,
              }}>
              {f === 'all' ? 'All' : f === 'buy' ? 'Buy' : 'Rent'}
            </div>
          ))}
        </div>

        {showForm && (
          <div style={{ background: COLORS.card, borderRadius: '16px', padding: '16px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px', color: COLORS.text }}>List equipment</p>

            {formError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '10px 12px', marginBottom: '10px' }}>
                <p style={{ fontSize: '11.5px', color: COLORS.red }}>{formError}</p>
              </div>
            )}

            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. Tractor (New Holland)" style={inputStyle} />
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category, e.g. Tractors, Irrigation" style={inputStyle} />
            <select value={listingType} onChange={(e) => setListingType(e.target.value as any)} style={inputStyle}>
              <option value="rent">For Rent</option>
              <option value="buy">For Sale</option>
            </select>
            <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Price" inputMode="decimal" style={inputStyle} />
            <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Unit, e.g. day, week" style={inputStyle} />
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" style={{ ...inputStyle, marginBottom: '12px' }} />

            <div onClick={saving ? undefined : handleAdd} style={{ background: COLORS.green, color: 'white', textAlign: 'center', padding: '11px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Posting...' : 'Post Equipment'}
            </div>
          </div>
        )}

        {loading ? (
          <GridCardSkeleton count={6} />
        ) : filtered.length === 0 ? (
          <div style={{ background: COLORS.card, padding: '32px 20px', textAlign: 'center', borderRadius: '14px', color: COLORS.textMuted, fontSize: '13px' }}>
            {items.length === 0 ? 'No equipment listed yet.' : 'No equipment matches your search or filter.'}
          </div>
        ) : (
          filtered.map((it) => (
            <div key={it.id} style={{ background: COLORS.card, borderRadius: '14px', padding: '12px', marginBottom: '10px', display: 'flex', gap: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '10px', flexShrink: 0, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {it.images?.[0] ? <img src={it.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="tractor" size={24} color={COLORS.orange} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>{it.name}</p>
                {it.location && (
                  <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <Icon name="mapPin" size={10} color={COLORS.textMuted} /> {it.location}
                  </p>
                )}
                <p style={{ fontSize: '12.5px', fontWeight: 800, color: COLORS.green, marginTop: '4px' }}>
                  {formatPrice(Number(it.price))}{it.unit ? ` / ${it.unit}` : ''}
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                <div onClick={() => toggleSave(it.id)} style={{ cursor: 'pointer' }}>
                  <Icon name="bookmark" size={16} color={savedIds.has(it.id) ? COLORS.orange : COLORS.textMuted} />
                </div>
                <div style={{ padding: '6px 12px', borderRadius: '8px', background: it.listing_type === 'rent' ? COLORS.orange : COLORS.green, color: 'white', fontSize: '10.5px', fontWeight: 700 }}>
                  {it.listing_type === 'rent' ? 'Rent Now' : 'Buy Now'}
                </div>
              </div>
            </div>
          ))
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
        <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>Equipment</p>
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
