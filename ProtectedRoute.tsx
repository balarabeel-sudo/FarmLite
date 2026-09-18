import { Navigate } from 'react-router-dom'
import { ReactNode } from 'react'
import { useAuth } from './AuthContext'

const COLORS = { bg: '#F8FAF6', green: '#16A34A' }

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()

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

  return <>{children}</>
}
