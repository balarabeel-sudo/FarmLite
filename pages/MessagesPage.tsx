import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import Icon from '../Icons'
import { ListCardSkeleton } from '../LoadingSkeleton'
import NetworkError from '../NetworkError'
import { isActiveNow, lastSeenLabel, messageTime } from '../presenceShared'

const COLORS = {
  bg: 'var(--fx-bg)',
  card: 'var(--fx-card)',
  border: 'var(--fx-border)',
  green: '#16A34A',
  text: 'var(--fx-text)',
  textMuted: 'var(--fx-muted)',
  orange: '#F59E0B',
}

type Message = {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  is_read: boolean
  created_at: string
  delivered_at?: string | null
  read_at?: string | null
}

type Conversation = {
  partnerId: string
  partnerName: string
  partnerAvatar: string | null
  partnerLastSeen: string | null
  lastMessage: string
  lastAt: string
  lastMine: boolean
  unreadCount: number
}

const MESSAGE_COLUMNS = 'id, sender_id, receiver_id, content, is_read, created_at, delivered_at, read_at'

// Sent = one grey tick, delivered = two grey ticks, read = two green ticks.
function Ticks({ m }: { m: Message }) {
  const read = m.is_read
  const delivered = !!m.delivered_at || read
  return (
    <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '-2px', color: read ? COLORS.green : '#9AA89A', marginLeft: '6px' }} aria-label={read ? 'Read' : delivered ? 'Delivered' : 'Sent'}>
      {delivered ? '✓✓' : '✓'}
    </span>
  )
}

export default function MessagesPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const bottomRef = useRef<HTMLDivElement>(null)

  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])

  const [activePartnerId, setActivePartnerId] = useState<string | null>(null)
  const [activePartnerName, setActivePartnerName] = useState('')
  const [partnerAvatar, setPartnerAvatar] = useState<string | null>(null)
  const [partnerLastSeen, setPartnerLastSeen] = useState<string | null>(null)
  const [partnerTyping, setPartnerTyping] = useState(false)
  const [thread, setThread] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [threadLoading, setThreadLoading] = useState(false)
  const [now, setNow] = useState(Date.now())

  // Latest values for the realtime handlers (they are created once and must not read stale state).
  const activeRef = useRef<string | null>(null)
  activeRef.current = activePartnerId
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const typingChannel = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const lastTypingSent = useRef(0)

  const loadConversations = useCallback(async (silent = false) => {
    if (!user) return
    if (!silent) { setNetError(false); setLoading(true) }

    const { data, error } = await supabase
      .from('messages')
      .select(MESSAGE_COLUMNS)
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    if (error) {
      if (!silent) { setNetError(true); setLoading(false) }
      return
    }

    const partnerIds = new Set<string>()
    ;(data || []).forEach((m: Message) => {
      partnerIds.add(m.sender_id === user.id ? m.receiver_id : m.sender_id)
    })

    const profilesById: Record<string, { full_name: string | null; username: string | null; profile_image: string | null; last_seen_at: string | null }> = {}
    if (partnerIds.size > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name, username, profile_image, last_seen_at')
        .in('user_id', Array.from(partnerIds))
      ;(profilesData || []).forEach((p: any) => { profilesById[p.user_id] = p })
    }

    const grouped: Record<string, Conversation> = {}
    ;(data || []).forEach((m: Message) => {
      const partnerId = m.sender_id === user.id ? m.receiver_id : m.sender_id
      if (!grouped[partnerId]) {
        const p = profilesById[partnerId]
        grouped[partnerId] = {
          partnerId,
          partnerName: p?.full_name || p?.username || 'Farmxie user',
          partnerAvatar: p?.profile_image || null,
          partnerLastSeen: p?.last_seen_at || null,
          lastMessage: m.content,
          lastAt: m.created_at,
          lastMine: m.sender_id === user.id,
          unreadCount: 0,
        }
      }
      if (m.receiver_id === user.id && !m.is_read) {
        grouped[partnerId].unreadCount += 1
      }
    })

    setConversations(Object.values(grouped).sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()))
    if (!silent) setLoading(false)
  }, [user])

  useEffect(() => { loadConversations() }, [loadConversations])

  const fetchThread = useCallback(async (partnerId: string) => {
    if (!user) return null
    const { data } = await supabase
      .from('messages')
      .select(MESSAGE_COLUMNS)
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true })
    return (data || []) as Message[]
  }, [user])

  const markRead = useCallback((partnerId: string) => {
    supabase.rpc('mark_thread_read', { p_partner: partnerId }).then(() => {}, () => {})
  }, [])

  const openThread = async (partnerId: string, partnerName: string, avatar: string | null = null, lastSeen: string | null = null) => {
    if (!user) return
    setActivePartnerId(partnerId)
    setActivePartnerName(partnerName)
    setPartnerAvatar(avatar)
    setPartnerLastSeen(lastSeen)
    setPartnerTyping(false)
    setThread([])
    setThreadLoading(true)

    const rows = await fetchThread(partnerId)
    setThread(rows || [])
    setThreadLoading(false)

    markRead(partnerId)
    setConversations((prev) => prev.map((c) => c.partnerId === partnerId ? { ...c, unreadCount: 0 } : c))

    // A person opened from a profile link may not be in the list yet: get their name, photo and last seen.
    const { data: p } = await supabase.from('profiles').select('full_name, username, profile_image, last_seen_at').eq('user_id', partnerId).maybeSingle()
    if (p && activeRef.current === partnerId) {
      setActivePartnerName((p as any).full_name || (p as any).username || partnerName)
      setPartnerAvatar((p as any).profile_image || null)
      setPartnerLastSeen((p as any).last_seen_at || null)
    }
  }

  // Opens a conversation directly when arriving from a profile (/messages?to=<user_id>).
  useEffect(() => {
    const to = searchParams.get('to')
    if (!user || !to) return
    if (to === user.id) {
      setSearchParams({}, { replace: true })
      return
    }
    ;(async () => {
      const { data } = await supabase.from('profiles').select('full_name, username, profile_image, last_seen_at').eq('user_id', to).maybeSingle()
      await openThread(to, (data as any)?.full_name || (data as any)?.username || 'Farmxie user', (data as any)?.profile_image || null, (data as any)?.last_seen_at || null)
      setSearchParams({}, { replace: true })
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Live updates: new messages appear at once, and ticks change when the other person receives / reads.
  useEffect(() => {
    if (!user) return
    const onIncoming = (m: Message) => {
      if (activeRef.current === m.sender_id) {
        setThread((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]))
        setPartnerTyping(false)
        markRead(m.sender_id)
      }
      // keep the conversation list fresh without flashing the loading skeleton
      loadConversations(true)
    }
    const onMineFromElsewhere = (m: Message) => {
      if (activeRef.current === m.receiver_id) setThread((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]))
      loadConversations(true)
    }
    const onReceipt = (m: Message) => {
      setThread((prev) => prev.map((x) => (x.id === m.id ? { ...x, delivered_at: m.delivered_at, read_at: m.read_at, is_read: m.is_read } : x)))
    }

    const channel = supabase
      .channel(`inbox:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` }, (p: any) => onIncoming(p.new as Message))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${user.id}` }, (p: any) => onMineFromElsewhere(p.new as Message))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `sender_id=eq.${user.id}` }, (p: any) => onReceipt(p.new as Message))
      .subscribe()

    // After the phone sleeps or the tab was in the background, fetch anything that was missed.
    const onVisible = async () => {
      if (document.visibilityState !== 'visible') return
      loadConversations(true)
      const partner = activeRef.current
      if (partner) {
        const rows = await fetchThread(partner)
        if (rows && activeRef.current === partner) { setThread(rows); markRead(partner) }
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(channel)
    }
  }, [user, loadConversations, fetchThread, markRead])

  // Typing indicator: a lightweight broadcast on a channel shared by the two people in this chat.
  useEffect(() => {
    if (!user || !activePartnerId) return
    const key = [user.id, activePartnerId].sort().join('_')
    const channel = supabase
      .channel(`typing:${key}`)
      .on('broadcast', { event: 'typing' }, (payload: any) => {
        if (payload?.payload?.from !== activePartnerId) return
        setPartnerTyping(true)
        if (typingTimer.current) clearTimeout(typingTimer.current)
        typingTimer.current = setTimeout(() => setPartnerTyping(false), 3500)
      })
      .subscribe()
    typingChannel.current = channel
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current)
      typingChannel.current = null
      supabase.removeChannel(channel)
    }
  }, [user, activePartnerId])

  const onDraftChange = (value: string) => {
    setDraft(value)
    if (!user || !value.trim()) return
    const t = Date.now()
    if (t - lastTypingSent.current < 2000) return
    lastTypingSent.current = t
    typingChannel.current?.send({ type: 'broadcast', event: 'typing', payload: { from: user.id } })
  }

  // Refresh "Active now / last seen" every 30 seconds while a chat or the list is open.
  useEffect(() => {
    const timer = setInterval(async () => {
      setNow(Date.now())
      const ids = activeRef.current ? [activeRef.current] : []
      if (ids.length) {
        const { data } = await supabase.from('profiles').select('last_seen_at').eq('user_id', ids[0]).maybeSingle()
        if (data && activeRef.current === ids[0]) setPartnerLastSeen((data as any).last_seen_at || null)
      } else {
        loadConversations(true)
      }
    }, 30_000)
    return () => clearInterval(timer)
  }, [loadConversations])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread, partnerTyping])

  const send = async () => {
    const text = draft.trim()
    if (!user || !activePartnerId || !text || sending) return
    setSending(true)
    setDraft('')

    const { data, error } = await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: activePartnerId,
      content: text,
    }).select(MESSAGE_COLUMNS).single()

    setSending(false)

    if (error || !data) {
      setDraft(text) // keep what was typed so nothing is lost
      return
    }
    setThread((prev) => (prev.some((x) => x.id === (data as any).id) ? prev : [...prev, data as any]))
  }

  if (netError) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <Header title="Messages" onBack={() => navigate('/')} />
        <NetworkError onRetry={() => loadConversations()} />
      </div>
    )
  }

  if (activePartnerId) {
    const status = partnerTyping ? 'typing…' : lastSeenLabel(partnerLastSeen, now)
    const active = !partnerTyping && isActiveNow(partnerLastSeen, now)
    return (
      <div style={{ height: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
        <Header
          title={activePartnerName}
          subtitle={status}
          subtitleColor={partnerTyping || active ? COLORS.green : COLORS.textMuted}
          avatar={partnerAvatar}
          dot={active || partnerTyping}
          onBack={() => { setActivePartnerId(null); loadConversations(true) }}
        />

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {threadLoading && <ListCardSkeleton count={2} />}
          {!threadLoading && thread.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: COLORS.textMuted, fontSize: '12.5px' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
                <Icon name="message" size={26} color={COLORS.textMuted} />
              </div>
              No messages yet. Say hello!
            </div>
          )}
          {thread.map((m) => {
            const mine = m.sender_id === user?.id
            return (
              <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                <div style={{
                  background: mine ? COLORS.green : COLORS.card, color: mine ? 'white' : COLORS.text,
                  padding: '9px 13px', borderRadius: '14px', fontSize: '13px', lineHeight: 1.4, wordBreak: 'break-word',
                  boxShadow: mine ? 'none' : '0 1px 4px rgba(0,0,0,0.05)',
                }}>
                  {m.content}
                </div>
                <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', alignItems: 'center', marginTop: '2px', fontSize: '10px', color: COLORS.textMuted }}>
                  {messageTime(m.created_at)}
                  {mine && <Ticks m={m} />}
                </div>
              </div>
            )
          })}
          {partnerTyping && (
            <div style={{ alignSelf: 'flex-start', background: COLORS.card, borderRadius: '14px', padding: '9px 14px', fontSize: '12px', color: COLORS.textMuted, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              typing…
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div style={{ display: 'flex', gap: '8px', padding: '12px 16px', background: COLORS.card, borderTop: `1px solid ${COLORS.border}` }}>
          <input
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send() }}
            placeholder="Type a message..."
            style={{ flex: 1, padding: '10px 14px', borderRadius: '20px', border: `1px solid ${COLORS.border}`, fontSize: '13px', outline: 'none' }}
          />
          <div onClick={sending ? undefined : send} style={{ width: '40px', height: '40px', borderRadius: '20px', background: COLORS.green, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: sending ? 0.6 : 1 }}>
            <Icon name="send" size={16} color="white" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '30px' }}>
      <Header title="Messages" onBack={() => navigate('/')} />

      <div style={{ padding: '16px' }}>
        {loading ? (
          <ListCardSkeleton count={4} />
        ) : conversations.length === 0 ? (
          <div style={{ background: COLORS.card, padding: '40px 20px', textAlign: 'center', borderRadius: '14px', color: COLORS.textMuted, fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
              <Icon name="message" size={28} color={COLORS.textMuted} />
            </div>
            No conversations yet.
          </div>
        ) : (
          conversations.map((c) => (
            <div key={c.partnerId} onClick={() => openThread(c.partnerId, c.partnerName, c.partnerAvatar, c.partnerLastSeen)} style={{ background: COLORS.card, borderRadius: '14px', padding: '12px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <Avatar url={c.partnerAvatar} dot={isActiveNow(c.partnerLastSeen, now)} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>{c.partnerName}</p>
                <p style={{ fontSize: '11.5px', color: c.unreadCount > 0 ? COLORS.text : COLORS.textMuted, fontWeight: c.unreadCount > 0 ? 700 : 400, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.lastMine ? 'You: ' : ''}{c.lastMessage}
                </p>
              </div>
              {c.unreadCount > 0 && (
                <div style={{ background: COLORS.orange, color: 'white', fontSize: '10px', fontWeight: 800, borderRadius: '999px', minWidth: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>
                  {c.unreadCount}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function Avatar({ url, dot, size = 44 }: { url: string | null; dot: boolean; size?: number }) {
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div style={{ width: size, height: size, borderRadius: size / 2, background: 'var(--fx-tint-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {url ? <img src={url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="user" size={Math.round(size * 0.4)} color={COLORS.green} />}
      </div>
      {dot && <span style={{ position: 'absolute', right: 0, bottom: 0, width: 12, height: 12, borderRadius: 6, background: '#22C55E', border: '2px solid white' }} />}
    </div>
  )
}

function Header({ title, subtitle, subtitleColor, avatar, dot, onBack }: { title: string; subtitle?: string; subtitleColor?: string; avatar?: string | null; dot?: boolean; onBack: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
      background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      <div onClick={onBack} style={{ cursor: 'pointer', display: 'flex' }}>
        <Icon name="arrowLeft" size={22} color={COLORS.text} />
      </div>
      {avatar !== undefined && <Avatar url={avatar} dot={!!dot} size={36} />}
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</p>
        {subtitle ? <p style={{ fontSize: '11.5px', fontWeight: 600, color: subtitleColor || COLORS.textMuted, marginTop: '1px' }}>{subtitle}</p> : null}
      </div>
    </div>
  )
}
