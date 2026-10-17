import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Icon from '../Icons'
import {
  AUTH, AuthPage, BrandHeader, PageTitle, ErrorBox, OrDivider, GoogleButton,
  AuthField, PasswordField, authPrimaryButton, authLinkStyle,
} from '../AuthShared'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation() as any

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    const email = identifier.trim()
    if (!email || !password) {
      setError('Please enter your email and password.')
      return
    }
    if (!email.includes('@')) {
      setError('Please sign in with your email address.')
      return
    }

    setLoading(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
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
      <BrandHeader />
      <PageTitle title="Welcome Back" subtitle="Sign in to your FarmXie account" />

      <form onSubmit={handleSubmit}>
        <ErrorBox message={error} />

        <AuthField
          icon="mail"
          type="email"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="Email Address"
          autoComplete="username"
          autoCapitalize="none"
        />

        <PasswordField
          show={showPassword}
          onToggle={() => setShowPassword((v) => !v)}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          marginBottom={10}
        />

        <div style={{ textAlign: 'right', margin: '0 2px 26px' }}>
          <Link to="/forgot-password" style={{ fontSize: '14px', ...authLinkStyle }}>Forgot password?</Link>
        </div>

        <button type="submit" disabled={loading} style={authPrimaryButton(loading)}>
          {loading ? 'Signing in...' : 'Sign In'}
          {!loading && <Icon name="arrowRight" size={20} color="#FFFFFF" />}
        </button>
      </form>

      <OrDivider text="or continue with" />
      <GoogleButton label="Continue with Google" onError={setError} />

      <p style={{ textAlign: 'center', fontSize: '14.5px', color: AUTH.text, marginTop: '44px' }}>
        Don't have an account?{' '}
        <Link to="/register" style={authLinkStyle}>Sign Up</Link>
      </p>
    </AuthPage>
  )
}
