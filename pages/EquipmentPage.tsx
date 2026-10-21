import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import Icon from '../Icons'
import { ListCardSkeleton } from '../LoadingSkeleton'
import NetworkError from '../NetworkError'
import EquipmentCard from '../EquipmentCard'
import { Chip, PrimaryButton, SelectField, TextField } from '../EquipmentFormKit'
import { COLORS, LoadMoreButton, PAGE_SIZE } from '../shared'
import {
  CONDITION_OPTIONS, COUNTRIES, CURRENCIES, EQUIPMENT_CATEGORIES, EQUIP_SELECT, SERVICE_CATEGORIES,
} from '../equipmentConfig'
import type { DbType, EquipmentRow } from '../equipmentConfig'

type TypeTab = 'all' | DbType

type Filters = {
  category: string
  condition: string
  country: string
  state: string
  city: string
  brand: string
  minPrice: string
  maxPrice: string
  currency: string
  availableNow: boolean
}

const NO_FILTERS: Filters = { category: '', condition: '', country: '', state: '', city: '', brand: '', minPrice: '', maxPrice: '', currency: 'NGN', availableNow: false }

const TABS: { key: TypeTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'buy', label: 'For Sale' },
  { key: 'rent', label: 'For Rent' },
  { key: 'service', label: 'Services' },
]

function clean(s: string): string {
  return s.trim().replace(/[%,()*\\]/g, ' ').replace(/\s+/g, ' ').trim()
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function activeCount(f: Filters): number {
  let n = 0
  if (f.condition) n++
  if (f.country) n++
  if (f.state.trim()) n++
  if (f.city.trim()) n++
  if (f.brand.trim()) n++
  if (f.minPrice.trim() || f.maxPrice.trim()) n++
  if (f.availableNow) n++
  return n
}

// Old links (Account > My Equipment uses ?mine=1) keep working
export default function EquipmentPage() {
  const [searchParams] = useSearchParams()
  if (searchParams.get('mine') === '1') return <Navigate to="/equipment/mine" replace />
  return <EquipmentBrowse />
}

function EquipmentBrowse() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()

  const startType = searchParams.get('type')
  const [tab, setTab] = useState<TypeTab>(startType === 'buy' || startType === 'rent' || startType === 'service' ? startType : 'all')
  const [search, setSearch] = useState(() => (searchParams.get('q') || '').slice(0, 80))
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [draft, setDraft] = useState<Filters>(NO_FILTERS)
  const [sheetOpen, setSheetOpen] = useState(false)

  const [items, setItems] = useState<EquipmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const seq = useRef(0)

  const buildQuery = (from: number, to: number) => {
    let q = supabase.from('equipment').select(EQUIP_SELECT).eq('status', 'available').eq('is_hidden_by_admin', false)
    if (tab !== 'all') q = q.eq('listing_type', tab)

    if (filters.category) q = tab === 'service' ? q.eq('service_category', filters.category) : q.eq('category', filters.category)

    const term = clean(search)
    if (term) {
      const like = `%${term}%`
      q = q.or(['name', 'brand', 'model', 'category', 'service_category', 'city', 'state'].map((c) => `${c}.ilike.${like}`).join(','))
    }

    const cond = CONDITION_OPTIONS.find((o) => o.key === filters.condition)
    if (cond) {
      q = q.eq('condition', cond.condition)
      if (cond.grade) q = q.eq('condition_grade', cond.grade)
    }
    if (filters.country) q = q.eq('country', filters.country)
    const st = clean(filters.state)
    if (st) q = q.ilike('state', `%${st}%`)
    const city = clean(filters.city)
    if (city) q = q.ilike('city', `%${city}%`)
    const brand = clean(filters.brand)
    if (brand) q = q.ilike('brand', `%${brand}%`)

    if (filters.minPrice.trim() || filters.maxPrice.trim()) {
      // a price range only makes sense in one currency, and quote-only services have no price
      q = q.eq('currency', filters.currency).or('price_mode.is.null,price_mode.neq.quote')
      const min = Number(filters.minPrice)
      const max = Number(filters.maxPrice)
      if (filters.minPrice.trim() && !Number.isNaN(min)) q = q.gte('price', min)
      if (filters.maxPrice.trim() && !Number.isNaN(max)) q = q.lte('price', max)
    }
    if (filters.availableNow) {
      const t = todayStr()
      q = q.or(`available_from.is.null,available_from.lte.${t}`).or(`available_until.is.null,available_until.gte.${t}`)
    }
    return q.order('created_at', { ascending: false }).range(from, to)
  }

  const load = async () => {
    const mine = ++seq.current
    setNetError(false)
    setLoading(true)
    const { data, error } = await buildQuery(0, PAGE_SIZE - 1)
    if (mine !== seq.current) return
    if (error) {
      setNetError(true)
      setLoading(false)
      return
    }
    const page = (data || []) as unknown as EquipmentRow[]
    setItems(page)
    setHasMore(page.length === PAGE_SIZE)
    setLoading(false)
  }

  const loadMore = async () => {
    if (loadingMore) return
    const mine = seq.current
    setLoadingMore(true)
    const { data, error } = await buildQuery(items.length, items.length + PAGE_SIZE - 1)
    if (mine === seq.current && !error) {
      const more = (data || []) as unknown as EquipmentRow[]
      setItems((prev) => [...prev, ...more.filter((m) => !prev.some((p) => p.id === m.id))])
      setHasMore(more.length === PAGE_SIZE)
    }
    setLoadingMore(false)
  }

  useEffect(() => {
    if (!user) return
    supabase.from('saved_items').select('equipment_id').eq('user_id', user.id).not('equipment_id', 'is', null)
      .then(({ data }) => setSavedIds(new Set((data || []).map((r: any) => r.equipment_id as string))))
  }, [user])

  // tabs and filters load straight away; typing waits a moment
  useEffect(() => { load() }, [tab, filters])
  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return }
    const t = setTimeout(load, 350)
    return () => clearTimeout(t)
  }, [search])

  const toggleSave = async (id: string) => {
    if (!user) return
    if (savedIds.has(id)) {
      setSavedIds((prev) => { const n = new Set(prev); n.delete(id); return n })
      const { error } = await supabase.from('saved_items').delete().eq('user_id', user.id).eq('equipment_id', id)
      if (error) setSavedIds((prev) => new Set(prev).add(id))
    } else {
      setSavedIds((prev) => new Set(prev).add(id))
      const { error } = await supabase.from('saved_items').insert({ user_id: user.id, equipment_id: id })
      if (error) setSavedIds((prev) => { const n = new Set(prev); n.delete(id); return n })
    }
  }

  const changeTab = (t: TypeTab) => {
    setTab(t)
    setFilters((f) => ({ ...f, category: '' }))
  }

  const openSheet = () => { setDraft(filters); setSheetOpen(true) }
  const applySheet = () => { setFilters(draft); setSheetOpen(false) }
  const resetAll = () => { setFilters(NO_FILTERS); setDraft(NO_FILTERS); setSearch(''); setTab('all'); setSheetOpen(false) }

  const nActive = activeCount(filters)
  const anyFilter = nActive > 0 || !!filters.category || !!search.trim() || tab !== 'all'
  const categories = tab === 'service' ? SERVICE_CATEGORIES : EQUIPMENT_CATEGORIES

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button type="button" aria-label="Go back" onClick={() => navigate('/')} style={{ display: 'flex', background: 'none', border: 'none', padding: '4px', cursor: 'pointer' }}>
            <Icon name="arrowLeft" size={22} color={COLORS.text} />
          </button>
          <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>Equipment Marketplace</p>
        </div>
        <button type="button" onClick={() => navigate('/equipment/mine')}
          style={{ minHeight: '36px', padding: '0 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, background: COLORS.card, color: COLORS.greenDark, fontSize: '12px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
          My Listings
        </button>
      </div>

      <div style={{ padding: '16px' }}>
        <p style={{ fontSize: '13px', color: COLORS.textMuted, lineHeight: 1.5, marginBottom: '14px' }}>
          Discover agricultural machinery, tools, rental services, and equipment professionals.
        </p>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}><Icon name="search" size={16} color={COLORS.textMuted} /></div>
            <input value={search} onChange={(e) => setSearch(e.target.value.slice(0, 80))} placeholder="Search name, brand, category or place" aria-label="Search equipment"
              style={{ width: '100%', padding: '12px 14px 12px 36px', borderRadius: '12px', border: `1px solid ${COLORS.border}`, fontSize: '13.5px', boxSizing: 'border-box', background: COLORS.card }} />
          </div>
          <button type="button" aria-label="Filters" onClick={openSheet}
            style={{ position: 'relative', width: '46px', borderRadius: '12px', border: `1px solid ${nActive ? COLORS.green : COLORS.border}`, background: nActive ? 'var(--fx-tint-green3)' : COLORS.card, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="filter" size={18} color={nActive ? COLORS.green : COLORS.textMuted} />
            {nActive > 0 && <span style={{ position: 'absolute', top: '-5px', right: '-5px', minWidth: '18px', height: '18px', borderRadius: '9px', background: COLORS.green, color: 'white', fontSize: '10.5px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{nActive}</span>}
          </button>
        </div>

        <PrimaryButton icon="plus" onClick={() => navigate('/equipment/new')}>List Your Equipment</PrimaryButton>

        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '16px 0 4px' }}>
          {TABS.map((t) => <Chip key={t.key} active={tab === t.key} onClick={() => changeTab(t.key)} label={t.label} />)}
        </div>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '8px 0 14px' }}>
          <Chip small active={!filters.category} onClick={() => setFilters((f) => ({ ...f, category: '' }))} label="All categories" />
          {categories.map((c) => <Chip key={c} small active={filters.category === c} onClick={() => setFilters((f) => ({ ...f, category: f.category === c ? '' : c }))} label={c} />)}
        </div>

        {anyFilter && !loading && !netError && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <p style={{ fontSize: '12px', color: COLORS.textMuted }}>{items.length}{hasMore ? '+' : ''} result{items.length === 1 && !hasMore ? '' : 's'}</p>
            <button type="button" onClick={resetAll} style={{ background: 'none', border: 'none', fontSize: '12px', fontWeight: 800, color: COLORS.green, cursor: 'pointer', fontFamily: 'inherit' }}>Reset Filters</button>
          </div>
        )}

        {netError ? (
          <NetworkError onRetry={load} />
        ) : loading ? (
          <ListCardSkeleton count={4} />
        ) : items.length === 0 ? (
          <div style={{ background: COLORS.card, padding: '34px 20px', textAlign: 'center', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}><Icon name="tractor" size={32} color={COLORS.textMuted} /></div>
            <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text }}>{anyFilter ? 'No equipment matches your search' : 'No equipment has been listed yet'}</p>
            <p style={{ fontSize: '12.5px', color: COLORS.textMuted, margin: '6px 0 16px', lineHeight: 1.5 }}>
              {anyFilter ? 'Try a different word, remove a filter, or look at another category.' : 'Be the first to list machinery, a rental or an equipment service.'}
            </p>
            {anyFilter
              ? <PrimaryButton tone="ghost" onClick={resetAll}>Reset Filters</PrimaryButton>
              : <PrimaryButton icon="plus" onClick={() => navigate('/equipment/new')}>List Your Equipment</PrimaryButton>}
          </div>
        ) : (
          <>
            {items.map((it) => (
              <EquipmentCard key={it.id} item={it} onOpen={() => navigate(`/equipment/${it.id}`)} saved={savedIds.has(it.id)} onToggleSave={user ? () => toggleSave(it.id) : undefined} />
            ))}
            <LoadMoreButton onClick={loadMore} loading={loadingMore} hasMore={hasMore} />
          </>
        )}
      </div>

      {sheetOpen && (
        <div onClick={() => setSheetOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div role="dialog" aria-label="Filters" onClick={(e) => e.stopPropagation()} style={{ background: COLORS.card, width: '100%', maxWidth: '480px', maxHeight: '88vh', overflowY: 'auto', borderRadius: '20px 20px 0 0', padding: '18px 16px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>Filters</p>
              <button type="button" aria-label="Close filters" onClick={() => setSheetOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: '4px' }}><Icon name="close" size={20} color={COLORS.textMuted} /></button>
            </div>

            <SelectField id="f-cond" label="Condition" value={draft.condition} onChange={(v) => setDraft({ ...draft, condition: v })} options={CONDITION_OPTIONS.map((o): [string, string] => [o.key, o.label])} placeholder="Any condition"
              hint={tab === 'service' ? 'Condition does not apply to services.' : undefined} />
            <SelectField id="f-country" label="Country" value={draft.country} onChange={(v) => setDraft({ ...draft, country: v })} options={COUNTRIES} placeholder="Any country" />
            <TextField id="f-state" label="State or region" value={draft.state} onChange={(v) => setDraft({ ...draft, state: v })} placeholder="e.g. Kaduna" maxLength={60} />
            <TextField id="f-city" label="City or town" value={draft.city} onChange={(v) => setDraft({ ...draft, city: v })} placeholder="e.g. Zaria" maxLength={60} />
            <TextField id="f-brand" label="Brand" value={draft.brand} onChange={(v) => setDraft({ ...draft, brand: v })} placeholder="e.g. Massey Ferguson" maxLength={60} />

            <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text, marginBottom: '6px' }}>Price range</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1 }}><TextField id="f-min" label="Min" value={draft.minPrice} onChange={(v) => setDraft({ ...draft, minPrice: v.replace(/[^0-9.]/g, '') })} inputMode="decimal" placeholder="0" /></div>
              <div style={{ flex: 1 }}><TextField id="f-max" label="Max" value={draft.maxPrice} onChange={(v) => setDraft({ ...draft, maxPrice: v.replace(/[^0-9.]/g, '') })} inputMode="decimal" placeholder="Any" /></div>
              <div style={{ flex: 1 }}>
                <SelectField id="f-cur" label="Currency" value={draft.currency} onChange={(v) => setDraft({ ...draft, currency: v || 'NGN' })} options={CURRENCIES} placeholder="Currency" />
              </div>
            </div>
            <p style={{ fontSize: '11px', color: COLORS.textMuted, margin: '-6px 0 14px', lineHeight: 1.4 }}>Prices are compared in the currency you choose. Listings priced in another currency, and services that need a quote, are not included.</p>

            <div style={{ marginBottom: '16px' }}>
              <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text, marginBottom: '6px' }}>Availability</p>
              <Chip active={draft.availableNow} onClick={() => setDraft({ ...draft, availableNow: !draft.availableNow })} label="Rentals open today" />
              <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '6px', lineHeight: 1.4 }}>Hides rentals whose availability dates have not started or have ended. This uses the dates the owner entered, not live bookings.</p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <PrimaryButton tone="ghost" onClick={() => setDraft(NO_FILTERS)}>Clear</PrimaryButton>
              <PrimaryButton onClick={applySheet}>Show results</PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
