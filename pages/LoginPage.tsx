import { useState, FormEvent } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Icon from '../Icons'
import {
  AUTH, AuthPage, AuthHero, AuthCard, ErrorBox, OrDivider, SocialRow,
  authInputWrap, authInput, authLabel, authPrimaryButton,
} from '../AuthShared'

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
      setError('Please enter your email and password.')
      return
    }

    setLoading(true)
    // Signs in with email. Phone sign-in would need phone auth enabled in Supabase Auth settings.
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
    <AuthPage>
      <AuthHero title="Welcome back" subtitle="Sign in to your Farmxie account and continue your agricultural journey." />

      <AuthCard>
        <form onSubmit={handleSubmit}>
          <ErrorBox message={error} />

          <label style={authLabel}>Email</label>
          <div style={authInputWrap}>
            <span style={{ marginRight: '10px', display: 'flex' }}><Icon name="mail" size={18} color={AUTH.greenMid} /></span>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="you@example.com"
              autoComplete="username"
              style={authInput}
            />
          </div>

          <label style={authLabel}>Password</label>
          <div style={authInputWrap}>
            <span style={{ marginRight: '10px', display: 'flex' }}><Icon name="lock" size={18} color={AUTH.greenMid} /></span>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              autoComplete="current-password"
              style={authInput}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', padding: '6px' }}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <Icon name={showPassword ? 'eyeOff' : 'eye'} size={18} color={AUTH.textMuted} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '2px 2px 20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: AUTH.text, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: AUTH.green }}
              />
              Remember me
            </label>
            <Link to="/forgot-password" style={{ fontSize: '13px', color: AUTH.green, fontWeight: 700, textDecoration: 'none' }}>
              Forgot password?
            </Link>
          </div>

          <button type="submit" disabled={loading} style={authPrimaryButton(loading)}>
            {loading ? 'Signing in...' : 'Sign In'}
            {!loading && <Icon name="arrowRight" size={18} color="#FFFFFF" />}
          </button>
        </form>

        <OrDivider text="Or continue with" />
        <SocialRow onError={setError} />
      </AuthCard>

      <p style={{ textAlign: 'center', fontSize: '13.5px', color: AUTH.textMuted, marginTop: '22px' }}>
        Don't have an account?{' '}
        <Link to="/register" style={{ color: AUTH.green, fontWeight: 800, textDecoration: 'none' }}>
          Sign Up
        </Link>
      </p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '18px' }}>
        <Icon name="leaf" size={16} color={AUTH.green} />
        <p style={{ fontSize: '12px', color: AUTH.textMuted, fontWeight: 600 }}>Better Farms &nbsp;•&nbsp; A Brighter Future</p>
      </div>
    </AuthPage>
  )
}
