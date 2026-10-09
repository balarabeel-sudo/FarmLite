import { useState, FormEvent, CSSProperties } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import FarmLiteLogo from '../FarmLiteLogo'
import Icon from '../Icons'

const COLORS = {
  bg: '#F8FAF6',
  pill: '#E7F0E4',
  green: '#16A34A',
  greenDark: '#166534',
  text: '#1A2E1A',
  textMuted: '#5B6B5B',
  red: '#DC2626',
  white: '#FFFFFF',
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation() as any

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!identifier.trim() || !password) {
      setError('Please enter your email/phone and password.')
      return
    }

    setLoading(true)
    // NOTE: this signs in with email. If you want people to also sign in
    // with a phone number, phone auth needs to be enabled in Supabase Auth
    // settings separately — ask if you want that wired up.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: identifier.trim(),
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
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', position: 'relative', overflow: 'hidden' }}>
      <div style={{ padding: '48px 24px 160px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <FarmLiteLogo size={72} />
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: COLORS.greenDark, marginTop: '10px' }}>Farmxie</h1>
          <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '2px' }}>
            Connecting Farmers &nbsp;•&nbsp; Growing Together
          </p>
        </div>

        <h2 style={{ fontSize: '26px', fontWeight: 800, color: COLORS.text, marginTop: '32px' }}>Welcome Back</h2>
        <p style={{ fontSize: '14px', color: COLORS.textMuted, marginTop: '6px', lineHeight: 1.4 }}>
          Sign in to your Farmxie account and continue your agricultural journey.
        </p>

        <form onSubmit={handleSubmit} style={{ marginTop: '24px' }}>
          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '10px 12px', marginBottom: '14px' }}>
              <p style={{ fontSize: '12px', color: COLORS.red }}>{error}</p>
            </div>
          )}

          <div style={pillWrap}>
            <span style={pillIcon}><Icon name="user" size={18} color={COLORS.greenDark} /></span>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Email or Phone Number"
              autoComplete="username"
              style={pillInput}
            />
          </div>

          <div style={pillWrap}>
            <span style={pillIcon}><Icon name="lock" size={18} color={COLORS.greenDark} /></span>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              style={{ ...pillInput, paddingRight: '36px' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              style={eyeButton}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <Icon name={showPassword ? 'eyeOff' : 'eye'} size={17} color={COLORS.textMuted} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 2px 20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: COLORS.text, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: COLORS.green }}
              />
              Remember me
            </label>
            <Link to="/forgot-password" style={{ fontSize: '13px', color: COLORS.green, fontWeight: 700, textDecoration: 'none' }}>
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', border: 'none', background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.greenDark})`,
              color: 'white', fontWeight: 700, fontSize: '15px', padding: '15px', borderRadius: '999px',
              cursor: 'pointer', opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'} {!loading && '→'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '22px 0' }}>
            <div style={{ flex: 1, height: '1px', background: '#DCE7DC' }} />
            <span style={{ fontSize: '12px', color: COLORS.textMuted }}>Or continue with</span>
            <div style={{ flex: 1, height: '1px', background: '#DCE7DC' }} />
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button type="button" style={socialButton}>
              Google
            </button>
            <button type="button" style={socialButton}>
              Apple
            </button>
          </div>

          <p style={{ textAlign: 'center', fontSize: '13px', color: COLORS.textMuted, marginTop: '22px' }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: COLORS.green, fontWeight: 700, textDecoration: 'none' }}>
              Sign Up
            </Link>
          </p>
        </form>
      </div>

      {/* Bottom decorative banner */}
      <div
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height: '110px',
          background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.greenDark})`,
          borderTopLeftRadius: '60% 40px', borderTopRightRadius: '60% 40px',
          display: 'flex', alignItems: 'center', gap: '10px', padding: '0 24px',
        }}
      >
        <Icon name="leaf" size={22} color="#FFFFFF" />
        <div>
          <p style={{ color: 'white', fontSize: '13px', fontWeight: 700, lineHeight: 1.3 }}>Better Farms</p>
          <p style={{ color: '#DCFCE7', fontSize: '13px', fontWeight: 700, lineHeight: 1.3 }}>A Brighter Future</p>
        </div>
      </div>
    </div>
  )
}

const pillWrap: CSSProperties = {
  display: 'flex', alignItems: 'center', position: 'relative',
  background: COLORS.pill, borderRadius: '16px', padding: '4px 14px', marginBottom: '14px',
}

const pillIcon: CSSProperties = { fontSize: '15px', marginRight: '10px' }

const pillInput: CSSProperties = {
  flex: 1, border: 'none', background: 'transparent', outline: 'none',
  padding: '13px 0', fontSize: '14px', color: COLORS.text,
}

const eyeButton: CSSProperties = {
  position: 'absolute', right: '10px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '15px',
}

const socialButton: CSSProperties = {
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
  border: '1px solid #DCE7DC', background: COLORS.white, borderRadius: '14px', padding: '12px',
  fontSize: '14px', fontWeight: 600, color: COLORS.text, cursor: 'pointer',
}
