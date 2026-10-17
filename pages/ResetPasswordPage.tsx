import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import { AUTH, AuthPage, BrandHeader, PageTitle, ErrorBox, PasswordField, authPrimaryButton, authLinkStyle } from '../AuthShared'

// Opened from the link in the "reset your password" email. The link signs the person in for a moment,
// so a new password can be saved.
export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setError('The two passwords do not match.'); return }
    setSaving(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (updateError) { setError(updateError.message || 'Could not save the new password. Please try again.'); return }
    navigate('/', { replace: true })
  }

  return (
    <AuthPage>
      <BrandHeader compact />
      <PageTitle title="New password" subtitle="Choose a new password for your account." />
      {authLoading ? (
        <p style={{ textAlign: 'center', color: AUTH.textMuted, fontSize: '14px' }}>Loading...</p>
      ) : !user ? (
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '14.5px', color: AUTH.textMuted, lineHeight: 1.6 }}>This link has expired or was already used. Ask for a new one.</p>
          <Link to="/forgot-password" style={{ ...authPrimaryButton(false), display: 'inline-flex', width: 'auto', padding: '0 34px', marginTop: '22px', textDecoration: 'none' }}>Get a new link</Link>
          <p style={{ marginTop: '22px', fontSize: '14px' }}><Link to="/login" style={authLinkStyle}>Back to Sign In</Link></p>
        </div>
      ) : (
        <form onSubmit={submit}>
          <ErrorBox message={error} />
          <PasswordField show={show} onToggle={() => setShow((v) => !v)} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New Password" autoComplete="new-password" />
          <PasswordField show={show} onToggle={() => setShow((v) => !v)} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm New Password" autoComplete="new-password" marginBottom={22} />
          <button type="submit" disabled={saving} style={authPrimaryButton(saving)}>{saving ? 'Saving...' : 'Save new password'}</button>
        </form>
      )}
    </AuthPage>
  )
}
