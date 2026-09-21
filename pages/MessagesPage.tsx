import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
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
  orange: '#F59E0B',
}

type Message = {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  is_read: boolean
  created_at: string
}

type Conversation = {
  partnerId: string
  partnerName: string
  partnerAvatar: string | null
  lastMessage: string
  lastAt: string
  unreadCount: number
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
  const [thread, setThread] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [threadLoading, setThreadLoading] = useState(false)

  const load = async () => {
    if (!user) return
    setNetError(false)
    setLoading(true)

    const { data, error } = await supabase
      .from('messages')
      .select('id, sender_id, receiver_id, content, is_read, created_at')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    if (error) {
      setNetError(true)
      setLoading(false)
      return
    }

    const partnerIds = new Set<string>()
    ;(data || []).forEach((m: Message) => {
      partnerIds.add(m.sender_id === user.id ? m.receiver_id : m.sender_id)
    })

    let profilesById: Record<string, { full_name: string | null; username: string | null; profile_image: string | null }> = {}
    if (partnerIds.size > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name, username, profile_image')
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
          partnerName: p?.full_name || p?.username || 'FarmLite user',
          partnerAvatar: p?.profile_image || null,
          lastMessage: m.content,
          lastAt: m.created_at,
          unreadCount: 0,
        }
      }
      if (m.receiver_id === user.id && !m.is_read) {
        grouped[partnerId].unreadCount += 1
      }
    })

    setConversations(Object.values(grouped).sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()))
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  const openThread = async (partnerId: string, partnerName: string) => {
    if (!user) return
    setActivePartnerId(partnerId)
    setActivePartnerName(partnerName)
    setThread([])
    setThreadLoading(true)

    const { data } = await supabase
      .from('messages')
      .select('id, sender_id, receiver_id, content, is_read, created_at')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true })

    setThread((data || []) as any)
    setThreadLoading(false)

    await supabase.from('messages').update({ is_read: true }).eq('receiver_id', user.id).eq('sender_id', partnerId).eq('is_read', false)
    setConversations((prev) => prev.map((c) => c.partnerId === partnerId ? { ...c, unreadCount: 0 } : c))
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
      const { data } = await supabase.from('profiles').select('full_name, username').eq('user_id', to).maybeSingle()
      await openThread(to, data?.full_name || data?.username || 'FarmLite user')
      setSearchParams({}, { replace: true })
    })()
  }, [user])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread])

  const send = async () => {
    if (!user || !activePartnerId || !draft.trim()) return
    setSending(true)

    const { data, error } = await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: activePartnerId,
      content: draft.trim(),
    }).select('id, sender_id, receiver_id, content, is_read, created_at').single()

    setSending(false)

    if (!error && data) {
      setThread((prev) => [...prev, data as any])
      setDraft('')
    }
  }

  if (netError) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <Header title="Messages" onBack={() => navigate('/')} />
        <NetworkError onRetry={load} />
      </div>
    )
  }

  if (activePartnerId) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
        <Header title={activePartnerName} onBack={() => { setActivePartnerId(null); load() }} />

        <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                  padding: '9px 13px', borderRadius: '14px', fontSize: '13px', lineHeight: 1.4,
                  boxShadow: mine ? 'none' : '0 1px 4px rgba(0,0,0,0.05)',
                }}>
                  {m.content}
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        <div style={{ display: 'flex', gap: '8px', padding: '12px 16px', background: COLORS.card, borderTop: `1px solid ${COLORS.border}`, position: 'sticky', bottom: 0 }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
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
            <div key={c.partnerId} onClick={() => openThread(c.partnerId, c.partnerName)} style={{ background: COLORS.card, borderRadius: '14px', padding: '12px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '22px', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                {c.partnerAvatar ? <img src={c.partnerAvatar} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="user" size={18} color={COLORS.green} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>{c.partnerName}</p>
                <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.lastMessage}</p>
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

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px',
      background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      <div onClick={onBack} style={{ cursor: 'pointer', display: 'flex' }}>
        <Icon name="arrowLeft" size={22} color={COLORS.text} />
      </div>
      <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>{title}</p>
    </div>
  )
}
