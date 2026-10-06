import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Icon from './Icons'
import ListingChat from './ListingChat'

const COLORS = {
  bg: '#F8FAF6',
  card: '#FFFFFF',
  border: '#E5EFE5',
  green: '#16A34A',
  greenSoft: '#DCFCE7',
  text: '#1A2E1A',
  textMuted: '#5B6B5B',
}

type Thread = {
  listing_id: string
  buyer_id: string
  title: string
  image: string | null
  role: 'buyer' | 'seller'
  last_message: string
  last_at: string
  unread: number
  full_name: string | null
  username: string | null
  profile_image: string | null
}

type Props = {
  onClose: () => void
  // open a specific conversation straight away (from a notification)
  openListing?: string | null
  openBuyer?: string | null
  onChanged?: () => void
}

// Everything people asked or answered about listings. Kept in Marketplace, not in the DM inbox.
export default function MarketplaceInbox({ onClose, openListing, openBuyer, onChanged }: Props) {
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<Thread | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('listing_threads')
    const list = Array.isArray(data) ? (data as Thread[]) : []
    setThreads(list)
    setLoading(false)
    return list
  }, [])

  useEffect(() => {
    load().then((list) => {
      if (openListing) {
        const found = list.find((t) => t.listing_id === openListing && (t.role === 'buyer' || t.buyer_id === openBuyer))
        if (found) setActive(found)
      }
    })
  }, [])

  const closeChat = () => {
    setActive(null)
    load()
    onChanged?.()
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        <div onClick={(e) => e.stopPropagation()} style={{ background: COLORS.bg, width: '100%', maxWidth: 480, height: '82vh', borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', background: COLORS.card, borderBottom: `1px solid ${COLORS.border}` }}>
            <p style={{ flex: 1, fontSize: 15, fontWeight: 800, color: COLORS.text }}>Marketplace messages</p>
            <div onClick={onClose} style={{ cursor: 'pointer', display: 'flex', padding: 4 }}><Icon name="close" size={20} color={COLORS.textMuted} /></div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            {loading ? (
              <p style={{ textAlign: 'center', fontSize: 12.5, color: COLORS.textMuted, padding: 24 }}>Loading…</p>
            ) : threads.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: COLORS.text }}>No messages yet</p>
                <p style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 4, lineHeight: 1.5 }}>Questions about listings, and replies from sellers, show up here.</p>
              </div>
            ) : (
              threads.map((t) => (
                <div key={`${t.listing_id}-${t.buyer_id}`} onClick={() => setActive(t)} style={{ display: 'flex', alignItems: 'center', gap: 12, background: COLORS.card, borderRadius: 14, padding: 12, marginBottom: 8, cursor: 'pointer' }}>
                  <div style={{ width: 46, height: 46, borderRadius: 12, background: COLORS.greenSoft, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {t.image ? <img src={t.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="leaf" size={20} color={COLORS.green} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <p style={{ fontSize: 13, fontWeight: 800, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</p>
                      <p style={{ fontSize: 10, color: COLORS.textMuted, flexShrink: 0 }}>{new Date(t.last_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                    </div>
                    <p style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 1 }}>
                      {t.role === 'seller' ? `Buyer: ${t.full_name || t.username || 'Someone'}` : `Seller: ${t.full_name || t.username || 'Seller'}`}
                    </p>
                    <p style={{ fontSize: 12, color: t.unread > 0 ? COLORS.text : COLORS.textMuted, fontWeight: t.unread > 0 ? 700 : 400, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.last_message}</p>
                  </div>
                  {t.unread > 0 && (
                    <span style={{ minWidth: 20, height: 20, borderRadius: 10, background: COLORS.green, color: 'white', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>{t.unread}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {active && (
        <ListingChat
          listingId={active.listing_id}
          listingTitle={active.title}
          buyerId={active.role === 'seller' ? active.buyer_id : null}
          isSeller={active.role === 'seller'}
          otherName={active.full_name || active.username || undefined}
          onClose={closeChat}
        />
      )}
    </>
  )
}
