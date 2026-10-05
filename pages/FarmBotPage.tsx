import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import Icon from '../Icons'
import NetworkError from '../NetworkError'

const COLORS = {
  bg: '#F0FDF4',
  card: '#FFFFFF',
  border: '#DCFCE7',
  green: '#16A34A',
  greenDark: '#14532D',
  text: '#1A2E1A',
  textMuted: '#5B6B5B',
}

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  message: string
}

type Chat = {
  id: string
  title: string
  updated_at: string
}

const SUGGESTIONS = [
  'How do I control pests on maize?',
  'What is the best fertilizer for rice?',
  'When should I plant tomatoes?',
  'How do I treat sick chickens?',
]

function groupChats(chats: Chat[]) {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const day = 24 * 60 * 60 * 1000
  const groups: { label: string; items: Chat[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Previous 7 days', items: [] },
    { label: 'Older', items: [] },
  ]
  chats.forEach((c) => {
    const t = new Date(c.updated_at).getTime()
    if (t >= startOfToday.getTime()) groups[0].items.push(c)
    else if (t >= startOfToday.getTime() - day) groups[1].items.push(c)
    else if (t >= startOfToday.getTime() - 7 * day) groups[2].items.push(c)
    else groups[3].items.push(c)
  })
  return groups.filter((g) => g.items.length > 0)
}

export default function FarmBotPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'network' | 'limit' | 'generic'; text: string; retry?: string; upgrade?: boolean } | null>(null)
  const [usage, setUsage] = useState<{ used: number; limit: number; premium: boolean } | null>(null)

  const [chatId, setChatId] = useState<string | null>(null)
  const [chats, setChats] = useState<Chat[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // The page itself never scrolls; only the message list does.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const loadChats = async (): Promise<Chat[]> => {
    if (!user) return []
    const { data } = await supabase
      .from('farmbot_chats')
      .select('id, title, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50)
    const list = (data || []) as Chat[]
    setChats(list)
    return list
  }

  const loadMessages = async (id: string) => {
    setNetError(false)
    setLoading(true)
    const { data, error: fetchError } = await supabase
      .from('ai_conversations')
      .select('id, role, message')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })

    if (fetchError) {
      setNetError(true)
      setLoading(false)
      return
    }
    setMessages((data || []) as any)
    setLoading(false)
  }

  const init = async () => {
    if (!user) return
    setNetError(false)
    setLoading(true)
    const list = await loadChats()
    if (list.length > 0) {
      setChatId(list[0].id)
      await loadMessages(list[0].id)
    } else {
      setLoading(false)
    }
  }

  useEffect(() => { init() }, [user])

  // Real usage for today (counted on the server)
  useEffect(() => {
    if (!user) return
    supabase.rpc('farmbot_usage').then(({ data }) => {
      if (data && typeof (data as any).used === 'number') setUsage(data as any)
    })
  }, [user])

  const limitReached = !!usage && usage.used >= usage.limit

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages, sending, loading])

  const autoGrow = () => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 110)}px`
  }

  useEffect(() => { autoGrow() }, [draft])

  const newChat = () => {
    if (sending) return
    setChatId(null)
    setMessages([])
    setNotice(null)
    setDraft('')
    setDrawerOpen(false)
  }

  const openChat = async (id: string) => {
    if (sending) return
    setDrawerOpen(false)
    if (id === chatId) return
    setChatId(id)
    setMessages([])
    setNotice(null)
    await loadMessages(id)
  }

  const deleteChat = async (id: string) => {
    if (sending) return
    if (!window.confirm('Delete this chat?')) return
    const { error: delError } = await supabase.from('farmbot_chats').delete().eq('id', id)
    if (delError) {
      alert('Could not delete the chat. Please try again.')
      return
    }
    setChats((prev) => prev.filter((c) => c.id !== id))
    if (id === chatId) {
      setChatId(null)
      setMessages([])
      setNotice(null)
    }
  }

  const send = async (text?: string, isRetry = false) => {
    const content = (text ?? draft).trim()
    if (!content || sending || limitReached) return

    setNotice(null)
    setSending(true)

    // Show the user's message immediately (a resend reuses the bubble that is already there).
    if (!isRetry) {
      setDraft('')
      setMessages((prev) => [...prev, { id: `local-${Date.now()}`, role: 'user', message: content }])
    }

    const networkNotice = { kind: 'network' as const, text: 'No internet connection. Check your network, then tap Resend.', retry: content }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setSending(false)
      setNotice(networkNotice)
      return
    }

    const { data, error: fnError } = await supabase.functions.invoke('farmbot-chat', {
      body: { message: content, conversation_id: chatId, new_chat: !chatId },
    })

    setSending(false)

    // The user's own daily message limit (Free / Premium) was reached: nothing was sent, so take the
    // bubble back and keep the text in the box.
    if (data?.code === 'user_limit') {
      if (data.usage) setUsage(data.usage)
      if (!isRetry) {
        setMessages((prev) => prev.slice(0, -1))
        setDraft(content)
      }
      setNotice({ kind: 'limit', text: data.error, upgrade: !data.usage?.premium })
      return
    }

    // Daily AI limit reached: friendly message, nothing technical shown.
    if (data?.code === 'daily_limit') {
      setNotice({ kind: 'limit', text: data.error })
      return
    }

    if (fnError || data?.error) {
      const msg = fnError?.message || ''
      const isNetwork = fnError?.name === 'FunctionsFetchError' || /failed to (send|fetch)|network|load failed/i.test(msg)
      if (isNetwork) {
        setNotice(networkNotice)
      } else {
        setNotice({
          kind: 'generic',
          text: data?.code && data?.error ? data.error : 'Something went wrong. Please try again.',
          retry: content,
        })
      }
      return
    }

    if (data.usage) setUsage(data.usage)
    if (data.conversation_id && data.conversation_id !== chatId) setChatId(data.conversation_id)
    setMessages((prev) => [...prev, { id: `local-${Date.now()}-r`, role: 'assistant', message: data.reply }])
    loadChats()
  }

  const shell: CSSProperties = {
    height: '100dvh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto',
    display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden',
  }

  if (netError) {
    return (
      <div style={shell}>
        <Header onMenu={() => setDrawerOpen(true)} onNew={newChat} usage={usage} />
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <NetworkError onRetry={() => (chatId ? loadMessages(chatId) : init())} />
        </div>
      </div>
    )
  }

  const empty = !loading && messages.length === 0

  return (
    <div style={shell}>
      <style>{`
        @keyframes fbDot { 0%, 80%, 100% { opacity: .25; transform: translateY(0) } 40% { opacity: 1; transform: translateY(-3px) } }
        @keyframes fbSlide { from { transform: translateX(-100%) } to { transform: translateX(0) } }
      `}</style>

      <Header onMenu={() => setDrawerOpen(true)} onNew={newChat} usage={usage} />

      {/* Messages (the only scrolling area) */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {loading ? (
          <p style={{ fontSize: '12.5px', color: COLORS.textMuted, textAlign: 'center', marginTop: '30px' }}>Loading conversation...</p>
        ) : empty ? (
          <div style={{ margin: 'auto 0', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '10px 4px' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '30px', background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.greenDark})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(22,163,74,0.3)' }}>
              <Icon name="robot" size={30} color="white" />
            </div>
            <p style={{ fontSize: '18px', fontWeight: 800, color: COLORS.text, marginTop: '14px' }}>Sannu! I'm FarmBot</p>
            <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginTop: '5px', lineHeight: 1.5, maxWidth: '280px' }}>
              Your AI farming assistant. Ask me about crops, livestock, soil, pests, weather or market prices.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '20px', width: '100%' }}>
              {SUGGESTIONS.map((s) => (
                <div
                  key={s}
                  onClick={() => send(s)}
                  style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '11px 14px', fontSize: '12.5px', color: COLORS.green, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
                  {s}
                </div>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => <Bubble key={m.id} role={m.role} text={m.message} />)
        )}

        {sending && <TypingBubble />}

        {notice && (
          <div style={{
            background: notice.kind === 'limit' ? '#F0FDF4' : '#FFFBEB',
            border: `1px solid ${notice.kind === 'limit' ? COLORS.border : '#FDE68A'}`,
            borderRadius: '12px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <p style={{ flex: 1, fontSize: '12px', lineHeight: 1.45, color: notice.kind === 'limit' ? COLORS.greenDark : '#92400E' }}>{notice.text}</p>
            {notice.retry && (
              <div
                onClick={() => send(notice.retry, true)}
                style={{ background: COLORS.green, color: 'white', borderRadius: '10px', padding: '7px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                Resend
              </div>
            )}
            {notice.upgrade && (
              <div
                onClick={() => navigate('/premium')}
                style={{ background: COLORS.green, color: 'white', borderRadius: '10px', padding: '7px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                Upgrade to Premium
              </div>
            )}
          </div>
        )}
      </div>

      {/* Daily limit reached: the box is locked until tomorrow (or Premium) */}
      {limitReached && usage && (
        <div style={{ background: '#F0FDF4', borderTop: `1px solid ${COLORS.border}`, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <p style={{ flex: 1, fontSize: '12px', lineHeight: 1.45, color: COLORS.greenDark }}>
            {usage.premium
              ? `You've used all ${usage.limit} FarmBot messages for today. They reset tomorrow.`
              : `You've used your ${usage.limit} free messages for today. Limited use: upgrade to Premium for more.`}
          </p>
          {!usage.premium && (
            <div onClick={() => navigate('/premium')} style={{ background: COLORS.green, color: 'white', borderRadius: '10px', padding: '8px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
              Upgrade to Premium
            </div>
          )}
        </div>
      )}

      {/* Composer (always pinned to the bottom) */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', padding: '10px 14px calc(10px + env(safe-area-inset-bottom, 0px))', background: COLORS.card, borderTop: `1px solid ${COLORS.border}` }}>
        <textarea
          ref={inputRef}
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          disabled={limitReached}
          placeholder={limitReached ? 'Daily limit reached' : 'Ask FarmBot anything...'}
          style={{ flex: 1, resize: 'none', padding: '10px 14px', borderRadius: '20px', border: `1px solid ${COLORS.border}`, background: COLORS.bg, fontSize: '13px', lineHeight: 1.4, color: COLORS.text, outline: 'none', fontFamily: 'inherit', maxHeight: '110px' }}
        />
        <div
          onClick={() => send()}
          style={{ width: '40px', height: '40px', borderRadius: '20px', background: draft.trim() && !sending && !limitReached ? COLORS.green : '#BBF7D0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: draft.trim() && !sending && !limitReached ? 'pointer' : 'default', flexShrink: 0 }}>
          <Icon name="send" size={16} color="white" />
        </div>
      </div>

      {/* History drawer */}
      {drawerOpen && (
        <div onClick={() => setDrawerOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 20 }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '82%', maxWidth: '330px', height: '100%', background: COLORS.card, display: 'flex', flexDirection: 'column', animation: 'fbSlide .22s ease-out', boxShadow: '4px 0 20px rgba(0,0,0,0.15)' }}>
            <div style={{ padding: 'calc(16px + env(safe-area-inset-top, 0px)) 16px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '16px', background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.greenDark})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="robot" size={17} color="white" />
              </div>
              <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text, flex: 1 }}>FarmBot</p>
              <div onClick={() => setDrawerOpen(false)} style={{ cursor: 'pointer', display: 'flex', padding: '4px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COLORS.textMuted} strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </div>
            </div>

            <div style={{ padding: '0 16px 12px' }}>
              <div onClick={newChat} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: COLORS.green, color: 'white', borderRadius: '12px', padding: '11px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: sending ? 0.6 : 1 }}>
                <PlusIcon color="white" /> New chat
              </div>
            </div>

            <p style={{ fontSize: '11px', fontWeight: 800, color: COLORS.textMuted, letterSpacing: '0.5px', padding: '4px 16px 6px' }}>HISTORY</p>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
              {chats.length === 0 && (
                <p style={{ fontSize: '12px', color: COLORS.textMuted, textAlign: 'center', padding: '24px 12px' }}>
                  No chats yet. Ask FarmBot something to get started.
                </p>
              )}
              {groupChats(chats).map((g) => (
                <div key={g.label} style={{ marginBottom: '8px' }}>
                  <p style={{ fontSize: '10.5px', fontWeight: 700, color: COLORS.textMuted, padding: '6px 8px 4px' }}>{g.label}</p>
                  {g.items.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => openChat(c.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 8px', borderRadius: '10px', cursor: 'pointer', background: c.id === chatId ? COLORS.bg : 'transparent' }}>
                      <p style={{ flex: 1, fontSize: '12.5px', fontWeight: c.id === chatId ? 700 : 500, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</p>
                      <div onClick={(e) => { e.stopPropagation(); deleteChat(c.id) }} style={{ display: 'flex', padding: '2px', cursor: 'pointer' }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={COLORS.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px calc(14px + env(safe-area-inset-bottom, 0px))', borderTop: `1px solid ${COLORS.border}`, cursor: 'pointer' }}>
              <Icon name="arrowLeft" size={18} color={COLORS.text} />
              <p style={{ fontSize: '13px', fontWeight: 600, color: COLORS.text }}>Back to Home</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PlusIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
  )
}

// Light formatting for the AI's replies: **bold**, bullet lists and numbered lists.
function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4
      ? <b key={i}>{part.slice(2, -2)}</b>
      : <span key={i}>{part}</span>,
  )
}

function FormattedText({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div>
      {lines.map((raw, i) => {
        const line = raw.replace(/^#{1,6}\s+/, '')
        if (!line.trim()) return <div key={i} style={{ height: '6px' }} />
        const bullet = line.match(/^\s*[*\-•]\s+(.*)/)
        if (bullet) {
          return (
            <div key={i} style={{ display: 'flex', gap: '8px', marginTop: '3px' }}>
              <span style={{ color: COLORS.green, fontWeight: 800 }}>•</span>
              <span style={{ flex: 1 }}>{renderInline(bullet[1])}</span>
            </div>
          )
        }
        const numbered = line.match(/^\s*(\d+)[.)]\s+(.*)/)
        if (numbered) {
          return (
            <div key={i} style={{ display: 'flex', gap: '8px', marginTop: '3px' }}>
              <span style={{ color: COLORS.green, fontWeight: 800, minWidth: '14px' }}>{numbered[1]}.</span>
              <span style={{ flex: 1 }}>{renderInline(numbered[2])}</span>
            </div>
          )
        }
        return <div key={i} style={{ marginTop: '2px' }}>{renderInline(line)}</div>
      })}
    </div>
  )
}

function Bubble({ role, text }: { role: 'user' | 'assistant'; text: string }) {
  const mine = role === 'user'
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* ignore */ }
  }

  return (
    <div style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '86%', display: 'flex', gap: '8px' }}>
      {!mine && (
        <div style={{ width: '26px', height: '26px', borderRadius: '13px', background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.greenDark})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
          <Icon name="robot" size={14} color="white" />
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{
          background: mine ? COLORS.green : COLORS.card, color: mine ? 'white' : COLORS.text,
          padding: '10px 14px', borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px', fontSize: '13px', lineHeight: 1.5,
          boxShadow: mine ? 'none' : '0 1px 4px rgba(0,0,0,0.05)',
          border: mine ? 'none' : `1px solid ${COLORS.border}`, wordBreak: 'break-word',
          whiteSpace: mine ? 'pre-wrap' : 'normal',
        }}>
          {mine ? text : <FormattedText text={text} />}
        </div>
        {!mine && (
          <span onClick={copy} style={{ display: 'inline-block', fontSize: '10.5px', fontWeight: 600, color: COLORS.textMuted, cursor: 'pointer', padding: '4px 4px 0' }}>
            {copied ? 'Copied!' : 'Copy'}
          </span>
        )}
      </div>
    </div>
  )
}

function TypingBubble() {
  return (
    <div style={{ alignSelf: 'flex-start', display: 'flex', gap: '8px' }}>
      <div style={{ width: '26px', height: '26px', borderRadius: '13px', background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.greenDark})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name="robot" size={14} color="white" />
      </div>
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '16px 16px 16px 4px', padding: '13px 16px', display: 'flex', gap: '4px' }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: '6px', height: '6px', borderRadius: '3px', background: COLORS.green, animation: `fbDot 1.2s infinite ${i * 0.18}s` }} />
        ))}
      </div>
    </div>
  )
}

function Header({ onMenu, onNew, usage }: { onMenu: () => void; onNew: () => void; usage: { used: number; limit: number; premium: boolean } | null }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px', padding: 'calc(12px + env(safe-area-inset-top, 0px)) 14px 12px',
      background: COLORS.card, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', flexShrink: 0,
    }}>
      <div onClick={onMenu} style={{ cursor: 'pointer', display: 'flex', padding: '4px' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={COLORS.text} strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h10" /></svg>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
        <Icon name="robot" size={20} color={COLORS.green} />
        <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>FarmBot</p>
      </div>
      {usage && (
        <div style={{ background: usage.used >= usage.limit ? '#FEF3C7' : COLORS.bg, border: `1px solid ${usage.used >= usage.limit ? '#FDE68A' : COLORS.border}`, borderRadius: '999px', padding: '4px 10px', fontSize: '11px', fontWeight: 700, color: usage.used >= usage.limit ? '#92400E' : COLORS.greenDark, whiteSpace: 'nowrap' }}>
          {usage.used} / {usage.limit} today
        </div>
      )}
      <div onClick={onNew} style={{ cursor: 'pointer', display: 'flex', padding: '4px' }}>
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={COLORS.green} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
      </div>
    </div>
  )
}
