import { useState, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Icon from '../Icons'
import {
  AUTH, AuthPage, AuthHero, AuthCard, ErrorBox, OrDivider, SocialRow,
  authInputWrap, authInput, authLabel, authPrimaryButton,
} from '../AuthShared'

const ROLES: { value: string; label: string; hint: string; icon: string }[] = [
  { value: 'farmer', label: 'Farmer', hint: 'Sell produce', icon: 'tractor' },
  { value: 'buyer', label: 'Buyer', hint: 'Buy produce', icon: 'cart' },
  { value: 'agribusiness', label: 'Agribusiness', hint: 'Run a business', icon: 'building' },
]

const cleanUsername = (v: string) => v.toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 24)

function passwordStrength(p: string): { score: number; label: string; color: string } {
  if (!p) return { score: 0, label: '', color: '#DCE7DC' }
  let score = 0
  if (p.length >= 6) score++
  if (p.length >= 9) score++
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) score++
  if (p.length < 6) return { score: 1, label: 'Too short', color: '#DC2626' }
  if (score <= 1) return { score: 2, label: 'Fair', color: '#F59E0B' }
  if (score === 2) return { score: 3, label: 'Good', color: '#65A30D' }
  return { score: 4, label: 'Strong', color: '#16A34A' }
}

export default function RegisterPage() {
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [usernameEdited, setUsernameEdited] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState('farmer')
  const [agree, setAgree] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checkEmail, setCheckEmail] = useState(false)

  const strength = passwordStrength(password)

  const onNameChange = (v: string) => {
    setFullName(v)
    // Suggest a username from the name until the person types their own.
    if (!usernameEdited) setUsername(cleanUsername(v.replace(/\s+/g, '')))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!fullName.trim() || !username.trim() || !email.trim() || !password) {
      setError('Please fill in every field.')
      return
    }
    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (!agree) {
      setError('Please accept the terms to create your account.')
      return
    }

    setLoading(true)

    // full_name/username/role are read by the "handle_new_user" database
    // trigger, which creates the matching row in "profiles" automatically.
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          username: username.trim(),
          role,
        },
      },
    })

    setLoading(false)

    if (signUpError) {
      setError(signUpError.message || 'Could not create your account. Please try again.')
      return
    }

    if (data.session) {
      navigate('/', { replace: true })
    } else {
      // Email confirmation is required before a session is issued.
      setCheckEmail(true)
    }
  }

  if (checkEmail) {
    return (
      <AuthPage>
        <div style={{ padding: '90px 24px 0', textAlign: 'center' }}>
          <div style={{ width: '84px', height: '84px', borderRadius: '50%', background: '#DCFCE7', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="mail" size={38} color={AUTH.greenMid} />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: AUTH.text, marginTop: '22px' }}>Check your email</h1>
          <p style={{ fontSize: '14px', color: AUTH.textMuted, marginTop: '10px', lineHeight: 1.6 }}>
            We sent a confirmation link to <strong style={{ color: AUTH.text }}>{email}</strong>. Confirm it, then sign in to start using Farmxie.
          </p>
          <Link
            to="/login"
            style={{ ...authPrimaryButton(false), display: 'inline-flex', width: 'auto', padding: '14px 34px', marginTop: '26px', textDecoration: 'none' }}
          >
            Go to Sign In
          </Link>
        </div>
      </AuthPage>
    )
  }

  return (
    <AuthPage>
      <AuthHero title="Create your account" subtitle="Join farmers, buyers and agribusinesses growing together on Farmxie." />

      <AuthCard>
        <form onSubmit={handleSubmit}>
          <ErrorBox message={error} />

          <label style={authLabel}>I am a...</label>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            {ROLES.map((r) => {
              const on = role === r.value
              return (
                <div
                  key={r.value}
                  onClick={() => setRole(r.value)}
                  style={{
                    flex: 1, textAlign: 'center', padding: '12px 4px 10px', borderRadius: '14px', cursor: 'pointer',
                    background: on ? '#ECFDF3' : AUTH.card,
                    border: `1.5px solid ${on ? AUTH.green : AUTH.fieldBorder}`,
                    boxShadow: on ? '0 4px 12px rgba(22,163,74,0.15)' : 'none',
                  }}
                >
                  <span style={{ display: 'inline-flex' }}><Icon name={r.icon} size={22} color={on ? AUTH.green : AUTH.textMuted} /></span>
                  <p style={{ fontSize: '12.5px', fontWeight: 800, color: on ? AUTH.greenMid : AUTH.text, marginTop: '4px' }}>{r.label}</p>
                  <p style={{ fontSize: '10.5px', color: AUTH.textMuted, marginTop: '1px' }}>{r.hint}</p>
                </div>
              )
            })}
          </div>

          <label style={authLabel}>Full name</label>
          <div style={authInputWrap}>
            <span style={{ marginRight: '10px', display: 'flex' }}><Icon name="user" size={18} color={AUTH.greenMid} /></span>
            <input value={fullName} onChange={(e) => onNameChange(e.target.value)} placeholder="e.g. Rabeel Bala" autoComplete="name" style={authInput} />
          </div>

          <label style={authLabel}>Username</label>
          <div style={authInputWrap}>
            <span style={{ marginRight: '8px', fontSize: '16px', fontWeight: 800, color: AUTH.greenMid }}>@</span>
            <input
              value={username}
              onChange={(e) => { setUsernameEdited(true); setUsername(cleanUsername(e.target.value)) }}
              placeholder="rabeelbala"
              autoComplete="username"
              autoCapitalize="none"
              style={authInput}
            />
          </div>

          <label style={authLabel}>Email</label>
          <div style={authInputWrap}>
            <span style={{ marginRight: '10px', display: 'flex' }}><Icon name="mail" size={18} color={AUTH.greenMid} /></span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" style={authInput} />
          </div>

          <label style={authLabel}>Password</label>
          <div style={{ ...authInputWrap, marginBottom: '8px' }}>
            <span style={{ marginRight: '10px', display: 'flex' }}><Icon name="lock" size={18} color={AUTH.greenMid} /></span>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              autoComplete="new-password"
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '0 2px 16px', minHeight: '16px' }}>
            <div style={{ flex: 1, display: 'flex', gap: '4px' }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} style={{ flex: 1, height: '4px', borderRadius: '999px', background: i <= strength.score ? strength.color : '#DCE7DC' }} />
              ))}
            </div>
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: strength.color, minWidth: '56px', textAlign: 'right' }}>{strength.label}</span>
          </div>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '9px', fontSize: '12.5px', color: AUTH.textMuted, lineHeight: 1.45, cursor: 'pointer', marginBottom: '18px' }}>
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: AUTH.green, marginTop: '1px', flexShrink: 0 }}
            />
            <span>I agree to the Farmxie terms of use and privacy policy.</span>
          </label>

          <button type="submit" disabled={loading} style={authPrimaryButton(loading)}>
            {loading ? 'Creating account...' : 'Create Account'}
            {!loading && <Icon name="arrowRight" size={18} color="#FFFFFF" />}
          </button>
        </form>

        <OrDivider text="Or sign up with" />
        <SocialRow onError={setError} />
      </AuthCard>

      <p style={{ textAlign: 'center', fontSize: '13.5px', color: AUTH.textMuted, marginTop: '22px' }}>
        Already have an account?{' '}
        <Link to="/login" style={{ color: AUTH.green, fontWeight: 800, textDecoration: 'none' }}>
          Sign in
        </Link>
      </p>
    </AuthPage>
  )
}
