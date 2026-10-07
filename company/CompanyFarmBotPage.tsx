import { useEffect, useRef, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Icon from '../Icons'
import { isPremiumActive } from '../premiumShared'
import type { CompanyCtx } from './CompanyLayout'

const COLORS = {
  bg: '#F8FAF6',
  card: '#FFFFFF',
  border: '#E5EFE5',
  green: '#16A34A',
  greenDark: '#166534',
  greenSoft: '#DCFCE7',
  text: '#1A2E1A',
  textMuted: '#5B6B5B',
}

type ChatMessage = { id: string; role: 'user' | 'assistant'; message: string }
type Chat = { id: string; title: string; updated_at: string }
type Usage = { used: number; limit: number; premium: boolean }
type Notice = { kind: 'network' | 'limit' | 'generic'; text: string; retry?: string; upgrade?: boolean }

const SUGGESTIONS = [
  'Write a product description for one of my marketplace listings.',
  'Draft a short post announcing new stock for my customers.',
  'How should I price my products this season?',
  'Give me tips to get more buyers on the marketplace.',
]

function useWidth() {
  const [w, setW] = useState(typeof window === 'undefined' ? 1200 : window.innerWidth)
  useEffect(() => {
    const on = () => setW(window.innerWidth)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return w
}

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

// Route: /company/farmbot  (inside the desktop-style company dashboard)
export default function CompanyFarmBotPage() {
  const { company } = useOutletContext<CompanyCtx>()
  const navigate = useNavigate()
  const desktop = useWidth() >= 900
  const premium = isPremiumActive(company.is_premium, company.premium_until)

  const [chats, setChats] = useState<Chat[]>([])
  const [chatId, setChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [usage, setUsage] = useState<Usage | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const loadChats = async (): Promise<Chat[]> => {
    const { data } = await supabase
      .from('company_farmbot_chats')
      .select('id, title, updated_at')
      .eq('company_id', company.id)
      .order('updated_at', { ascending: false })
      .limit(50)
    const list = (data || []) as Chat[]
    setChats(list)
    return list
  }

  const loadMessages = async (id: string) => {
    setLoadingMsgs(true)
    const { data } = await supabase
      .from('company_farmbot_messages')
      .select('id, role, message')
      .eq('chat_id', id)
      .order('created_at', { ascending: true })
    setMessages((data || []) as ChatMessage[])
    setLoadingMsgs(false)
  }

  const loadUsage = async () => {
    const { data } = await supabase.rpc('farmbot_company_usage', { p_company: company.id })
    if (data && typeof (data as any).used === 'number') setUsage(data as Usage)
  }

  useEffect(() => {
    setChatId(null)
    setMessages([])
    setNotice(null)
    loadUsage()
    loadChats().then((list) => {
      if (list.length > 0) {
        setChatId(list[0].id)
        loadMessages(list[0].id)
      }
    })
  }, [company.id])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages, sending, loadingMsgs])

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }, [draft])

  const limitReached = !!usage && usage.used >= usage.limit

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
    const { error } = await supabase.from('company_farmbot_chats').delete().eq('id', id)
    if (error) { alert('Could not delete the chat. Please try again.'); return }
    setChats((prev) => prev.filter((c) => c.id !== id))
    if (id === chatId) { setChatId(null); setMessages([]); setNotice(null) }
  }

  const send = async (text?: string, isRetry = false) => {
    const content = (text ?? draft).trim()
    if (!content || sending || limitReached) return

    setNotice(null)
    setSending(true)
    if (!isRetry) {
      setDraft('')
      setMessages((prev) => [...prev, { id: `local-${Date.now()}`, role: 'user', message: content }])
    }

    const networkNotice: Notice = { kind: 'network', text: 'No internet connection. Check your network, then tap Resend.', retry: content }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setSending(false)
      setNotice(networkNotice)
      return
    }

    const { data, error: fnError } = await supabase.functions.invoke('farmbot-company', {
      body: { message: content, conversation_id: chatId, company_id: company.id },
    })
    setSending(false)

    if (data?.code === 'user_limit') {
      if (data.usage) setUsage(data.usage)
      if (!isRetry) { setMessages((prev) => prev.slice(0, -1)); setDraft(content) }
      setNotice({ kind: 'limit', text: data.error, upgrade: !data.usage?.premium })
      return
    }
    if (data?.code === 'daily_limit') {
      setNotice({ kind: 'limit', text: data.error })
      return
    }
    if (fnError || data?.error) {
      const msg = fnError?.message || ''
      const isNetwork = fnError?.name === 'FunctionsFetchError' || /failed to (send|fetch)|network|load failed/i.test(msg)
      setNotice(isNetwork ? networkNotice : {
        kind: 'generic',
        text: data?.code && data?.error ? data.error : 'Something went wrong. Please try again.',
        retry: content,
      })
      return
    }

    if (data.usage) setUsage(data.usage)
    if (data.conversation_id && data.conversation_id !== chatId) setChatId(data.conversation_id)
    setMessages((prev) => [...prev, { id: `local-${Date.now()}-r`, role: 'assistant', message: data.reply }])
    loadChats()
  }

  const chatList = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div onClick={newChat} style={{ margin: '14px', padding: '11px', borderRadius: '10px', background: COLORS.green, color: 'white', fontWeight: 800, fontSize: '13px', textAlign: 'center', cursor: 'pointer' }}>
        + New chat
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 14px' }}>
        {chats.length === 0 && <p style={{ fontSize: '12px', color: COLORS.textMuted, padding: '8px 6px' }}>Your chats will appear here.</p>}
        {groupChats(chats).map((g) => (
          <div key={g.label} style={{ marginBottom: '10px' }}>
            <p style={{ fontSize: '10.5px', fontWeight: 800, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', padding: '6px 6px 4px' }}>{g.label}</p>
            {g.items.map((c) => (
              <div key={c.id} onClick={() => openChat(c.id)} style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 10px', borderRadius: '9px', cursor: 'pointer',
                background: c.id === chatId ? COLORS.greenSoft : 'transparent',
              }}>
                <p style={{ flex: 1, fontSize: '12.5px', fontWeight: c.id === chatId ? 700 : 500, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</p>
                <span role="button" aria-label="Delete chat" onClick={(e) => { e.stopPropagation(); deleteChat(c.id) }} style={{ fontSize: '15px', color: COLORS.textMuted, padding: '0 4px', lineHeight: 1 }}>×</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <p style={{ fontSize: '11px', fontWeight: 800, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Company tools</p>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: COLORS.text, marginTop: '2px' }}>FarmBot for Business</h1>
        </div>
        {usage && (
          <span style={{ fontSize: '12px', fontWeight: 800, padding: '6px 12px', borderRadius: '999px', background: limitReached ? '#FEE2E2' : COLORS.greenSoft, color: limitReached ? '#B91C1C' : COLORS.greenDark }}>
            {usage.used} / {usage.limit} messages today
          </span>
        )}
        {!desktop && (
          <div onClick={() => setDrawerOpen(true)} style={{ fontSize: '12.5px', fontWeight: 700, padding: '7px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, background: COLORS.card, cursor: 'pointer' }}>Chats</div>
        )}
      </div>

      <div style={{ display: 'flex', height: desktop ? 'calc(100dvh - 190px)' : 'calc(100dvh - 200px)', minHeight: 420, background: COLORS.card, borderRadius: '16px', border: `1px solid ${COLORS.border}`, overflow: 'hidden' }}>
        {desktop && <div style={{ width: 270, borderRight: `1px solid ${COLORS.border}`, background: '#FBFDFB', flexShrink: 0 }}>{chatList}</div>}

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: desktop ? '24px 28px' : '14px' }}>
            {messages.length === 0 && !loadingMsgs && (
              <div style={{ maxWidth: 640, margin: '30px auto 0', textAlign: 'center' }}>
                <div style={{ width: '54px', height: '54px', borderRadius: '27px', background: COLORS.greenSoft, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="leaf" size={26} color={COLORS.green} />
                </div>
                <p style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text, marginTop: '12px' }}>How can FarmBot help {company.name} today?</p>
                <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginTop: '6px', lineHeight: 1.5 }}>Product descriptions, posts, pricing, customers and farming questions.</p>
                <div style={{ display: 'grid', gridTemplateColumns: desktop ? '1fr 1fr' : '1fr', gap: '10px', marginTop: '20px', textAlign: 'left' }}>
                  {SUGGESTIONS.map((s) => (
                    <div key={s} onClick={() => send(s)} style={{ padding: '12px 14px', borderRadius: '12px', border: `1px solid ${COLORS.border}`, fontSize: '12.5px', color: COLORS.text, cursor: limitReached ? 'default' : 'pointer', opacity: limitReached ? 0.5 : 1 }}>
                      {s}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {loadingMsgs && <p style={{ textAlign: 'center', fontSize: '12.5px', color: COLORS.textMuted, marginTop: '30px' }}>Loading…</p>}

            <div style={{ maxWidth: 820, margin: '0 auto' }}>
              {messages.map((m) => (
                <div key={m.id} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: '12px' }}>
                  <div style={{
                    maxWidth: '82%', padding: '11px 14px', borderRadius: '14px', fontSize: '13.5px', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    background: m.role === 'user' ? COLORS.green : COLORS.bg,
                    color: m.role === 'user' ? 'white' : COLORS.text,
                    border: m.role === 'user' ? 'none' : `1px solid ${COLORS.border}`,
                  }}>
                    {m.message}
                  </div>
                </div>
              ))}
              {sending && <p style={{ fontSize: '12.5px', color: COLORS.textMuted, margin: '4px 0 12px' }}>FarmBot is thinking…</p>}
            </div>
          </div>

          <div style={{ borderTop: `1px solid ${COLORS.border}`, padding: desktop ? '14px 28px' : '10px 12px', background: COLORS.card }}>
            <div style={{ maxWidth: 820, margin: '0 auto' }}>
              {notice && (
                <div style={{ marginBottom: '10px', padding: '10px 12px', borderRadius: '10px', background: notice.kind === 'limit' ? '#FEF3C7' : '#FEE2E2', color: notice.kind === 'limit' ? '#92400E' : '#B91C1C', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ flex: 1, minWidth: 180 }}>{notice.text}</span>
                  {notice.upgrade && !premium && (
                    <span onClick={() => navigate('/company/premium')} style={{ fontWeight: 800, textDecoration: 'underline', cursor: 'pointer' }}>Upgrade to Company Premium</span>
                  )}
                  {notice.retry && <span onClick={() => send(notice.retry, true)} style={{ fontWeight: 800, textDecoration: 'underline', cursor: 'pointer' }}>Resend</span>}
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                <textarea
                  ref={inputRef}
                  value={draft}
                  rows={1}
                  disabled={limitReached}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && desktop) { e.preventDefault(); send() } }}
                  placeholder={limitReached ? 'Daily limit reached. Come back tomorrow.' : 'Ask FarmBot about your business…'}
                  style={{ flex: 1, resize: 'none', border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '11px 14px', fontSize: '13.5px', fontFamily: 'inherit', outline: 'none', color: COLORS.text, background: limitReached ? COLORS.bg : COLORS.card }}
                />
                <div role="button" aria-label="Send" onClick={() => send()} style={{
                  padding: '12px 20px', borderRadius: '12px', fontWeight: 800, fontSize: '13px', cursor: 'pointer',
                  background: draft.trim() && !sending && !limitReached ? COLORS.green : '#BBD9C3', color: 'white',
                }}>
                  Send
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!desktop && drawerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
          <div onClick={() => setDrawerOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
          <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 290, maxWidth: '84%', background: COLORS.card }}>{chatList}</div>
        </div>
      )}
    </div>
  )
}
