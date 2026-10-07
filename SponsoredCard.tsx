import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'
import PremiumTick from './PremiumTick'
import { isPremiumActive } from './premiumShared'

const COLORS = {
  card: '#FFFFFF',
  border: '#E5EFE5',
  green: '#16A34A',
  greenDark: '#166534',
  greenSoft: '#DCFCE7',
  text: '#1A2E1A',
  textMuted: '#5B6B5B',
}

// What ads_for_slot() returns for each ad.
export type AdData = {
  id: string
  target_type: 'listing' | 'company'
  headline: string
  body: string | null
  image_url: string | null
  company: { id: string; name: string; logo_url: string | null; is_premium: boolean; premium_until: string | null }
  listing: {
    id: string
    title: string
    price: number
    currency: string
    unit: string | null
    images: string[] | null
    location: string | null
    contact_for_price: boolean
  } | null
}

function priceLabel(l: NonNullable<AdData['listing']>) {
  if (l.contact_for_price) return 'Contact for price'
  return `${l.currency} ${Number(l.price).toLocaleString()}${l.unit ? `/${l.unit}` : ''}`
}

// A paid FarmLite Ad, always clearly labelled "Sponsored".
// layout "grid" matches a Marketplace listing card, "wide" fits the Home feed.
// With `preview` it is a static preview (used while creating an ad): nothing is tracked or clickable.
export default function SponsoredCard({ ad, layout = 'grid', preview = false }: { ad: AdData; layout?: 'grid' | 'wide'; preview?: boolean }) {
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)
  const counted = useRef(false)

  // Count an impression once, when at least half of the ad has actually been on screen.
  useEffect(() => {
    if (preview || counted.current || !ref.current) return
    const el = ref.current
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !counted.current) {
        counted.current = true
        supabase.rpc('ad_track', { p_ad: ad.id, p_kind: 'impression' }).then(() => {}, () => {})
        io.disconnect()
      }
    }, { threshold: 0.5 })
    io.observe(el)
    return () => io.disconnect()
  }, [ad.id, preview])

  const image = ad.image_url || (ad.target_type === 'listing' ? ad.listing?.images?.[0] : null) || ad.company.logo_url || null
  const premium = isPremiumActive(ad.company.is_premium, ad.company.premium_until)
  const target = ad.target_type === 'listing' && ad.listing ? `/listing/${ad.listing.id}` : `/companies/${ad.company.id}`

  const open = () => {
    if (preview) return
    supabase.rpc('ad_track', { p_ad: ad.id, p_kind: 'click' }).then(() => {}, () => {})
    navigate(target)
  }

  const badge = (
    <div style={{ position: 'absolute', left: '6px', top: '6px', background: 'rgba(0,0,0,0.65)', color: 'white', fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '999px' }}>
      Sponsored
    </div>
  )

  const owner = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
      <p style={{ fontSize: '10.5px', color: COLORS.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ad.company.name}</p>
      {premium && <PremiumTick size={12} />}
    </div>
  )

  if (layout === 'wide') {
    return (
      <div ref={ref} onClick={open} style={{ background: COLORS.card, borderRadius: '16px', overflow: 'hidden', marginBottom: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', cursor: preview ? 'default' : 'pointer' }}>
        <div style={{ position: 'relative', width: '100%', height: '150px', background: COLORS.greenSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {image ? <img src={image} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name={ad.target_type === 'company' ? 'building' : 'leaf'} size={34} color={COLORS.green} />}
          {badge}
        </div>
        <div style={{ padding: '12px 14px' }}>
          {owner}
          <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, marginTop: '4px' }}>{ad.headline}</p>
          {ad.body && <p style={{ fontSize: '12.5px', color: COLORS.textMuted, lineHeight: 1.45, marginTop: '4px' }}>{ad.body}</p>}
          {ad.listing && <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.green, marginTop: '6px' }}>{priceLabel(ad.listing)}</p>}
          <div style={{ marginTop: '10px', display: 'inline-block', background: COLORS.green, color: 'white', fontSize: '12px', fontWeight: 800, padding: '8px 16px', borderRadius: '10px' }}>
            {ad.target_type === 'listing' ? 'View listing' : 'View company'}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div ref={ref} onClick={open} style={{ background: COLORS.card, borderRadius: '14px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', cursor: preview ? 'default' : 'pointer', border: `1px solid ${COLORS.greenSoft}` }}>
      <div style={{ width: '100%', height: '100px', background: '#E5EFE5', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {image ? <img src={image} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name={ad.target_type === 'company' ? 'building' : 'leaf'} size={26} color={COLORS.green} />}
        {badge}
      </div>
      <div style={{ padding: '10px' }}>
        <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ad.headline}</p>
        {ad.listing
          ? <p style={{ fontSize: '12.5px', fontWeight: 800, color: COLORS.green, marginTop: '4px' }}>{priceLabel(ad.listing)}</p>
          : <p style={{ fontSize: '11px', color: COLORS.greenDark, fontWeight: 700, marginTop: '4px' }}>View company</p>}
        <div style={{ marginTop: '4px' }}>{owner}</div>
      </div>
    </div>
  )
}
