import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import Icon from '../Icons'
import { ListCardSkeleton } from '../LoadingSkeleton'
import NetworkError from '../NetworkError'
import { enablePush, getPushState } from '../pushShared'
import type { PushState } from '../pushShared'

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
  category: 'message' | 'like' | 'comment' | 'follow' | 'marketplace' | 'general' | 'farm_desk' | 'activity'
  title: string
  body: string | null
  link: string | null
  is_read: boolean
  created_at: string
}

const CATEGORY_ICON: Record<string, string> = {
  message: 'message',
  like: 'heart',
  comment: 'comment',
  follow: 'users',
  activity: 'share',
  marketplace: 'cart',
  general: 'bell',
  farm_desk: 'leaf',
}

export default function NotificationsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [pushState, setPushState] = useState<PushState | null>(null)
  const [enabling, setEnabling] = useState(false)

  const load = async () => {
    if (!user) return
    setNetError(false)
    setLoading(true)

    const { data, error } = await supabase
      .from('notifications')
      .select('id, category, title, body, link, is_read, created_at')
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
  useEffect(() => { getPushState().then(setPushState) }, [])

  const turnOnPush = async () => {
    setEnabling(true)
    const res = await enablePush()
    setPushState(res.state)
    setEnabling(false)
  }

  const markRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n))
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
  }

  const markAllRead = async () => {
    if (!user) return
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false)
  }

  const openNotification = (n: Notification) => {
    if (!n.is_read) markRead(n.id)
    // Only follow in-app links (e.g. /farm-desk/<id>).
    if (n.link && n.link.startsWith('/')) navigate(n.link)
  }

  const hasUnread = notifications.some((n) => !n.is_read)

  if (netError) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <Header onBack={() => navigate('/')} onSettings={() => navigate('/settings/notifications')} onMarkAllRead={markAllRead} hasUnread={false} />
        <NetworkError onRetry={load} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '30px' }}>
      <Header onBack={() => navigate('/')} onSettings={() => navigate('/settings/notifications')} onMarkAllRead={markAllRead} hasUnread={hasUnread} />

      <div style={{ padding: '16px' }}>
        {(pushState === 'off' || pushState === 'ios-install') && (
          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '14px', padding: '13px', marginBottom: '12px' }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>Get alerts even when Farmxie is closed</p>
            <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '3px', lineHeight: 1.4 }}>
              {pushState === 'off'
                ? 'Turn on push notifications for messages, orders, payments and more.'
                : 'On iPhone, add Farmxie to your Home Screen first, then turn on notifications from the settings icon above.'}
            </p>
            {pushState === 'off' && (
              <div
                onClick={enabling ? undefined : turnOnPush}
                style={{ marginTop: '10px', background: COLORS.green, color: '#fff', fontSize: '12.5px', fontWeight: 700, borderRadius: '10px', padding: '9px 14px', display: 'inline-block', cursor: 'pointer', opacity: enabling ? 0.7 : 1 }}>
                {enabling ? 'Please wait...' : 'Turn on'}
              </div>
            )}
          </div>
        )}
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
              onClick={() => openNotification(n)}
              style={{
                background: n.is_read ? COLORS.card : '#F0FDF4', borderRadius: '14px', padding: '13px', marginBottom: '10px',
                display: 'flex', gap: '12px', cursor: n.is_read && !n.link ? 'default' : 'pointer',
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

function Header({ onBack, onSettings, onMarkAllRead, hasUnread }: { onBack: () => void; onSettings: () => void; onMarkAllRead: () => void; hasUnread: boolean }) {
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {hasUnread && (
          <div onClick={onMarkAllRead} style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.green, cursor: 'pointer' }}>
            Mark all read
          </div>
        )}
        <div onClick={onSettings} style={{ cursor: 'pointer', display: 'flex' }} aria-label="Notification settings">
          <Icon name="wrench" size={19} color={COLORS.text} />
        </div>
      </div>
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
