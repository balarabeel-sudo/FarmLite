import { useState, FormEvent } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const COLORS = {
  bg: '#F8FAF6',
  card: '#FFFFFF',
  border: '#DCE7DC',
  green: '#16A34A',
  greenDark: '#166534',
  orange: '#F59E0B',
  text: '#1A2E1A',
  textMuted: '#5B6B5B',
  red: '#DC2626',
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation() as any

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email.trim() || !password) {
      setError('Please enter your email and password.')
      return
    }

    setLoading(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setLoading(false)

    if (signInError) {
      setError(signInError.message || 'Could not sign in. Please check your details and try again.')
      return
    }

    const redirectTo = location.state?.from?.pathname || '/'
    navigate(redirectTo, { replace: true })
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.greenDark})`, padding: '48px 24px 32px', color: 'white' }}>
        <p style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '0.3px' }}>🌱 FarmLite</p>
        <h1 style={{ fontSize: '24px', fontWeight: 800, marginTop: '18px' }}>Welcome back</h1>
        <p style={{ fontSize: '13px', color: '#DCFCE7', marginTop: '6px' }}>Sign in to grow your farm and business.</p>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: '24px', flex: 1 }}>
        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '10px 12px', marginBottom: '14px' }}>
            <p style={{ fontSize: '12px', color: COLORS.red }}>{error}</p>
          </div>
        )}

        <label style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text }}>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          style={inputStyle}
        />

        <label style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text }}>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your password"
          autoComplete="current-password"
          style={inputStyle}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%', border: 'none', background: COLORS.green, color: 'white', fontWeight: 700, fontSize: '14px',
            padding: '13px', borderRadius: '12px', marginTop: '10px', cursor: 'pointer', opacity: loading ? 0.6 : 1,
          }}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <p style={{ textAlign: 'center', fontSize: '13px', color: COLORS.textMuted, marginTop: '20px' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: COLORS.green, fontWeight: 700, textDecoration: 'none' }}>
            Create one
          </Link>
        </p>
      </form>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: '12px', border: `1px solid ${COLORS.border}`,
  marginTop: '6px', marginBottom: '16px', fontSize: '14px', boxSizing: 'border-box', background: COLORS.card, color: COLORS.text,
}
