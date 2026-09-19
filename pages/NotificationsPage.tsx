import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

type Notification = {
  id: string
  category: 'message' | 'like' | 'comment' | 'follow' | 'marketplace' | 'general'
  title: string
  body: string | null
  is_read: boolean
  created_at: string
}

const CATEGORY_ICON: Record<string, string> = {
  message: 'message',
  like: 'heart',
  comment: 'comment',
  follow: 'users',
  marketplace: 'cart',
  general: 'bell',
}

export default function NotificationsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])

  const load = async () => {
    if (!user) return
    setNetError(false)
    setLoading(true)

    const { data, error } = await supabase
      .from('notifications')
      .select('id, category, title, body, is_read, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      setNetError(true)
      setLoading(false)
      return
    }

    setNotifications((data || []) as any)
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  const markRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n))
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
  }

  const markAllRead = async () => {
    if (!user) return
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false)
  }

  const hasUnread = notifications.some((n) => !n.is_read)

  if (netError) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <Header onBack={() => navigate('/')} onMarkAllRead={markAllRead} hasUnread={false} />
        <NetworkError onRetry={load} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '30px' }}>
      <Header onBack={() => navigate('/')} onMarkAllRead={markAllRead} hasUnread={hasUnread} />

      <div style={{ padding: '16px' }}>
        {loading ? (
          <ListCardSkeleton count={5} />
        ) : notifications.length === 0 ? (
          <div style={{ background: COLORS.card, padding: '40px 20px', textAlign: 'center', borderRadius: '14px' }}>
            <Icon name="bell" size={28} color={COLORS.textMuted} />
            <p style={{ fontSize: '13px', color: COLORS.textMuted, marginTop: '12px' }}>No notifications yet.</p>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.is_read && markRead(n.id)}
              style={{
                background: n.is_read ? COLORS.card : '#F0FDF4', borderRadius: '14px', padding: '13px', marginBottom: '10px',
                display: 'flex', gap: '12px', cursor: n.is_read ? 'default' : 'pointer',
                border: n.is_read ? 'none' : `1px solid #BBF7D0`,
              }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '19px', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={CATEGORY_ICON[n.category] || 'bell'} size={17} color={COLORS.green} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>{n.title}</p>
                {n.body && <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '3px', lineHeight: 1.4 }}>{n.body}</p>}
                <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginTop: '5px' }}>{timeAgo(n.created_at)}</p>
              </div>
              {!n.is_read && <div style={{ width: '8px', height: '8px', borderRadius: '4px', background: COLORS.orange, marginTop: '4px', flexShrink: 0 }} />}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function Header({ onBack, onMarkAllRead, hasUnread }: { onBack: () => void; onMarkAllRead: () => void; hasUnread: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px',
      background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div onClick={onBack} style={{ cursor: 'pointer', display: 'flex' }}>
          <Icon name="arrowLeft" size={22} color={COLORS.text} />
        </div>
        <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>Notifications</p>
      </div>
      {hasUnread && (
        <div onClick={onMarkAllRead} style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.green, cursor: 'pointer' }}>
          Mark all read
        </div>
      )}
    </div>
  )
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
