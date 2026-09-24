import { useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { useStaff } from './AdminStaffContext'

// FarmLite Admin's own design language: desktop-first, data-dense, professional -
// deliberately NOT the mobile app's card-and-icon look. Only the green accent carries over.
const A = {
  bg: '#F7F8F7',
  surface: '#FFFFFF',
  border: '#E3E7E3',
  green: '#16A34A',
  greenDark: '#14532D',
  text: '#0F1A0F',
  textMuted: '#6B7280',
  sidebarBg: '#0F1A12',
  sidebarText: '#C9D6CC',
  sidebarActive: '#16A34A',
  red: '#DC2626',
}

type NavItem = { label: string; path: string; permission?: string }
type NavGroup = { title?: string; items: NavItem[] }

const NAV: NavGroup[] = [
  { items: [{ label: 'Overview', path: '/admin' }] },
  {
    title: 'Platform',
    items: [
      { label: 'Users', path: '/admin/users', permission: 'users.view' },
      { label: 'Companies', path: '/admin/companies', permission: 'companies.view' },
      { label: 'Marketplace', path: '/admin/marketplace', permission: 'marketplace.view' },
      { label: 'Community', path: '/admin/community', permission: 'community.view' },
      { label: 'Groups', path: '/admin/groups', permission: 'groups.view' },
      { label: 'Equipment', path: '/admin/equipment', permission: 'equipment.view' },
      { label: 'FarmBot', path: '/admin/farmbot', permission: 'farmbot.view_analytics' },
      { label: 'Trade Desk', path: '/admin/trade-desk', permission: 'trade_desk.view' },
    ],
  },
  {
    title: 'Moderation',
    items: [
      { label: 'Reports', path: '/admin/reports', permission: 'reports.view' },
      { label: 'Verification', path: '/admin/verification', permission: 'companies.verify' },
    ],
  },
  {
    title: 'Management',
    items: [
      { label: 'Staff', path: '/admin/staff', permission: 'staff.view' },
      { label: 'Roles & Permissions', path: '/admin/roles', permission: 'roles.view' },
      { label: 'Analytics', path: '/admin/analytics', permission: 'analytics.view' },
      { label: 'Audit Logs', path: '/admin/audit-logs', permission: 'audit_logs.view' },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Notifications', path: '/admin/notifications' },
      { label: 'Settings', path: '/admin/settings', permission: 'settings.view' },
    ],
  },
]

export default function AdminLayout({ children, title }: { children: ReactNode; title: string }) {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const staff = useStaff()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  const visibleGroups = NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.permission || staff.permissions.has(i.permission)),
  })).filter((g) => g.items.length > 0)

  return (
    <div style={{ minHeight: '100vh', background: A.bg, display: 'flex' }}>
      <style>{`
        .admin-menu-btn { display: none; }
        @media (max-width: 900px) {
          .admin-sidebar { position: fixed; left: 0; top: 0; bottom: 0; transform: translateX(-100%); transition: transform .2s ease; z-index: 40; }
          .admin-sidebar.open { transform: translateX(0); }
          .admin-main { margin-left: 0 !important; }
          .admin-menu-btn { display: block; }
        }
      `}</style>

      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 35 }} />
      )}

      <aside className={`admin-sidebar${sidebarOpen ? ' open' : ''}`} style={{ width: '250px', background: A.sidebarBg, color: A.sidebarText, flexShrink: 0, display: 'flex', flexDirection: 'column', padding: '20px 0' }}>
        <div style={{ padding: '0 20px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '17px' }}>🌱</span>
          <span style={{ fontSize: '15px', fontWeight: 800, color: 'white' }}>FarmLite Admin</span>
        </div>

        <nav style={{ flex: 1, overflowY: 'auto', padding: '0 12px' }}>
          {visibleGroups.map((group, gi) => (
            <div key={gi} style={{ marginBottom: '18px' }}>
              {group.title && (
                <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#6B7A6D', padding: '0 10px', marginBottom: '6px' }}>
                  {group.title}
                </p>
              )}
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/admin'}
                  onClick={() => setSidebarOpen(false)}
                  style={({ isActive }) => ({
                    display: 'block', padding: '9px 10px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                    color: isActive ? 'white' : A.sidebarText,
                    background: isActive ? A.sidebarActive : 'transparent',
                    textDecoration: 'none', marginBottom: '2px',
                  })}>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div style={{ borderTop: '1px solid #1F2E22', padding: '14px 20px 0', marginTop: '10px' }}>
          <p style={{ fontSize: '12.5px', fontWeight: 700, color: 'white' }}>{staff.fullName}</p>
          <p style={{ fontSize: '11px', color: '#8AA08D', marginTop: '2px' }}>{staff.roleName}</p>
          <div onClick={handleSignOut} style={{ marginTop: '10px', fontSize: '12px', fontWeight: 700, color: '#F87171', cursor: 'pointer' }}>
            Sign out
          </div>
        </div>
      </aside>

      <main className="admin-main" style={{ flex: 1, minWidth: 0 }}>
        <div style={{ background: A.surface, borderBottom: `1px solid ${A.border}`, padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '14px', position: 'sticky', top: 0, zIndex: 10 }}>
          <div onClick={() => setSidebarOpen(true)} className="admin-menu-btn" style={{ cursor: 'pointer', fontSize: '18px' }}>☰</div>
          <h1 style={{ fontSize: '18px', fontWeight: 800, color: A.text, flex: 1 }}>{title}</h1>
          <div style={{ fontSize: '12px', color: A.textMuted }}>{staff.roleName}</div>
        </div>
        <div style={{ padding: '24px' }}>{children}</div>
      </main>
    </div>
  )
}
