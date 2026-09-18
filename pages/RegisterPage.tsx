import { useState, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const COLORS = {
  bg: '#F8FAF6',
  card: '#FFFFFF',
  border: '#DCE7DC',
  green: '#16A34A',
  greenDark: '#166534',
  text: '#1A2E1A',
  textMuted: '#5B6B5B',
  red: '#DC2626',
}

const ROLES: { value: string; label: string }[] = [
  { value: 'farmer', label: 'Farmer' },
  { value: 'buyer', label: 'Buyer' },
  { value: 'agribusiness', label: 'Agribusiness' },
]

export default function RegisterPage() {
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('farmer')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checkEmail, setCheckEmail] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!fullName.trim() || !username.trim() || !email.trim() || !password) {
      setError('Please fill in every field.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
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
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
        <p style={{ fontSize: '40px' }}>📩</p>
        <h1 style={{ fontSize: '18px', fontWeight: 800, color: COLORS.text, marginTop: '10px' }}>Check your email</h1>
        <p style={{ fontSize: '13px', color: COLORS.textMuted, marginTop: '8px', lineHeight: 1.6 }}>
          We sent a confirmation link to <strong>{email}</strong>. Confirm it, then sign in to start using FarmLite.
        </p>
        <Link to="/login" style={{ marginTop: '20px', color: COLORS.green, fontWeight: 700, fontSize: '13px', textDecoration: 'none' }}>
          Go to Sign In
        </Link>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.greenDark})`, padding: '48px 24px 32px', color: 'white' }}>
        <p style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '0.3px' }}>🌱 FarmLite</p>
        <h1 style={{ fontSize: '24px', fontWeight: 800, marginTop: '18px' }}>Create your account</h1>
        <p style={{ fontSize: '13px', color: '#DCFCE7', marginTop: '6px' }}>Join farmers, buyers and agribusinesses.</p>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: '24px', flex: 1 }}>
        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '10px 12px', marginBottom: '14px' }}>
            <p style={{ fontSize: '12px', color: COLORS.red }}>{error}</p>
          </div>
        )}

        <label style={labelStyle}>Full Name</label>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Rabeel Bala" style={inputStyle} />

        <label style={labelStyle}>Username</label>
        <input value={username} onChange={(e) => setUsername(e.target.value.replace(/\s/g, '').toLowerCase())} placeholder="e.g. rabeelbala" style={inputStyle} />

        <label style={labelStyle}>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" style={inputStyle} />

        <label style={labelStyle}>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" style={inputStyle} />

        <label style={labelStyle}>I am a...</label>
        <div style={{ display: 'flex', gap: '8px', marginTop: '6px', marginBottom: '16px' }}>
          {ROLES.map((r) => (
            <div
              key={r.value}
              onClick={() => setRole(r.value)}
              style={{
                flex: 1, textAlign: 'center', padding: '10px 6px', borderRadius: '10px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
                background: role === r.value ? COLORS.green : COLORS.card,
                color: role === r.value ? 'white' : COLORS.textMuted,
                border: `1px solid ${role === r.value ? COLORS.green : COLORS.border}`,
              }}>
              {r.label}
            </div>
          ))}
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%', border: 'none', background: COLORS.green, color: 'white', fontWeight: 700, fontSize: '14px',
            padding: '13px', borderRadius: '12px', marginTop: '4px', cursor: 'pointer', opacity: loading ? 0.6 : 1,
          }}>
          {loading ? 'Creating account...' : 'Create Account'}
        </button>

        <p style={{ textAlign: 'center', fontSize: '13px', color: COLORS.textMuted, marginTop: '20px' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: COLORS.green, fontWeight: 700, textDecoration: 'none' }}>
            Sign in
          </Link>
        </p>
      </form>
    </div>
  )
}

const labelStyle: React.CSSProperties = { fontSize: '12px', fontWeight: 700, color: COLORS.text, display: 'block' }

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: '12px', border: `1px solid ${COLORS.border}`,
  marginTop: '6px', marginBottom: '16px', fontSize: '14px', boxSizing: 'border-box', background: COLORS.card, color: COLORS.text,
}
