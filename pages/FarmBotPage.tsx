import { useEffect, useRef, useState } from 'react'
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

const SUGGESTIONS = [
  'How do I control pests on maize?',
  'What is the best fertilizer for rice?',
  'When should I plant tomatoes?',
]

export default function FarmBotPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const bottomRef = useRef<HTMLDivElement>(null)

  const load = async () => {
    if (!user) return
    setNetError(false)
    setLoading(true)

    const { data, error: fetchError } = await supabase
      .from('ai_conversations')
      .select('id, role, message')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (fetchError) {
      setNetError(true)
      setLoading(false)
      return
    }

    setMessages((data || []) as any)
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  const send = async (text?: string) => {
    const content = (text ?? draft).trim()
    if (!content || sending) return

    setError('')
    setDraft('')
    setSending(true)

    // Show the user's message immediately; the edge function persists it.
    setMessages((prev) => [...prev, { id: `local-${Date.now()}`, role: 'user', message: content }])

    const { data, error: fnError } = await supabase.functions.invoke('farmbot-chat', {
      body: { message: content },
    })

    setSending(false)

    if (fnError || data?.error) {
      setError(data?.error || fnError?.message || 'FarmBot could not reply. Please try again.')
      return
    }

    setMessages((prev) => [...prev, { id: `local-${Date.now()}-r`, role: 'assistant', message: data.reply }])
  }

  if (netError) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <Header onBack={() => navigate('/')} />
        <NetworkError onRetry={load} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      <Header onBack={() => navigate('/')} />

      <div style={{
        background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.greenDark})`, padding: '20px', color: 'white',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Icon name="robot" size={26} color="white" />
          <div>
            <p style={{ fontSize: '15px', fontWeight: 800 }}>FarmBot AI</p>
            <p style={{ fontSize: '11.5px', color: '#DCFCE7' }}>AI-powered farming assistant — ask anything!</p>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {loading ? (
          <p style={{ fontSize: '12.5px', color: COLORS.textMuted, textAlign: 'center' }}>Loading conversation...</p>
        ) : messages.length === 0 ? (
          <>
            <Bubble role="assistant" text="Sannu! I'm FarmBot, your AI farming assistant. Ask me anything about crops, livestock, soil, weather, or market prices!" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
              {SUGGESTIONS.map((s) => (
                <div
                  key={s}
                  onClick={() => send(s)}
                  style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '10px 14px', fontSize: '12.5px', color: COLORS.green, fontWeight: 600, cursor: 'pointer' }}>
                  {s}
                </div>
              ))}
            </div>
          </>
        ) : (
          messages.map((m) => <Bubble key={m.id} role={m.role} text={m.message} />)
        )}

        {sending && <Bubble role="assistant" text="Typing..." muted />}

        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '10px 12px' }}>
            <p style={{ fontSize: '11.5px', color: '#DC2626' }}>{error}</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', gap: '8px', padding: '12px 16px', background: COLORS.card, borderTop: `1px solid ${COLORS.border}` }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send() }}
          placeholder="Ask FarmBot anything..."
          style={{ flex: 1, padding: '10px 14px', borderRadius: '20px', border: `1px solid ${COLORS.border}`, fontSize: '13px', outline: 'none' }}
        />
        <div onClick={() => send()} style={{ width: '40px', height: '40px', borderRadius: '20px', background: COLORS.green, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: sending ? 0.6 : 1 }}>
          <Icon name="send" size={16} color="white" />
        </div>
      </div>
    </div>
  )
}

function Bubble({ role, text, muted }: { role: 'user' | 'assistant'; text: string; muted?: boolean }) {
  const mine = role === 'user'
  return (
    <div style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
      <div style={{
        background: mine ? COLORS.green : COLORS.card, color: mine ? 'white' : COLORS.text,
        padding: '10px 14px', borderRadius: '14px', fontSize: '13px', lineHeight: 1.5,
        opacity: muted ? 0.6 : 1, boxShadow: mine ? 'none' : '0 1px 4px rgba(0,0,0,0.05)',
        border: mine ? 'none' : `1px solid ${COLORS.border}`,
      }}>
        {text}
      </div>
    </div>
  )
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px',
      background: COLORS.card, boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      <div onClick={onBack} style={{ cursor: 'pointer', display: 'flex' }}>
        <Icon name="arrowLeft" size={22} color={COLORS.text} />
      </div>
      <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>FarmBot</p>
    </div>
  )
}
