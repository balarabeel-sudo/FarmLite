// The owner's dashboard for their own equipment listings (sale, rent, services, drafts).
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import Icon from '../Icons'
import { ListCardSkeleton } from '../LoadingSkeleton'
import NetworkError from '../NetworkError'
import EquipmentCard from '../EquipmentCard'
import { Chip, ConfirmSheet, PageHeader, PrimaryButton } from '../EquipmentFormKit'
import { COLORS } from '../shared'
import { EQUIP_SELECT } from '../equipmentConfig'
import type { EquipmentRow } from '../equipmentConfig'

type Tab = 'all' | 'buy' | 'rent' | 'service' | 'draft' | 'live' | 'closed'

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All Listings' },
  { key: 'buy', label: 'For Sale' },
  { key: 'rent', label: 'For Rent' },
  { key: 'service', label: 'Services' },
  { key: 'draft', label: 'Drafts' },
  { key: 'live', label: 'Active' },
  { key: 'closed', label: 'Sold or Unavailable' },
]

type Pending = { kind: 'delete' | 'sold' | 'pause'; item: EquipmentRow } | null

export default function MyEquipmentPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [items, setItems] = useState<EquipmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [tab, setTab] = useState<Tab>('all')
  const [pending, setPending] = useState<Pending>(null)
  const [acting, setActing] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  const load = async () => {
    if (!user) return
    setLoading(true)
    setNetError(false)
    const { data, error } = await supabase.from('equipment').select(EQUIP_SELECT).eq('seller_id', user.id).order('updated_at', { ascending: false }).limit(200)
    if (error) { setNetError(true); setLoading(false); return }
    setItems((data || []) as unknown as EquipmentRow[])
    setLoading(false)
  }
  useEffect(() => { load() }, [user])

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { all: items.length, buy: 0, rent: 0, service: 0, draft: 0, live: 0, closed: 0 }
    for (const it of items) {
      c[it.listing_type]++
      if (it.status === 'draft') c.draft++
      else if (it.status === 'available') c.live++
      else c.closed++
    }
    return c
  }, [items])

  const visible = items.filter((it) => {
    if (tab === 'all') return true
    if (tab === 'buy' || tab === 'rent' || tab === 'service') return it.listing_type === tab
    if (tab === 'draft') return it.status === 'draft'
    if (tab === 'live') return it.status === 'available'
    return it.status === 'sold' || it.status === 'unavailable'
  })

  const setStatus = async (it: EquipmentRow, status: 'available' | 'unavailable' | 'sold') => {
    if (!user) return
    setActing(true)
    setMessage(null)
    const { error } = await supabase.from('equipment').update({ status }).eq('id', it.id).eq('seller_id', user.id)
    setActing(false)
    setPending(null)
    if (error) { setMessage({ text: error.message || 'Could not update the listing.', ok: false }); return }
    setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, status } : p)))
    setMessage({ text: status === 'sold' ? 'Marked as sold.' : status === 'unavailable' ? 'Listing paused. Buyers cannot see it.' : 'Listing is live again.', ok: true })
  }

  const remove = async (it: EquipmentRow) => {
    if (!user) return
    setActing(true)
    setMessage(null)
    const { error } = await supabase.from('equipment').delete().eq('id', it.id).eq('seller_id', user.id)
    setActing(false)
    setPending(null)
    if (error) { setMessage({ text: 'Could not delete the listing. Try again.', ok: false }); return }
    setItems((prev) => prev.filter((p) => p.id !== it.id))
    setMessage({ text: 'Listing deleted.', ok: true })
  }

  const actions = (it: EquipmentRow) => {
    const b = (label: string, onClick: () => void, danger?: boolean) => (
      <button key={label} type="button" onClick={onClick}
        style={{ minHeight: '34px', padding: '0 12px', borderRadius: '9px', border: `1px solid ${danger ? 'var(--fx-bd-red)' : COLORS.border}`, background: COLORS.card, color: danger ? COLORS.red : COLORS.greenDark, fontSize: '12px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
        {label}
      </button>
    )
    const list = []
    if (it.status !== 'draft') list.push(b('View', () => navigate(`/equipment/${it.id}`)))
    list.push(b(it.status === 'draft' ? 'Continue' : 'Edit', () => navigate(`/equipment/${it.id}/edit`)))
    if (it.status === 'available') {
      if (it.listing_type === 'buy') list.push(b('Mark as Sold', () => setPending({ kind: 'sold', item: it })))
      list.push(b(it.listing_type === 'rent' ? 'Mark Unavailable' : 'Pause Listing', () => setPending({ kind: 'pause', item: it })))
    }
    if (it.status === 'unavailable' || it.status === 'sold') list.push(b('Make Active', () => setStatus(it, 'available')))
    list.push(b('Delete', () => setPending({ kind: 'delete', item: it }), true))
    return <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', padding: '0 12px 12px' }}>{list}</div>
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>
      <PageHeader title="My Equipment Listings" onBack={() => navigate('/equipment')} />
      <div style={{ padding: '16px' }}>
        <PrimaryButton icon="plus" onClick={() => navigate('/equipment/new')}>List Your Equipment</PrimaryButton>

        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '14px 0' }}>
          {TABS.map((t) => <Chip key={t.key} small active={tab === t.key} onClick={() => setTab(t.key)} label={`${t.label} (${counts[t.key]})`} />)}
        </div>

        {message && (
          <div role="status" style={{ background: message.ok ? 'var(--fx-tint-green)' : 'var(--fx-tint-red2)', border: `1px solid ${message.ok ? 'var(--fx-bd-green)' : 'var(--fx-bd-red)'}`, borderRadius: '12px', padding: '10px 12px', marginBottom: '12px' }}>
            <p style={{ fontSize: '12.5px', fontWeight: 700, color: message.ok ? COLORS.greenDark : COLORS.red }}>{message.text}</p>
          </div>
        )}

        {netError ? <NetworkError onRetry={load} /> : loading ? <ListCardSkeleton count={3} /> : visible.length === 0 ? (
          <div style={{ background: COLORS.card, padding: '34px 20px', textAlign: 'center', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}><Icon name="tractor" size={32} color={COLORS.textMuted} /></div>
            <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text }}>{items.length === 0 ? 'You have not listed any equipment yet' : 'Nothing in this tab'}</p>
            <p style={{ fontSize: '12.5px', color: COLORS.textMuted, margin: '6px 0 16px', lineHeight: 1.5 }}>{items.length === 0 ? 'Sell machinery, rent it out, or offer equipment services.' : 'Try another tab.'}</p>
            {items.length === 0 && <PrimaryButton icon="plus" onClick={() => navigate('/equipment/new')}>List Your Equipment</PrimaryButton>}
          </div>
        ) : (
          visible.map((it) => <EquipmentCard key={it.id} item={it} showStatus onOpen={() => navigate(it.status === 'draft' ? `/equipment/${it.id}/edit` : `/equipment/${it.id}`)} footer={actions(it)} />)
        )}
      </div>

      <ConfirmSheet
        open={!!pending}
        busy={acting}
        danger={pending?.kind === 'delete'}
        title={pending?.kind === 'delete' ? 'Delete this listing?' : pending?.kind === 'sold' ? 'Mark as sold?' : 'Pause this listing?'}
        body={
          pending?.kind === 'delete' ? `“${pending.item.name}” will be removed for good. This cannot be undone.`
          : pending?.kind === 'sold' ? `“${pending?.item.name}” will be shown as sold and removed from the marketplace. You can make it active again later.`
          : `“${pending?.item.name}” will be hidden from buyers until you make it active again.`
        }
        confirmLabel={pending?.kind === 'delete' ? 'Delete' : pending?.kind === 'sold' ? 'Mark as Sold' : 'Pause'}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (!pending) return
          if (pending.kind === 'delete') remove(pending.item)
          else setStatus(pending.item, pending.kind === 'sold' ? 'sold' : 'unavailable')
        }}
      />
    </div>
  )
}
