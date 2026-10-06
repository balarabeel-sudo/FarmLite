import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import Icon from './Icons'

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
}

type Msg = { id: string; mine: boolean; content: string; created_at: string }

const BUYER_QUICK = ['Is it still available?', 'What about delivery?', 'Can you do a better price?', 'Can I see more photos?']

type Props = {
  listingId: string
  listingTitle: string
  // seller side: the buyer this conversation is with
  buyerId?: string | null
  isSeller: boolean
  freeDelivery?: boolean
  // text placed in the box but not sent (used by "Make Offer")
  prefill?: string
  otherName?: string
  onClose: () => void
  onChanged?: () => void
}

// A chat between a buyer and the seller about ONE listing. It lives in Marketplace
// (with its own unread marker) and does not show up in the DM inbox.
export default function ListingChat({ listingId, listingTitle, buyerId, isSeller, freeDelivery, prefill, otherName, onClose, onChanged }: Props) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [loaded, setLoaded] = useState(false)
  const [text, setText] = useState(prefill || '')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const quick = isSeller
    ? ["Yes, it's still available.", 'Delivery is available.', ...(freeDelivery ? ['Free delivery is included.'] : []), 'Please send your location.', 'What quantity do you need?']
    : BUYER_QUICK

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.rpc('listing_thread', { p_listing: listingId, p_buyer: buyerId ?? null })
    if (!e && Array.isArray(data)) setMessages(data as Msg[])
    setLoaded(true)
    onChanged?.()
  }, [listingId, buyerId])

  useEffect(() => {
    load()
    const t = setInterval(load, 8000)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])

  const send = async (content: string) => {
    const body = content.trim()
    if (!body || sending) return
    setSending(true)
    setError(null)
    const { error: e } = await supabase.rpc('send_listing_message', { p_listing: listingId, p_text: body, p_buyer: buyerId ?? null })
    setSending(false)
    if (e) return setError(e.message || 'Could not send your message.')
    setText('')
    load()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 70, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: COLORS.bg, width: '100%', maxWidth: 480, height: '82vh', borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: COLORS.card, borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 800, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{isSeller ? (otherName || 'Buyer') : 'Message the seller'}</p>
            <p style={{ fontSize: 11, color: COLORS.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>About: {listingTitle}</p>
          </div>
          <div onClick={onClose} style={{ cursor: 'pointer', display: 'flex', padding: 4 }}><Icon name="close" size={20} color={COLORS.textMuted} /></div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
          {!loaded ? (
            <p style={{ textAlign: 'center', fontSize: 12.5, color: COLORS.textMuted, padding: 24 }}>Loading…</p>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '26px 8px' }}>
              <p style={{ fontSize: 14, fontWeight: 800, color: COLORS.text }}>{isSeller ? 'No messages yet' : 'Ask the seller'}</p>
              <p style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 4 }}>{isSeller ? '' : 'Tap a question below or write your own message.'}</p>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} style={{ display: 'flex', justifyContent: m.mine ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                <div style={{ maxWidth: '78%', background: m.mine ? COLORS.green : COLORS.card, color: m.mine ? 'white' : COLORS.text, borderRadius: m.mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px', padding: '9px 12px', fontSize: 13, lineHeight: 1.45, boxShadow: m.mine ? 'none' : '0 1px 3px rgba(0,0,0,0.06)', wordBreak: 'break-word' }}>
                  {m.content}
                  <div style={{ fontSize: 9.5, opacity: 0.7, marginTop: 3, textAlign: 'right' }}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>

        {error && <p style={{ fontSize: 12, color: COLORS.red, padding: '0 14px 6px' }}>{error}</p>}

        {/* Quick messages: one tap sends */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '8px 14px', background: COLORS.card, borderTop: `1px solid ${COLORS.border}` }}>
          {quick.map((q) => (
            <div key={q} onClick={() => send(q)} style={{ whiteSpace: 'nowrap', padding: '8px 12px', borderRadius: 999, background: COLORS.greenSoft, color: COLORS.greenDark, fontSize: 12, fontWeight: 700, cursor: sending ? 'default' : 'pointer', flexShrink: 0 }}>
              {q}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, padding: '8px 14px calc(10px + env(safe-area-inset-bottom, 0px))', background: COLORS.card }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={1}
            maxLength={1000}
            placeholder="Write a message…"
            style={{ flex: 1, resize: 'none', border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: '10px 12px', fontSize: 13.5, fontFamily: 'inherit', outline: 'none', maxHeight: 90, background: COLORS.bg }}
          />
          <div
            onClick={() => send(text)}
            style={{ width: 42, height: 42, borderRadius: 21, background: text.trim() && !sending ? COLORS.green : '#BBF7D0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: text.trim() && !sending ? 'pointer' : 'default', flexShrink: 0 }}>
            <Icon name="send" size={18} color="white" />
          </div>
        </div>
      </div>
    </div>
  )
}
