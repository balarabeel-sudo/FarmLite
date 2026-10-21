import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import Icon from '../Icons'
import { isPremiumActive } from '../premiumShared'
import {
  DEFAULT_MAX_FARMBOT_PHOTOS, FARMBOT_BUSY_TEXT, isPermissionError, removeFarmbotPhotos, signFarmbotPhotos, uploadFarmbotPhotos,
} from '../farmbotPhotos'
import type { CompanyCtx } from './CompanyLayout'

const COLORS = {
  bg: 'var(--fx-bg)',
  card: 'var(--fx-card)',
  border: 'var(--fx-border)',
  green: '#16A34A',
  greenDark: 'var(--fx-green-dark)',
  greenSoft: 'var(--fx-tint-green)',
  text: 'var(--fx-text)',
  textMuted: 'var(--fx-muted)',
  red: 'var(--fx-red-text)',
}

const COMPANY_FREE_LIMIT_TEXT = "Your company has reached today's free FarmBot limit. Upgrade to Company Premium to keep chatting."
const COMPANY_PHOTO_PREMIUM_TEXT = 'Photo questions are a Premium feature. Upgrade to Company Premium to send photos to FarmBot.'

type ChatMessage = { id: string; role: 'user' | 'assistant'; message: string; images?: string[] }
type Chat = { id: string; title: string; updated_at: string; pinned_at: string | null }
type Usage = { used: number; limit: number; premium: boolean; photos?: number }
type Attachment = { id: string; file: File; url: string }
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
    { label: 'Pinned', items: [] },
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Previous 7 days', items: [] },
    { label: 'Older', items: [] },
  ]
  chats.forEach((c) => {
    if (c.pinned_at) { groups[0].items.push(c); return }
    const t = new Date(c.updated_at).getTime()
    if (t >= startOfToday.getTime()) groups[1].items.push(c)
    else if (t >= startOfToday.getTime() - day) groups[2].items.push(c)
    else if (t >= startOfToday.getTime() - 7 * day) groups[3].items.push(c)
    else groups[4].items.push(c)
  })
  return groups.filter((g) => g.items.length > 0)
}

function PinIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6z" /></svg>
  )
}

// Route: /company/farmbot  (inside the desktop-style company dashboard)
export default function CompanyFarmBotPage() {
  const { company } = useOutletContext<CompanyCtx>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const desktop = useWidth() >= 900
  const premium = isPremiumActive(company.is_premium, company.premium_until)

  const [chats, setChats] = useState<Chat[]>([])
  const [chatId, setChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [sending, setSending] = useState(false)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [usage, setUsage] = useState<Usage | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [menuChat, setMenuChat] = useState<Chat | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const pressTimer = useRef<number | null>(null)
  const longPressed = useRef(false)
  const attachmentsRef = useRef<Attachment[]>([])
  attachmentsRef.current = attachments

  // Free the temporary previews of photos that were never sent
  useEffect(() => () => { attachmentsRef.current.forEach((a) => URL.revokeObjectURL(a.url)) }, [])

  const loadChats = async (): Promise<Chat[]> => {
    const { data } = await supabase
      .from('company_farmbot_chats')
      .select('id, title, updated_at, pinned_at')
      .eq('company_id', company.id)
      .order('pinned_at', { ascending: false, nullsFirst: false })
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
      .select('id, role, message, image_paths')
      .eq('chat_id', id)
      .order('created_at', { ascending: true })
    const rows = (data || []) as { id: string; role: 'user' | 'assistant'; message: string; image_paths: string[] | null }[]
    const signed = await signFarmbotPhotos(rows.flatMap((r) => r.image_paths || []))
    setMessages(rows.map((r) => ({
      id: r.id,
      role: r.role,
      message: r.message,
      images: (r.image_paths || []).map((p) => signed[p]).filter(Boolean),
    })))
    setLoadingMsgs(false)
  }

  // The numbers are never shown; they only decide what is allowed.
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
        // Open the chat that was used most recently (pinned chats are only sorted first in the list)
        const latest = [...list].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0]
        setChatId(latest.id)
        loadMessages(latest.id)
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
  const maxPhotos = typeof usage?.photos === 'number' && usage.photos > 0 ? usage.photos : DEFAULT_MAX_FARMBOT_PHOTOS
  const canPhotos = usage ? (typeof usage.photos === 'number' ? usage.photos > 0 : usage.premium) : premium

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

  const togglePin = async (c: Chat) => {
    setMenuChat(null)
    const { error } = await supabase.rpc('company_farmbot_set_pinned', { p_chat: c.id, p_pinned: !c.pinned_at })
    if (error) { alert('Could not update the chat. Please try again.'); return }
    loadChats()
  }

  const deleteChat = async (c: Chat) => {
    setMenuChat(null)
    if (sending) return
    if (!window.confirm('Delete this chat?')) return
    // Photos of this chat are removed together with it
    const { data: imgRows } = await supabase.from('company_farmbot_messages').select('image_paths').eq('chat_id', c.id)
    const paths = ((imgRows || []) as { image_paths: string[] | null }[]).flatMap((r) => r.image_paths || [])
    const { error } = await supabase.from('company_farmbot_chats').delete().eq('id', c.id)
    if (error) { alert('Could not delete the chat. Please try again.'); return }
    removeFarmbotPhotos(paths)
    setChats((prev) => prev.filter((x) => x.id !== c.id))
    if (c.id === chatId) { setChatId(null); setMessages([]); setNotice(null) }
  }

  // Long press (or right click) on a chat opens the same menu as the "..." button
  const startPress = (c: Chat) => {
    longPressed.current = false
    pressTimer.current = window.setTimeout(() => {
      longPressed.current = true
      pressTimer.current = null
      setMenuChat(c)
    }, 500)
  }
  const endPress = () => {
    if (pressTimer.current) { window.clearTimeout(pressTimer.current); pressTimer.current = null }
  }

  const pickPhotos = () => {
    if (sending) return
    if (!canPhotos) {
      setNotice({ kind: 'limit', text: COMPANY_PHOTO_PREMIUM_TEXT, upgrade: true })
      return
    }
    fileRef.current?.click()
  }

  const onFilesChosen = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = (Array.from(e.target.files || []) as File[]).filter((f) => f.type.startsWith('image/'))
    e.target.value = ''
    if (picked.length === 0) return
    const room = maxPhotos - attachments.length
    if (room <= 0) {
      setNotice({ kind: 'generic', text: `You can attach up to ${maxPhotos} photos per question.` })
      return
    }
    if (picked.length > room) setNotice({ kind: 'generic', text: `You can attach up to ${maxPhotos} photos per question.` })
    const take = picked.slice(0, room)
    setAttachments((prev) => [...prev, ...take.map((file) => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, file, url: URL.createObjectURL(file) }))])
  }

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const gone = prev.find((a) => a.id === id)
      if (gone) URL.revokeObjectURL(gone.url)
      return prev.filter((a) => a.id !== id)
    })
  }

  const send = async (text?: string, isRetry = false) => {
    const content = (text ?? draft).trim()
    const pending = isRetry ? [] : attachments
    if ((!content && pending.length === 0) || sending || limitReached) return

    setNotice(null)
    setSending(true)
    if (!isRetry) {
      setDraft('')
      setAttachments([])
      setMessages((prev) => [...prev, { id: `local-${Date.now()}`, role: 'user', message: content, images: pending.map((a) => a.url) }])
    }

    // Takes the bubble back and gives the text and photos back to the message box
    const restore = () => {
      if (isRetry) return
      setMessages((prev) => prev.slice(0, -1))
      setDraft(content)
      setAttachments(pending)
    }

    const networkNotice: Notice = pending.length === 0
      ? { kind: 'network', text: 'No internet connection. Check your network, then tap Resend.', retry: content }
      : { kind: 'network', text: 'No internet connection. Check your network, then send again.' }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setSending(false)
      if (pending.length > 0) restore()
      setNotice(networkNotice)
      return
    }

    // Upload the photos first (Company Premium only; the database enforces this too)
    let imagePaths: string[] = []
    if (pending.length > 0) {
      try {
        if (!user) throw new Error('Not signed in')
        imagePaths = await uploadFarmbotPhotos(user.id, pending.map((a) => a.file))
      } catch (err) {
        setSending(false)
        restore()
        if (isPermissionError(err)) setNotice({ kind: 'limit', text: COMPANY_PHOTO_PREMIUM_TEXT, upgrade: true })
        else setNotice({ kind: 'generic', text: 'Could not upload your photos. Check your connection and try again.' })
        return
      }
    }

    const { data, error: fnError } = await supabase.functions.invoke('farmbot-company', {
      body: { message: content, image_paths: imagePaths, conversation_id: chatId, company_id: company.id },
    })
    setSending(false)

    // The photos were not used, so they are removed again
    const dropPhotos = () => { if (imagePaths.length > 0) removeFarmbotPhotos(imagePaths) }

    // The numbers are never shown; Premium companies only see that FarmBot is busy.
    if (data?.code === 'user_limit') {
      if (data.usage) setUsage(data.usage)
      dropPhotos()
      restore()
      const isPremium = !!data.usage?.premium
      setNotice({ kind: 'limit', text: isPremium ? FARMBOT_BUSY_TEXT : COMPANY_FREE_LIMIT_TEXT, upgrade: !isPremium })
      return
    }
    if (data?.code === 'daily_limit') {
      dropPhotos()
      restore()
      setNotice({ kind: 'limit', text: FARMBOT_BUSY_TEXT })
      return
    }
    if (data?.code === 'photos_premium' || data?.code === 'too_many_photos' || data?.code === 'photo_error') {
      dropPhotos()
      restore()
      setNotice({ kind: 'limit', text: data.error, upgrade: data.code === 'photos_premium' })
      return
    }
    if (fnError || data?.error) {
      const msg = fnError?.message || ''
      const isNetwork = fnError?.name === 'FunctionsFetchError' || /failed to (send|fetch)|network|load failed/i.test(msg)
      if (pending.length > 0) {
        dropPhotos()
        restore()
        setNotice(isNetwork ? networkNotice : { kind: 'generic', text: data?.code && data?.error ? data.error : 'Something went wrong. Please try again.' })
        return
      }
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
              <div
                key={c.id}
                onClick={() => { if (longPressed.current) { longPressed.current = false; return } openChat(c.id) }}
                onTouchStart={() => startPress(c)}
                onTouchEnd={endPress}
                onTouchMove={endPress}
                onTouchCancel={endPress}
                onContextMenu={(e) => { e.preventDefault(); setMenuChat(c) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 10px', borderRadius: '9px', cursor: 'pointer',
                  background: c.id === chatId ? COLORS.greenSoft : 'transparent', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
                }}>
                {c.pinned_at && <PinIcon size={13} color={COLORS.green} />}
                <p style={{ flex: 1, fontSize: '12.5px', fontWeight: c.id === chatId ? 700 : 500, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</p>
                <span
                  role="button"
                  aria-label="Chat options"
                  onClick={(e) => { e.stopPropagation(); setMenuChat(c) }}
                  style={{ display: 'flex', padding: '4px', cursor: 'pointer' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={COLORS.textMuted}><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )

  const canSend = (!!draft.trim() || attachments.length > 0) && !sending && !limitReached

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <p style={{ fontSize: '11px', fontWeight: 800, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Company tools</p>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: COLORS.text, marginTop: '2px' }}>FarmBot for Business</h1>
        </div>
        {!desktop && (
          <div onClick={() => setDrawerOpen(true)} style={{ fontSize: '12.5px', fontWeight: 700, padding: '7px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, background: COLORS.card, cursor: 'pointer' }}>Chats</div>
        )}
      </div>

      <div style={{ display: 'flex', height: desktop ? 'calc(100dvh - 190px)' : 'calc(100dvh - 200px)', minHeight: 420, background: COLORS.card, borderRadius: '16px', border: `1px solid ${COLORS.border}`, overflow: 'hidden' }}>
        {desktop && <div style={{ width: 270, borderRight: `1px solid ${COLORS.border}`, background: 'var(--fx-grey1)', flexShrink: 0 }}>{chatList}</div>}

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: desktop ? '24px 28px' : '14px' }}>
            {messages.length === 0 && !loadingMsgs && (
              <div style={{ maxWidth: 640, margin: '30px auto 0', textAlign: 'center' }}>
                <div style={{ width: '54px', height: '54px', borderRadius: '27px', background: COLORS.greenSoft, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="leaf" size={26} color={COLORS.green} />
                </div>
                <p style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text, marginTop: '12px' }}>How can FarmBot help {company.name} today?</p>
                <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginTop: '6px', lineHeight: 1.5 }}>
                  Product descriptions, posts, pricing, customers and farming questions. Company Premium can also send photos of products, crops, animals or equipment.
                </p>
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
                    maxWidth: m.role === 'user' ? '82%' : '94%', padding: '11px 14px', borderRadius: '14px', fontSize: '13.5px', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    background: m.role === 'user' ? COLORS.green : COLORS.bg,
                    color: m.role === 'user' ? 'white' : COLORS.text,
                    border: m.role === 'user' ? 'none' : `1px solid ${COLORS.border}`,
                  }}>
                    {m.images && m.images.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: m.message ? '8px' : 0 }}>
                        {m.images.map((src, i) => (
                          <img
                            key={i}
                            src={src}
                            alt="Photo"
                            onClick={() => setLightbox(src)}
                            style={{ width: m.images!.length === 1 ? 200 : 96, height: m.images!.length === 1 ? 200 : 96, objectFit: 'cover', borderRadius: '10px', cursor: 'pointer', background: 'rgba(0,0,0,0.06)' }}
                          />
                        ))}
                      </div>
                    )}
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
                <div style={{ marginBottom: '10px', padding: '10px 12px', borderRadius: '10px', background: notice.kind === 'limit' ? 'var(--fx-tint-amber)' : 'var(--fx-tint-red)', color: notice.kind === 'limit' ? 'var(--fx-amber-text)' : 'var(--fx-red-text)', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ flex: 1, minWidth: 180 }}>{notice.text}</span>
                  {notice.upgrade && !premium && (
                    <span onClick={() => navigate('/company/premium')} style={{ fontWeight: 800, textDecoration: 'underline', cursor: 'pointer' }}>Upgrade to Company Premium</span>
                  )}
                  {notice.retry && <span onClick={() => send(notice.retry, true)} style={{ fontWeight: 800, textDecoration: 'underline', cursor: 'pointer' }}>Resend</span>}
                </div>
              )}

              {limitReached && usage && (
                <div style={{ marginBottom: '10px', padding: '10px 12px', borderRadius: '10px', background: 'var(--fx-tint-amber)', color: 'var(--fx-amber-text)', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ flex: 1, minWidth: 180 }}>{usage.premium ? FARMBOT_BUSY_TEXT : COMPANY_FREE_LIMIT_TEXT}</span>
                  {!usage.premium && !premium && (
                    <span onClick={() => navigate('/company/premium')} style={{ fontWeight: 800, textDecoration: 'underline', cursor: 'pointer' }}>Upgrade to Company Premium</span>
                  )}
                </div>
              )}

              {attachments.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', paddingBottom: '10px', overflowX: 'auto' }}>
                  {attachments.map((a) => (
                    <div key={a.id} style={{ position: 'relative', width: '62px', height: '62px', flexShrink: 0 }}>
                      <img src={a.url} alt="Selected photo" style={{ width: '62px', height: '62px', objectFit: 'cover', borderRadius: '10px', border: `1px solid ${COLORS.border}` }} />
                      <div
                        role="button"
                        aria-label="Remove photo"
                        onClick={() => removeAttachment(a.id)}
                        style={{ position: 'absolute', top: '-6px', right: '-6px', width: '20px', height: '20px', borderRadius: '10px', background: '#1F2F21', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                <input ref={fileRef} type="file" accept="image/*" multiple onChange={onFilesChosen} style={{ display: 'none' }} />
                <div
                  role="button"
                  aria-label="Add photos"
                  onClick={pickPhotos}
                  style={{ position: 'relative', width: '44px', height: '44px', borderRadius: '12px', border: `1px solid ${COLORS.border}`, background: COLORS.card, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: limitReached ? 'default' : 'pointer', flexShrink: 0, opacity: limitReached ? 0.5 : 1 }}>
                  <Icon name="camera" size={19} color={canPhotos ? COLORS.green : COLORS.textMuted} />
                  {!canPhotos && (
                    <span style={{ position: 'absolute', top: '-4px', right: '-4px', width: '16px', height: '16px', borderRadius: '8px', background: '#F5D060', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="crown" size={10} color="var(--fx-amber-text)" />
                    </span>
                  )}
                </div>
                <textarea
                  ref={inputRef}
                  value={draft}
                  rows={1}
                  disabled={limitReached}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && desktop) { e.preventDefault(); send() } }}
                  placeholder={limitReached ? (usage?.premium ? 'FarmBot is busy. Try again later.' : 'Free limit reached.') : attachments.length > 0 ? 'Add a question about the photo(s)…' : 'Ask FarmBot about your business…'}
                  style={{ flex: 1, minWidth: 0, resize: 'none', border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '11px 14px', fontSize: '13.5px', fontFamily: 'inherit', outline: 'none', color: COLORS.text, background: limitReached ? COLORS.bg : COLORS.card }}
                />
                <div role="button" aria-label="Send" onClick={() => send()} style={{
                  padding: '12px 20px', borderRadius: '12px', fontWeight: 800, fontSize: '13px', cursor: canSend ? 'pointer' : 'default',
                  background: canSend ? COLORS.green : 'var(--fx-border2)', color: 'white',
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

      {/* Chat options: pin or delete */}
      {menuChat && (
        <div onClick={() => setMenuChat(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 70, display: 'flex', alignItems: desktop ? 'center' : 'flex-end', justifyContent: 'center' }}>
          <div
            role="dialog"
            aria-label="Chat options"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 380, background: COLORS.card, borderRadius: desktop ? '16px' : '18px 18px 0 0', padding: '14px 16px calc(16px + env(safe-area-inset-bottom, 0px))' }}>
            <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingBottom: '10px' }}>{menuChat.title}</p>
            <div onClick={() => togglePin(menuChat)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 4px', cursor: 'pointer', borderTop: `1px solid ${COLORS.border}` }}>
              <PinIcon size={18} color={COLORS.text} />
              <p style={{ fontSize: '14px', fontWeight: 600, color: COLORS.text }}>{menuChat.pinned_at ? 'Unpin chat' : 'Pin chat'}</p>
            </div>
            <div onClick={() => deleteChat(menuChat)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 4px', cursor: 'pointer', borderTop: `1px solid ${COLORS.border}` }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COLORS.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
              <p style={{ fontSize: '14px', fontWeight: 600, color: COLORS.red }}>Delete chat</p>
            </div>
            <div onClick={() => setMenuChat(null)} style={{ textAlign: 'center', padding: '13px 4px 2px', cursor: 'pointer', borderTop: `1px solid ${COLORS.border}`, fontSize: '14px', fontWeight: 700, color: COLORS.textMuted }}>
              Cancel
            </div>
          </div>
        </div>
      )}

      {/* Full-screen photo */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <img src={lightbox} alt="Photo" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '8px' }} />
        </div>
      )}
    </div>
  )
}
