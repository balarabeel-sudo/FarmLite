import { Fragment, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, CSSProperties, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import Icon from '../Icons'
import NetworkError from '../NetworkError'
import FarmProfileSheet from '../FarmProfileSheet'
import {
  DEFAULT_MAX_FARMBOT_PHOTOS, FARMBOT_BUSY_TEXT, FARMBOT_FREE_LIMIT_TEXT, FARMBOT_PHOTO_PREMIUM_TEXT,
  isPermissionError, removeFarmbotPhotos, signFarmbotPhotos, uploadFarmbotPhotos,
} from '../farmbotPhotos'

const COLORS = {
  bg: 'var(--fx-tint-green3)',
  card: 'var(--fx-card)',
  border: 'var(--fx-tint-green)',
  green: '#16A34A',
  greenDark: 'var(--fx-green-deep)',
  text: 'var(--fx-text)',
  textMuted: 'var(--fx-muted)',
  red: 'var(--fx-red-text)',
}

// Search results FarmBot found in Farmxie, and the Farm Desk button, shown under an answer
type ResultCard = { type: 'marketplace' | 'equipment' | 'company'; id: string; title: string; subtitle: string; image: string | null; path: string }
type Extras = { items: ResultCard[]; farm_desk: boolean; farm_desk_request?: string | null }

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  message: string
  images?: string[]
  uploading?: boolean
  extras?: Extras | null
}

type Chat = {
  id: string
  title: string
  updated_at: string
  pinned_at: string | null
}

type Usage = { used: number; limit: number; premium: boolean; photos?: number }
type Attachment = { id: string; file: File; url: string }
type Notice = { kind: 'network' | 'limit' | 'generic'; text: string; retry?: string; upgrade?: boolean }

// Remembered between visits (while the app stays open) so the page opens instantly
// with the last chat instead of showing a loader every time. It is refreshed quietly in the background.
const memory: { userId: string; chats: Chat[] | null; chatId: string | null; messages: Record<string, ChatMessage[]> } = {
  userId: '', chats: null, chatId: null, messages: {},
}

function isWarm(userId: string | undefined): boolean {
  if (!userId || memory.userId !== userId || !memory.chats) return false
  if (memory.chats.length === 0) return true
  return !!memory.chatId && !!memory.messages[memory.chatId]
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

export default function FarmBotPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const warmStart = isWarm(user?.id)
  const [loading, setLoading] = useState(!warmStart)
  const [netError, setNetError] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(warmStart && memory.chatId ? (memory.messages[memory.chatId] || []) : [])
  const [draft, setDraft] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [usage, setUsage] = useState<Usage | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [farmSheetOpen, setFarmSheetOpen] = useState(false)

  const [chatId, setChatId] = useState<string | null>(warmStart ? memory.chatId : null)
  const [chats, setChats] = useState<Chat[]>(warmStart ? memory.chats || [] : [])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [menuChat, setMenuChat] = useState<Chat | null>(null)

  const chatIdRef = useRef<string | null>(chatId)
  chatIdRef.current = chatId
  const loadSeq = useRef(0)
  const instantScroll = useRef(true)
  const prevLen = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const pressTimer = useRef<number | null>(null)
  const longPressed = useRef(false)
  const attachmentsRef = useRef<Attachment[]>([])
  attachmentsRef.current = attachments

  // The page itself never scrolls; only the message list does.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // Free the temporary previews of photos that were never sent
  useEffect(() => () => { attachmentsRef.current.forEach((a) => URL.revokeObjectURL(a.url)) }, [])

  const loadChats = async (): Promise<Chat[]> => {
    if (!user) return []
    const { data } = await supabase
      .from('farmbot_chats')
      .select('id, title, updated_at, pinned_at')
      .eq('user_id', user.id)
      .order('pinned_at', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false })
      .limit(50)
    const list = (data || []) as Chat[]
    setChats(list)
    return list
  }

  // silent = the chat is already on screen (from memory), so refresh it quietly without a loader
  const loadMessages = async (id: string, silent = false) => {
    const seq = ++loadSeq.current
    setNetError(false)
    if (!silent) setLoading(true)
    const { data, error: fetchError } = await supabase
      .from('ai_conversations')
      .select('id, role, message, image_paths, cards')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })

    if (seq !== loadSeq.current) return
    if (fetchError) {
      if (!silent) setNetError(true)
      setLoading(false)
      return
    }
    const rows = (data || []) as { id: string; role: 'user' | 'assistant'; message: string; image_paths: string[] | null; cards: Extras | null }[]
    const signed = await signFarmbotPhotos(rows.flatMap((r) => r.image_paths || []))
    if (seq !== loadSeq.current) return
    // A message that is being sent right now must not be wiped by a background refresh
    if (silent && sendingRef.current) { setLoading(false); return }
    if (!silent) instantScroll.current = true
    setMessages(rows.map((r) => ({
      id: r.id,
      role: r.role,
      message: r.message,
      images: (r.image_paths || []).map((p) => signed[p]).filter(Boolean),
      extras: r.role === 'assistant' ? r.cards : null,
    })))
    setLoading(false)
  }

  const init = async () => {
    if (!user) return
    setNetError(false)
    const warm = isWarm(user.id)
    if (!warm) setLoading(true)
    const list = await loadChats()
    if (list.length > 0) {
      // Keep the chat that is already open; otherwise open the one used most recently
      // (pinned chats are only sorted first in the list)
      const open = chatIdRef.current ? list.find((c) => c.id === chatIdRef.current) : undefined
      const latest = [...list].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0]
      const target = open ? open.id : latest.id
      setChatId(target)
      await loadMessages(target, warm && !!open)
    } else {
      setChatId(null)
      setLoading(false)
    }
  }

  // Depends on the user's id (not the user object), so a background token refresh never reloads the page
  useEffect(() => { init() }, [user?.id])

  // Remember what is on screen for the next visit
  useEffect(() => {
    if (!user || loading) return
    if (memory.userId !== user.id) { memory.userId = user.id; memory.messages = {} }
    memory.chats = chats
    memory.chatId = chatId
    if (chatId) memory.messages[chatId] = messages
  }, [messages, chatId, chats, loading, user?.id])

  // Real usage for today (counted on the server). The numbers are never shown; they only decide what is allowed.
  useEffect(() => {
    if (!user) return
    supabase.rpc('farmbot_usage').then(({ data }) => {
      if (data && typeof (data as any).used === 'number') setUsage(data as Usage)
    })
  }, [user])

  const limitReached = !!usage && usage.used >= usage.limit
  const maxPhotos = typeof usage?.photos === 'number' && usage.photos > 0 ? usage.photos : DEFAULT_MAX_FARMBOT_PHOTOS
  const canPhotos = usage ? (typeof usage.photos === 'number' ? usage.photos > 0 : usage.premium) : true

  const sendingRef = useRef(false)
  sendingRef.current = sending

  // Opening a chat jumps straight to the newest message; new messages scroll smoothly
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const jump = instantScroll.current || prevLen.current === 0
    el.scrollTo({ top: el.scrollHeight, behavior: jump ? 'auto' : 'smooth' })
    if (!loading && messages.length > 0) instantScroll.current = false
    prevLen.current = messages.length
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

  const togglePin = async (c: Chat) => {
    setMenuChat(null)
    const { error: pinError } = await supabase.rpc('farmbot_set_pinned', { p_chat: c.id, p_pinned: !c.pinned_at })
    if (pinError) {
      alert('Could not update the chat. Please try again.')
      return
    }
    loadChats()
  }

  const deleteChat = async (c: Chat) => {
    setMenuChat(null)
    if (sending) return
    if (!window.confirm('Delete this chat?')) return
    // Photos of this chat are removed together with it
    const { data: imgRows } = await supabase.from('ai_conversations').select('image_paths').eq('conversation_id', c.id)
    const paths = ((imgRows || []) as { image_paths: string[] | null }[]).flatMap((r) => r.image_paths || [])
    const { error: delError } = await supabase.from('farmbot_chats').delete().eq('id', c.id)
    if (delError) {
      alert('Could not delete the chat. Please try again.')
      return
    }
    removeFarmbotPhotos(paths)
    setChats((prev) => prev.filter((x) => x.id !== c.id))
    if (c.id === chatId) {
      setChatId(null)
      setMessages([])
      setNotice(null)
    }
  }

  // Long press (or right click) on a chat in the history opens the same menu as the "..." button
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
      setNotice({ kind: 'limit', text: FARMBOT_PHOTO_PREMIUM_TEXT, upgrade: true })
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

    // Show the user's message immediately (a resend reuses the bubble that is already there).
    if (!isRetry) {
      setDraft('')
      setAttachments([])
      setMessages((prev) => [...prev, { id: `local-${Date.now()}`, role: 'user', message: content, images: pending.map((a) => a.url), uploading: pending.length > 0 }])
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

    // Upload the photos first (Premium only; the database enforces this too)
    let imagePaths: string[] = []
    if (pending.length > 0) {
      try {
        if (!user) throw new Error('Not signed in')
        imagePaths = await uploadFarmbotPhotos(user.id, pending.map((a) => a.file))
      } catch (err) {
        setSending(false)
        restore()
        if (isPermissionError(err)) setNotice({ kind: 'limit', text: FARMBOT_PHOTO_PREMIUM_TEXT, upgrade: true })
        else setNotice({ kind: 'generic', text: 'Could not upload your photos. Check your connection and try again.' })
        return
      }
    }

    // Photos are uploaded: the bubble stops showing the "sending" shade
    if (!isRetry) setMessages((prev) => prev.map((m, i) => (i === prev.length - 1 && m.uploading ? { ...m, uploading: false } : m)))

    const { data, error: fnError } = await supabase.functions.invoke('farmbot-chat', {
      body: { message: content, image_paths: imagePaths, conversation_id: chatId, new_chat: !chatId },
    })

    setSending(false)

    // The photos were not used, so they are removed again
    const dropPhotos = () => { if (imagePaths.length > 0) removeFarmbotPhotos(imagePaths) }

    // The daily message limit was reached: nothing was sent, so take the bubble back and keep the text.
    // The numbers are never shown; Premium members only see that FarmBot is busy.
    if (data?.code === 'user_limit') {
      if (data.usage) setUsage(data.usage)
      dropPhotos()
      restore()
      const premium = !!data.usage?.premium
      setNotice({ kind: 'limit', text: premium ? FARMBOT_BUSY_TEXT : FARMBOT_FREE_LIMIT_TEXT, upgrade: !premium })
      return
    }

    // AI provider quota reached: friendly message, nothing technical shown.
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
    setMessages((prev) => [...prev, { id: `local-${Date.now()}-r`, role: 'assistant', message: data.reply, extras: data.extras || null }])
    loadChats()
  }

  const shell: CSSProperties = {
    height: '100dvh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto',
    display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden',
  }

  if (netError) {
    return (
      <div style={shell}>
        <Header onMenu={() => setDrawerOpen(true)} onNew={newChat} onFarm={() => setFarmSheetOpen(true)} />
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <NetworkError onRetry={() => (chatId ? loadMessages(chatId) : init())} />
        </div>
      </div>
    )
  }

  const empty = !loading && messages.length === 0
  const canSend = (!!draft.trim() || attachments.length > 0) && !sending && !limitReached

  return (
    <div style={shell}>
      <style>{`
        @keyframes fbDot { 0%, 80%, 100% { opacity: .25; transform: translateY(0) } 40% { opacity: 1; transform: translateY(-3px) } }
        @keyframes fbSlide { from { transform: translateX(-100%) } to { transform: translateX(0) } }
        @keyframes fbRise { from { transform: translateY(100%) } to { transform: translateY(0) } }
      `}</style>

      <Header onMenu={() => setDrawerOpen(true)} onNew={newChat} onFarm={() => setFarmSheetOpen(true)} />

      {/* Messages (the only scrolling area) */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {loading ? (
          <p style={{ fontSize: '12.5px', color: COLORS.textMuted, textAlign: 'center', marginTop: '30px' }}>Loading conversation...</p>
        ) : empty ? (
          <div style={{ margin: 'auto 0', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '10px 4px' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '30px', background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.greenDark})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(22,163,74,0.3)' }}>
              <Icon name="robot" size={30} color="white" />
            </div>
            <p style={{ fontSize: '18px', fontWeight: 800, color: COLORS.text, marginTop: '14px' }}>Hi! I'm FarmBot</p>
            <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginTop: '5px', lineHeight: 1.5, maxWidth: '300px' }}>
              Your AI farming assistant. Ask me about crops, seeds, livestock, equipment, soil, pests, weather or market prices. Premium members can also send photos of crops, animals, seeds or equipment.
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
          messages.map((m) => (
            <Fragment key={m.id}>
              <Bubble role={m.role} text={m.message} images={m.images} uploading={m.uploading} onOpenImage={setLightbox} />
              {m.role === 'assistant' && m.extras && (m.extras.items?.length > 0 || m.extras.farm_desk) && (
                <ExtrasBlock extras={m.extras} onOpen={(path) => navigate(path)} />
              )}
            </Fragment>
          ))
        )}

        {sending && <TypingBubble />}

        {notice && (
          <div style={{
            background: notice.kind === 'limit' ? 'var(--fx-tint-green3)' : 'var(--fx-tint-amber2)',
            border: `1px solid ${notice.kind === 'limit' ? COLORS.border : 'var(--fx-bd-amber)'}`,
            borderRadius: '12px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <p style={{ flex: 1, fontSize: '12px', lineHeight: 1.45, color: notice.kind === 'limit' ? COLORS.greenDark : 'var(--fx-amber-text)' }}>{notice.text}</p>
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

      {/* Limit reached: the box is locked for now. No numbers are shown. */}
      {limitReached && usage && (
        <div style={{ background: 'var(--fx-tint-green3)', borderTop: `1px solid ${COLORS.border}`, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <p style={{ flex: 1, fontSize: '12px', lineHeight: 1.45, color: COLORS.greenDark }}>
            {usage.premium ? FARMBOT_BUSY_TEXT : FARMBOT_FREE_LIMIT_TEXT}
          </p>
          {!usage.premium && (
            <div onClick={() => navigate('/premium')} style={{ background: COLORS.green, color: 'white', borderRadius: '10px', padding: '8px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
              Upgrade to Premium
            </div>
          )}
        </div>
      )}

      {/* Composer (always pinned to the bottom) */}
      <div style={{ padding: '10px 12px calc(10px + env(safe-area-inset-bottom, 0px))', background: COLORS.card, borderTop: `1px solid ${COLORS.border}` }}>
        {attachments.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', paddingBottom: '10px', overflowX: 'auto' }}>
            {attachments.map((a) => (
              <div key={a.id} style={{ position: 'relative', width: '58px', height: '58px', flexShrink: 0 }}>
                <img src={a.url} alt="Selected photo" style={{ width: '58px', height: '58px', objectFit: 'cover', borderRadius: '10px', border: `1px solid ${COLORS.border}` }} />
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
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={onFilesChosen} style={{ display: 'none' }} />
          <div
            role="button"
            aria-label="Add photos"
            onClick={pickPhotos}
            style={{ position: 'relative', width: '40px', height: '40px', borderRadius: '20px', border: `1px solid ${COLORS.border}`, background: COLORS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: limitReached ? 'default' : 'pointer', flexShrink: 0, opacity: limitReached ? 0.5 : 1 }}>
            <Icon name="camera" size={18} color={canPhotos ? COLORS.green : COLORS.textMuted} />
            {!canPhotos && (
              <span style={{ position: 'absolute', top: '-3px', right: '-3px', width: '16px', height: '16px', borderRadius: '8px', background: '#F5D060', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="crown" size={10} color="var(--fx-amber-text)" />
              </span>
            )}
          </div>
          <textarea
            ref={inputRef}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            disabled={limitReached}
            placeholder={limitReached ? (usage?.premium ? 'FarmBot is busy. Try again later' : 'Free limit reached') : attachments.length > 0 ? 'Add a question about the photo(s)...' : 'Ask FarmBot anything...'}
            style={{ flex: 1, minWidth: 0, resize: 'none', padding: '10px 14px', borderRadius: '20px', border: `1px solid ${COLORS.border}`, background: COLORS.bg, fontSize: '13px', lineHeight: 1.4, color: COLORS.text, outline: 'none', fontFamily: 'inherit', maxHeight: '110px' }}
          />
          <div
            role="button"
            aria-label="Send"
            onClick={() => send()}
            style={{ width: '40px', height: '40px', borderRadius: '20px', background: canSend ? COLORS.green : 'var(--fx-bd-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: canSend ? 'pointer' : 'default', flexShrink: 0 }}>
            <Icon name="send" size={16} color="white" />
          </div>
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
                      onClick={() => { if (longPressed.current) { longPressed.current = false; return } openChat(c.id) }}
                      onTouchStart={() => startPress(c)}
                      onTouchEnd={endPress}
                      onTouchMove={endPress}
                      onTouchCancel={endPress}
                      onContextMenu={(e) => { e.preventDefault(); setMenuChat(c) }}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 8px', borderRadius: '10px', cursor: 'pointer', background: c.id === chatId ? COLORS.bg : 'transparent', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}>
                      {c.pinned_at && <PinIcon size={13} color={COLORS.green} />}
                      <p style={{ flex: 1, fontSize: '12.5px', fontWeight: c.id === chatId ? 700 : 500, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</p>
                      <div
                        role="button"
                        aria-label="Chat options"
                        onClick={(e) => { e.stopPropagation(); setMenuChat(c) }}
                        style={{ display: 'flex', padding: '4px', cursor: 'pointer' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill={COLORS.textMuted}><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
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

      {/* Chat options: pin or delete */}
      {menuChat && (
        <div onClick={() => setMenuChat(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 30, display: 'flex', alignItems: 'flex-end' }}>
          <div
            role="dialog"
            aria-label="Chat options"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', background: COLORS.card, borderRadius: '18px 18px 0 0', padding: '14px 16px calc(16px + env(safe-area-inset-bottom, 0px))', animation: 'fbRise .2s ease-out' }}>
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

      {/* My farm details */}
      {farmSheetOpen && <FarmProfileSheet onClose={() => setFarmSheetOpen(false)} />}

      {/* Full-screen photo */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <img src={lightbox} alt="Photo" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '8px' }} />
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

function PinIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6z" /></svg>
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

function Bubble({ role, text, images, uploading, onOpenImage }: { role: 'user' | 'assistant'; text: string; images?: string[]; uploading?: boolean; onOpenImage: (url: string) => void }) {
  const mine = role === 'user'
  const [copied, setCopied] = useState(false)
  const hasImages = !!images && images.length > 0

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* ignore */ }
  }

  return (
    <div style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: mine ? '88%' : '100%', minWidth: 0 }}>
      <div style={{
        background: mine ? COLORS.green : COLORS.card, color: mine ? 'white' : COLORS.text,
        padding: '10px 14px', borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px', fontSize: '13px', lineHeight: 1.5,
        boxShadow: mine ? 'none' : '0 1px 4px rgba(0,0,0,0.05)',
        border: mine ? 'none' : `1px solid ${COLORS.border}`, wordBreak: 'break-word',
        whiteSpace: mine ? 'pre-wrap' : 'normal',
      }}>
        {hasImages && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: text ? '8px' : 0 }}>
            {images!.map((src, i) => (
              <img
                key={i}
                src={src}
                alt="Photo"
                loading="lazy"
                decoding="async"
                onClick={() => onOpenImage(src)}
                style={{ width: images!.length === 1 ? '180px' : '86px', height: images!.length === 1 ? '180px' : '86px', objectFit: 'cover', borderRadius: '10px', cursor: 'pointer', background: 'rgba(0,0,0,0.06)', opacity: uploading ? 0.55 : 1, transition: 'opacity .2s' }}
              />
            ))}
          </div>
        )}
        {mine ? text : <FormattedText text={text} />}
      </div>
      {!mine && (
        <span onClick={copy} style={{ display: 'inline-block', fontSize: '10.5px', fontWeight: 600, color: COLORS.textMuted, cursor: 'pointer', padding: '4px 4px 0' }}>
          {copied ? 'Copied!' : 'Copy'}
        </span>
      )}
    </div>
  )
}

const CARD_LABEL: Record<ResultCard['type'], string> = { marketplace: 'Listing', equipment: 'Equipment', company: 'Company' }

// Listings, equipment or companies FarmBot found on Farmxie, plus the Farm Desk button when FarmBot offered it
function ExtrasBlock({ extras, onOpen }: { extras: Extras; onOpen: (path: string) => void }) {
  const items = extras.items || []
  const request = (extras.farm_desk_request || '').trim()
  const deskPath = request ? `/farm-desk/new?q=${encodeURIComponent(request)}` : '/farm-desk/new'
  return (
    <div style={{ alignSelf: 'stretch', minWidth: 0, marginTop: '-6px' }}>
      {items.length > 0 && (
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px', WebkitOverflowScrolling: 'touch' }}>
          {items.map((c) => (
            <div
              key={`${c.type}-${c.id}`}
              role="button"
              onClick={() => onOpen(c.path)}
              style={{ width: '150px', flexShrink: 0, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', overflow: 'hidden', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ height: '92px', background: COLORS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {c.image
                  ? <img src={c.image} alt={c.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <Icon name="leaf" size={26} color={COLORS.green} />}
              </div>
              <div style={{ padding: '8px 10px 10px' }}>
                <p style={{ fontSize: '10px', fontWeight: 700, color: COLORS.green, letterSpacing: '0.3px' }}>{CARD_LABEL[c.type]}</p>
                <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text, marginTop: '2px', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.title}</p>
                {c.subtitle && (
                  <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '3px', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.subtitle}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {extras.farm_desk && (
        <div
          role="button"
          onClick={() => onOpen(deskPath)}
          style={{ marginTop: items.length > 0 ? '8px' : 0, display: 'flex', alignItems: 'center', gap: '10px', background: '#166534', color: 'white', borderRadius: '14px', padding: '12px 14px', cursor: 'pointer' }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '13px', fontWeight: 800 }}>Send a Farm Desk request</p>
            <p style={{ fontSize: '11.5px', opacity: 0.85, marginTop: '2px', lineHeight: 1.35 }}>Our team helps find suppliers and sends you options.</p>
          </div>
          <Icon name="chevronRight" size={18} color="white" />
        </div>
      )}
    </div>
  )
}

function TypingBubble() {
  return (
    <div style={{ alignSelf: 'flex-start' }}>
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '16px 16px 16px 4px', padding: '13px 16px', display: 'flex', gap: '4px' }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: '6px', height: '6px', borderRadius: '3px', background: COLORS.green, animation: `fbDot 1.2s infinite ${i * 0.18}s` }} />
        ))}
      </div>
    </div>
  )
}

function Header({ onMenu, onNew, onFarm }: { onMenu: () => void; onNew: () => void; onFarm: () => void }) {
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
      <div onClick={onFarm} role="button" aria-label="My farm details" style={{ cursor: 'pointer', display: 'flex', padding: '4px' }}>
        <Icon name="leaf" size={21} color={COLORS.green} />
      </div>
      <div onClick={onNew} style={{ cursor: 'pointer', display: 'flex', padding: '4px' }}>
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={COLORS.green} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
      </div>
    </div>
  )
}
