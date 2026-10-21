import { Navigate } from 'react-router-dom'
import { ReactNode } from 'react'
import { useAuth } from './AuthContext'

const COLORS = { bg: 'var(--fx-bg)', green: '#16A34A' }

// allowPending: the "choose your username" page itself, which new accounts must pass through first.
export default function ProtectedRoute({ children, allowPending = false }: { children: ReactNode; allowPending?: boolean }) {
  const { session, user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: COLORS.green, fontWeight: 700, fontSize: '14px' }}>Loading...</p>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  // A new account first picks its username (and can keep the one it was given)
  if (!allowPending && (user?.user_metadata as Record<string, unknown> | undefined)?.username_pending === true) {
    return <Navigate to="/choose-username" replace />
  }

  return <>{children}</>
}
