import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import Icon from '../Icons'
import NetworkError from '../NetworkError'
import BuyEscrowSheet from '../BuyEscrowSheet'
import ReportSheet from '../ReportSheet'
import ListingChat from '../ListingChat'
import MarketplaceInbox from '../MarketplaceInbox'
import { NameWithTick } from '../PremiumTick'
import { trackView } from '../analyticsShared'
import { cleanPhone } from '../phoneUtils'
import { categoryShort, detailRows, unitText } from '../listingConfig'

const COLORS = {
  bg: '#F8FAF6',
  card: '#FFFFFF',
  border: '#E5EFE5',
  green: '#16A34A',
  greenDark: '#166534',
  greenSoft: '#DCFCE7',
  text: '#1A2E1A',
  textMuted: '#5B6B5B',
  red: '#DC2626',
  orange: '#F59E0B',
}

type Listing = {
  id: string
  seller_id: string
  category: string
  subcategory: string | null
  condition: string | null
  title: string
  description: string | null
  price: number
  currency: string
  unit: string | null
  quantity: number | null
  location: string | null
  negotiable: boolean
  contact_for_price: boolean
  free_delivery: boolean
  images: string[] | null
  status: 'available' | 'sold' | 'inactive'
  is_hidden_by_admin: boolean
  details: Record<string, any> | null
  seller: {
    full_name: string | null
    username: string | null
    profile_image: string | null
    phone: string | null
    is_premium: boolean
    premium_until: string | null
    is_verified: boolean
  } | null
}

const COLUMNS =
  'id, seller_id, category, subcategory, condition, title, description, price, currency, unit, quantity, location, negotiable, contact_for_price, free_delivery, images, status, is_hidden_by_admin, details, seller:profiles!marketplace_listings_seller_id_fkey(full_name, username, profile_image, phone, is_premium, premium_until, is_verified)'

const STATUS_CHIP: Record<string, { label: string; bg: string; color: string }> = {
  available: { label: 'Available', bg: COLORS.greenSoft, color: COLORS.greenDark },
  sold: { label: 'Sold', bg: '#FEE2E2', color: COLORS.red },
  inactive: { label: 'Hidden', bg: '#EEF2EE', color: COLORS.textMuted },
}

export default function ListingDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [listing, setListing] = useState<Listing | null>(null)
  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [saved, setSaved] = useState(false)
  const [imgIndex, setImgIndex] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [buyOpen, setBuyOpen] = useState(false)
  const [chat, setChat] = useState<{ prefill?: string } | null>(null)
  const [inboxOpen, setInboxOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = async () => {
    if (!id || !user) return
    setNetError(false)
    setLoading(true)
    const [res, savedRes] = await Promise.all([
      supabase.from('marketplace_listings').select(COLUMNS).eq('id', id).maybeSingle(),
      supabase.from('saved_items').select('listing_id').eq('user_id', user.id).eq('listing_id', id).maybeSingle(),
    ])
    if (res.error) {
      setNetError(true)
      setLoading(false)
      return
    }
    if (!res.data) {
      setNotFound(true)
      setLoading(false)
      return
    }
    setListing(res.data as any)
    setSaved(!!savedRes.data)
    setLoading(false)
    trackView('listing', id)
  }

  useEffect(() => { load() }, [id, user])

  const toggleSave = async () => {
    if (!user || !listing) return
    if (saved) {
      await supabase.from('saved_items').delete().eq('user_id', user.id).eq('listing_id', listing.id)
      setSaved(false)
    } else {
      await supabase.from('saved_items').insert({ user_id: user.id, listing_id: listing.id })
      setSaved(true)
    }
  }

  const share = async () => {
    if (!listing) return
    const url = `${window.location.origin}/listing/${listing.id}`
    try {
      if (navigator.share) await navigator.share({ title: listing.title, url })
      else {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 1800)
      }
    } catch {
      // the user closed the share sheet
    }
  }

  if (netError) {
    return (
      <Shell onBack={() => navigate(-1)}>
        <NetworkError onRetry={load} />
      </Shell>
    )
  }
  if (loading) return <Shell onBack={() => navigate(-1)}><p style={{ textAlign: 'center', padding: 40, fontSize: 13, color: COLORS.textMuted }}>Loading…</p></Shell>
  if (notFound || !listing) {
    return (
      <Shell onBack={() => navigate(-1)}>
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <p style={{ fontSize: 15, fontWeight: 800, color: COLORS.text }}>Listing not found</p>
          <p style={{ fontSize: 12.5, color: COLORS.textMuted, marginTop: 6 }}>It may have been removed or is no longer available.</p>
        </div>
      </Shell>
    )
  }

  const l = listing
  const isMine = l.seller_id === user?.id
  const images = l.images || []
  const chip = STATUS_CHIP[l.status] || STATUS_CHIP.available
  const seller = l.seller
  const callNumber = seller?.phone || ''
  const canContact = !isMine && l.status === 'available' && !l.is_hidden_by_admin
  const rows = detailRows(l.category, l.details, l.condition)
  const minOrder = l.details?.min_order

  return (
    <Shell onBack={() => navigate(-1)} onShare={share} onMenu={() => setMenuOpen((o) => !o)}>
      {menuOpen && (
        <div style={{ position: 'absolute', right: 12, top: 52, background: COLORS.card, borderRadius: 12, boxShadow: '0 6px 24px rgba(0,0,0,0.18)', zIndex: 40, overflow: 'hidden' }}>
          {!isMine && (
            <div onClick={() => { setMenuOpen(false); setReportOpen(true) }} style={{ padding: '12px 18px', fontSize: 13, fontWeight: 600, color: COLORS.red, cursor: 'pointer' }}>Report this listing</div>
          )}
          <div onClick={() => { setMenuOpen(false); setInboxOpen(true) }} style={{ padding: '12px 18px', fontSize: 13, fontWeight: 600, color: COLORS.text, cursor: 'pointer' }}>Marketplace messages</div>
        </div>
      )}
      {copied && <div style={{ position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)', background: COLORS.text, color: 'white', borderRadius: 999, padding: '8px 16px', fontSize: 12, fontWeight: 700, zIndex: 50 }}>Link copied</div>}

      {/* Images */}
      <div style={{ position: 'relative', background: '#E5EFE5' }}>
        {images.length > 0 ? (
          <div
            onScroll={(e) => {
              const el = e.currentTarget
              setImgIndex(Math.round(el.scrollLeft / el.clientWidth))
            }}
            style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory' }}>
            {images.map((url) => (
              <img key={url} src={url} alt={l.title} style={{ width: '100%', height: 260, objectFit: 'cover', flexShrink: 0, scrollSnapAlign: 'start' }} />
            ))}
          </div>
        ) : (
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="leaf" size={40} color={COLORS.green} /></div>
        )}
        <div onClick={toggleSave} style={{ position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: 18, background: 'rgba(255,255,255,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Icon name="bookmark" size={18} color={saved ? COLORS.orange : COLORS.textMuted} />
        </div>
        {images.length > 1 && (
          <span style={{ position: 'absolute', right: 12, bottom: 12, background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 999 }}>{imgIndex + 1}/{images.length}</span>
        )}
      </div>

      <div style={{ background: COLORS.card, borderRadius: '0 0 18px 18px', padding: '16px 18px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <p style={{ fontSize: 19, fontWeight: 800, color: COLORS.text, flex: 1 }}>{l.title}</p>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: chip.color, background: chip.bg, borderRadius: 10, padding: '5px 12px', whiteSpace: 'nowrap' }}>{chip.label}</span>
        </div>

        <p style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
          {l.contact_for_price ? (
            <span style={{ fontSize: 20, fontWeight: 800, color: COLORS.greenDark }}>Contact seller</span>
          ) : (
            <>
              <span style={{ fontSize: 22, fontWeight: 800, color: COLORS.greenDark }}>{l.currency} {Number(l.price).toLocaleString()}</span>
              {l.unit && <span style={{ fontSize: 13, color: COLORS.textMuted }}>/ {unitText(l.unit)}</span>}
            </>
          )}
          {l.negotiable && !l.contact_for_price && <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.orange }}>Negotiable</span>}
        </p>

        {l.free_delivery && (
          <p style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, fontWeight: 800, color: COLORS.greenDark, background: COLORS.greenSoft, borderRadius: 10, padding: '5px 11px' }}>
            🚚 Free delivery
          </p>
        )}

        {l.location && (
          <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: COLORS.textMuted, marginTop: 10 }}>
            <Icon name="mapPin" size={14} color={COLORS.textMuted} /> {l.location}
          </p>
        )}

        <div style={{ borderTop: `1px solid ${COLORS.bg}`, marginTop: 14 }}>
          {l.quantity != null && <Row k="Quantity" v={`${Number(l.quantity).toLocaleString()} ${l.unit || ''} available`.trim()} />}
          {minOrder && <Row k="Minimum order" v={`${minOrder} ${l.unit || ''}`.trim()} />}
          {rows.map((r) => <Row key={r.label} k={r.label} v={r.value} />)}
          {l.subcategory && <Row k="Type" v={l.subcategory} />}
          <Row k="Category" v={categoryShort(l.category)} />
          {l.free_delivery && <Row k="Delivery" v="Free delivery" strong />}
        </div>

        {l.description && (
          <>
            <p style={{ fontSize: 14, fontWeight: 800, color: COLORS.text, margin: '16px 0 6px' }}>Product Description</p>
            <p style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{l.description}</p>
          </>
        )}

        {seller && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18, padding: 14, background: COLORS.bg, borderRadius: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 26, background: COLORS.greenSoft, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {seller.profile_image ? <img src={seller.profile_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="user" size={22} color={COLORS.green} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 800, color: COLORS.text }}>
                <NameWithTick name={seller.full_name || seller.username || 'Seller'} isPremium={seller.is_premium} premiumUntil={seller.premium_until} size={15} />
              </p>
              {seller.is_verified ? (
                <p style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: COLORS.textMuted, marginTop: 3 }}>
                  <Icon name="check" size={12} color={COLORS.green} strokeWidth={3} /> Verified Seller
                </p>
              ) : seller.username ? (
                <p style={{ fontSize: 11.5, color: COLORS.textMuted, marginTop: 3 }}>@{seller.username}</p>
              ) : null}
            </div>
            {seller.username && !isMine && (
              <div onClick={() => navigate(`/u/${seller.username}`)} style={{ background: COLORS.greenSoft, color: COLORS.greenDark, borderRadius: 10, padding: '9px 14px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>View Profile</div>
            )}
          </div>
        )}

        {l.status !== 'available' && (
          <p style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.red, marginTop: 14 }}>{l.status === 'sold' ? 'This item has been sold.' : 'This listing is hidden from other buyers.'}</p>
        )}
      </div>

      {/* Actions */}
      <div style={{ position: 'sticky', bottom: 0, background: COLORS.card, borderTop: `1px solid ${COLORS.border}`, padding: '10px 14px calc(10px + env(safe-area-inset-bottom, 0px))', marginTop: 14 }}>
        {isMine ? (
          <div style={{ display: 'flex', gap: 10 }}>
            <div onClick={() => navigate(`/sell/${l.id}`)} style={{ flex: 1, textAlign: 'center', background: COLORS.green, color: 'white', borderRadius: 12, padding: 13, fontSize: 13.5, fontWeight: 800, cursor: 'pointer' }}>Edit Listing</div>
            <div onClick={() => setInboxOpen(true)} style={{ flex: 1, textAlign: 'center', background: COLORS.greenSoft, color: COLORS.greenDark, borderRadius: 12, padding: 13, fontSize: 13.5, fontWeight: 800, cursor: 'pointer' }}>Messages</div>
          </div>
        ) : canContact ? (
          <>
            <div onClick={() => setBuyOpen(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: COLORS.greenDark, color: 'white', padding: 12, borderRadius: 12, fontWeight: 800, fontSize: 13, cursor: 'pointer', marginBottom: 10 }}>
              <Icon name="shield" size={16} color="white" /> Buy with Escrow
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div onClick={() => setChat({})} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: COLORS.greenSoft, color: COLORS.greenDark, borderRadius: 12, padding: 13, fontSize: 13.5, fontWeight: 800, cursor: 'pointer' }}>
                <Icon name="message" size={16} color={COLORS.greenDark} /> Chat
              </div>
              {callNumber && (
                <a href={`tel:${cleanPhone(callNumber)}`} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: COLORS.greenSoft, color: COLORS.greenDark, borderRadius: 12, padding: 13, fontSize: 13.5, fontWeight: 800, textDecoration: 'none' }}>
                  <Icon name="phone" size={16} color={COLORS.greenDark} /> Call
                </a>
              )}
              <div onClick={() => setChat({ prefill: `I'd like to offer ${l.currency} ____ for "${l.title}".` })} style={{ flex: 1.3, textAlign: 'center', background: COLORS.green, color: 'white', borderRadius: 12, padding: 13, fontSize: 13.5, fontWeight: 800, cursor: 'pointer' }}>
                Make Offer
              </div>
            </div>
          </>
        ) : null}
      </div>

      {chat && (
        <ListingChat listingId={l.id} listingTitle={l.title} isSeller={false} freeDelivery={l.free_delivery} prefill={chat.prefill} onClose={() => setChat(null)} />
      )}
      {inboxOpen && <MarketplaceInbox onClose={() => setInboxOpen(false)} />}
      {buyOpen && (
        <BuyEscrowSheet
          listing={{ id: l.id, title: l.title, price: Number(l.price), currency: l.currency, unit: l.unit, quantity: l.quantity == null ? null : Number(l.quantity) }}
          onClose={() => setBuyOpen(false)}
        />
      )}
      <ReportSheet open={reportOpen} onClose={() => setReportOpen(false)} type="marketplace" contentId={l.id} targetLabel={l.title} />
    </Shell>
  )
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '11px 0', borderBottom: `1px solid ${COLORS.bg}` }}>
      <span style={{ fontSize: 13, color: COLORS.textMuted }}>{k}</span>
      <span style={{ fontSize: 13, fontWeight: strong ? 800 : 700, color: strong ? COLORS.greenDark : COLORS.text, textAlign: 'right' }}>{v}</span>
    </div>
  )
}

function Shell({ children, onBack, onShare, onMenu }: { children: React.ReactNode; onBack: () => void; onShare?: () => void; onMenu?: () => void }) {
  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: 480, margin: '0 auto', position: 'relative' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 30, display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: COLORS.greenDark, color: 'white' }}>
        <div onClick={onBack} style={{ cursor: 'pointer', display: 'flex' }}><Icon name="arrowLeft" size={22} color="white" /></div>
        <p style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: 800 }}>Product Details</p>
        <div onClick={onShare} style={{ cursor: onShare ? 'pointer' : 'default', display: 'flex', opacity: onShare ? 1 : 0.4 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
        </div>
        <div onClick={onMenu} style={{ cursor: onMenu ? 'pointer' : 'default', display: 'flex', opacity: onMenu ? 1 : 0.4 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
        </div>
      </div>
      {children}
    </div>
  )
}
