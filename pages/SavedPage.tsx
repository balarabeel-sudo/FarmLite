import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import { useLocale } from '../LocaleContext'
import Icon from '../Icons'
import { ListCardSkeleton } from '../LoadingSkeleton'
import NetworkError from '../NetworkError'

const COLORS = {
  bg: '#F8FAF6',
  card: '#FFFFFF',
  border: '#E5EFE5',
  green: '#16A34A',
  text: '#1A2E1A',
  textMuted: '#5B6B5B',
}

type SavedRow = {
  id: string
  marketplace_listings: { id: string; title: string; price: number; currency: string; unit: string | null } | null
  equipment: { id: string; name: string; price: number; currency: string; unit: string | null } | null
  companies: { id: string; name: string; category: string } | null
  communities: { id: string; name: string; members_count: number } | null
}

type Tab = 'products' | 'companies' | 'communities'

export default function SavedPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { formatPrice } = useLocale()

  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [rows, setRows] = useState<SavedRow[]>([])
  const [tab, setTab] = useState<Tab>('products')

  const load = async () => {
    if (!user) return
    setNetError(false)
    setLoading(true)

    const { data, error } = await supabase
      .from('saved_items')
      .select(`
        id,
        marketplace_listings ( id, title, price, currency, unit ),
        equipment ( id, name, price, currency, unit ),
        companies ( id, name, category ),
        communities ( id, name, members_count )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      setNetError(true)
      setLoading(false)
      return
    }

    setRows((data || []) as any)
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  const unsave = async (savedItemId: string) => {
    await supabase.from('saved_items').delete().eq('id', savedItemId)
    setRows((prev) => prev.filter((r) => r.id !== savedItemId))
  }

  const products = rows.filter((r) => r.marketplace_listings || r.equipment)
  const companies = rows.filter((r) => r.companies)
  const communities = rows.filter((r) => r.communities)

  const visible = tab === 'products' ? products : tab === 'companies' ? companies : communities

  if (netError) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <Header onBack={() => navigate('/')} />
        <NetworkError onRetry={load} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '30px' }}>
      <Header onBack={() => navigate('/')} />

      <div style={{ padding: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {([
            { key: 'products', label: 'Products' },
            { key: 'companies', label: 'Companies' },
            { key: 'communities', label: 'Communities' },
          ] as { key: Tab; label: string }[]).map((tItem) => (
            <div
              key={tItem.key}
              onClick={() => setTab(tItem.key)}
              style={{
                flex: 1, textAlign: 'center', padding: '9px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                background: tab === tItem.key ? COLORS.green : COLORS.card,
                color: tab === tItem.key ? 'white' : COLORS.textMuted,
                border: `1px solid ${tab === tItem.key ? COLORS.green : COLORS.border}`,
              }}>
              {tItem.label}
            </div>
          ))}
        </div>

        {loading ? (
          <ListCardSkeleton count={3} />
        ) : visible.length === 0 ? (
          <div style={{ background: COLORS.card, padding: '48px 20px', textAlign: 'center', borderRadius: '14px' }}>
            <Icon name="heart" size={30} color={COLORS.textMuted} />
            <p style={{ fontSize: '13.5px', fontWeight: 700, color: COLORS.text, marginTop: '14px' }}>No saved items yet</p>
            <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '4px' }}>Save products and listings to find them here</p>
          </div>
        ) : (
          visible.map((row) => {
            const listing = row.marketplace_listings
            const equip = row.equipment
            const company = row.companies
            const community = row.communities

            const title = listing?.title || equip?.name || company?.name || community?.name || 'Untitled'
            const subtitle = listing
              ? formatPrice(Number(listing.price)) + (listing.unit ? `/${listing.unit}` : '')
              : equip
              ? formatPrice(Number(equip.price)) + (equip.unit ? `/${equip.unit}` : '')
              : company
              ? company.category
              : community
              ? `${community.members_count} members`
              : ''

            return (
              <div key={row.id} style={{ background: COLORS.card, borderRadius: '14px', padding: '14px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name={listing ? 'leaf' : equip ? 'tractor' : company ? 'building' : 'users'} size={20} color={COLORS.green} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</p>
                  <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '2px' }}>{subtitle}</p>
                </div>
                <div onClick={() => unsave(row.id)} style={{ cursor: 'pointer', padding: '4px' }}>
                  <Icon name="close" size={16} color={COLORS.textMuted} />
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px',
      background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      <div onClick={onBack} style={{ cursor: 'pointer', display: 'flex' }}>
        <Icon name="arrowLeft" size={22} color={COLORS.text} />
      </div>
      <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>Saved Items</p>
    </div>
  )
}
