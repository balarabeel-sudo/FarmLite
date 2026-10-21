// Left menu for computers and wide tablets (like X and Facebook). On phones it is hidden by CSS (see index.html).
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import Icon from './Icons'
import FarmLiteLogo from './FarmLiteLogo'
import { COLORS } from './shared'

const ITEMS = [
  { icon: 'home', label: 'Home', path: '/' },
  { icon: 'cart', label: 'Market', path: '/marketplace' },
  { icon: 'tractor', label: 'Equipment', path: '/equipment' },
  { icon: 'camera', label: 'Videos', path: '/videos' },
  { icon: 'users', label: 'Groups', path: '/communities' },
  { icon: 'building', label: 'Companies', path: '/companies' },
  { icon: 'message', label: 'Messages', path: '/messages' },
  { icon: 'robot', label: 'FarmBot', path: '/farmbot' },
  { icon: 'bell', label: 'Notifications', path: '/notifications' },
  { icon: 'user', label: 'Account', path: '/profile' },
]

// Pages that have their own full layout, or are shown before sign-in.
const HIDDEN = ['/admin', '/company', '/login', '/register', '/forgot-password', '/reset-password', '/choose-username', '/terms', '/privacy', '/staff-invite']

export default function DesktopSidebar() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  if (!user) return null
  if (HIDDEN.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null

  const active = (path: string) => (path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`))

  return (
    <nav className="fx-side" aria-label="Main menu" style={{ flexDirection: 'column', gap: '4px', padding: '14px 8px', background: 'transparent', zIndex: 5 }}>
      <div onClick={() => navigate('/')} style={{ padding: '4px 10px 12px', cursor: 'pointer' }}>
        <FarmLiteLogo size={36} />
      </div>
      {ITEMS.map((it) => {
        const on = active(it.path)
        return (
          <div
            key={it.path}
            role="link"
            tabIndex={0}
            onClick={() => navigate(it.path)}
            onKeyDown={(e) => { if (e.key === 'Enter') navigate(it.path) }}
            title={it.label}
            style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '11px 12px', borderRadius: '999px', cursor: 'pointer', background: on ? COLORS.card : 'transparent' }}>
            <Icon name={it.icon} size={23} color={on ? COLORS.green : COLORS.text} />
            <span className="fx-side-label" style={{ fontSize: '16px', fontWeight: on ? 800 : 600, color: on ? COLORS.green : COLORS.text }}>{it.label}</span>
          </div>
        )
      })}
      <div
        role="button"
        tabIndex={0}
        onClick={() => navigate('/create')}
        onKeyDown={(e) => { if (e.key === 'Enter') navigate('/create') }}
        title="Post"
        style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '13px 12px', borderRadius: '999px', background: COLORS.green, color: 'white', cursor: 'pointer', fontWeight: 800, fontSize: '15px' }}>
        <Icon name="plus" size={20} color="white" />
        <span className="fx-side-label">Post</span>
      </div>
    </nav>
  )
}
