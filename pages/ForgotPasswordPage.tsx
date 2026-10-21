import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Icon from '../Icons'
import { AUTH, AuthPage, BrandHeader, PageTitle, BackButton, ErrorBox, AuthField, authPrimaryButton, authLinkStyle } from '../AuthShared'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email.trim() || !email.includes('@')) { setError('Enter the email address of your account.'); return }
    setLoading(true)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` })
    setLoading(false)
    if (resetError) { setError(resetError.message || 'Could not send the email. Please try again.'); return }
    setSent(true)
  }

  return (
    <AuthPage>
      <BackButton onClick={() => navigate('/login')} />
      <BrandHeader compact />
      {sent ? (
        <div style={{ textAlign: 'center', paddingTop: '40px' }}>
          <div style={{ width: '88px', height: '88px', borderRadius: '50%', background: 'var(--fx-tint-green)', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="mail" size={40} color={AUTH.green} />
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: AUTH.greenDark, marginTop: '22px' }}>Check your email</h1>
          <p style={{ fontSize: '15px', color: AUTH.textMuted, marginTop: '10px', lineHeight: 1.6 }}>
            If <strong style={{ color: AUTH.text }}>{email.trim()}</strong> has an account, we sent a link to set a new password.
          </p>
          <Link to="/login" style={{ ...authPrimaryButton(false), display: 'inline-flex', width: 'auto', padding: '0 38px', marginTop: '26px', textDecoration: 'none' }}>Back to Sign In</Link>
        </div>
      ) : (
        <>
          <PageTitle title="Forgot password?" subtitle="Enter your email and we will send you a link to set a new one." />
          <form onSubmit={submit}>
            <ErrorBox message={error} />
            <AuthField icon="mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email Address" autoComplete="email" autoCapitalize="none" marginBottom={22} />
            <button type="submit" disabled={loading} style={authPrimaryButton(loading)}>
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
          <p style={{ textAlign: 'center', fontSize: '14.5px', color: AUTH.text, marginTop: '30px' }}>
            Remembered it? <Link to="/login" style={authLinkStyle}>Sign In</Link>
          </p>
        </>
      )}
    </AuthPage>
  )
}
