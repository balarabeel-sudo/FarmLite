import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { loadStaffSession, type StaffSession } from './adminAuth'
import { AdminStaffContext } from './AdminStaffContext'

// Gate for every /admin/* page's content. Nest this INSIDE the app's normal
// <ProtectedRoute> (which already guarantees a signed-in user) and it adds a
// real, DB-backed staff + permission check on top - not a client-side flag.
// A signed-in user who is not active staff sees nothing admin-related at all.
export default function AdminProtectedRoute({ children, requirePermission }: { children: ReactNode; requirePermission?: string }) {
  const { user } = useAuth()
  const [session, setSession] = useState<StaffSession | null | 'loading'>('loading')

  useEffect(() => {
    if (!user) {
      setSession(null)
      return
    }
    let alive = true
    loadStaffSession().then((s) => { if (alive) setSession(s) })
    return () => { alive = false }
  }, [user])

  if (session === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5B6B5B', fontSize: '14px' }}>
        Loading admin console...
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/" replace />
  }

  if (requirePermission && !session.permissions.has(requirePermission)) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px' }}>
        <p style={{ fontSize: '15px', fontWeight: 700, color: '#1A2E1A' }}>You don't have access to this page.</p>
        <p style={{ fontSize: '13px', color: '#5B6B5B' }}>Your role ({session.roleName}) doesn't include this permission.</p>
      </div>
    )
  }

  return <AdminStaffContext.Provider value={session}>{children}</AdminStaffContext.Provider>
}
