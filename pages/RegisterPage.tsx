import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Icon from '../Icons'
import {
  AUTH, AuthPage, BrandHeader, PageTitle, BackButton, ErrorBox, OrDivider, GoogleButton,
  AuthField, PasswordField, authPrimaryButton, authLinkStyle,
} from '../AuthShared'

const COUNTRIES: { code: string; dial: string; flag: string; name: string }[] = [
  { code: 'NG', dial: '+234', flag: '🇳🇬', name: 'Nigeria' },
  { code: 'GH', dial: '+233', flag: '🇬🇭', name: 'Ghana' },
  { code: 'NE', dial: '+227', flag: '🇳🇪', name: 'Niger' },
  { code: 'BJ', dial: '+229', flag: '🇧🇯', name: 'Benin' },
  { code: 'TG', dial: '+228', flag: '🇹🇬', name: 'Togo' },
  { code: 'CM', dial: '+237', flag: '🇨🇲', name: 'Cameroon' },
  { code: 'SN', dial: '+221', flag: '🇸🇳', name: 'Senegal' },
  { code: 'KE', dial: '+254', flag: '🇰🇪', name: 'Kenya' },
  { code: 'ET', dial: '+251', flag: '🇪🇹', name: 'Ethiopia' },
  { code: 'ZA', dial: '+27', flag: '🇿🇦', name: 'South Africa' },
  { code: 'GB', dial: '+44', flag: '🇬🇧', name: 'United Kingdom' },
  { code: 'US', dial: '+1', flag: '🇺🇸', name: 'United States' },
  { code: 'IN', dial: '+91', flag: '🇮🇳', name: 'India' },
]

// A first username is suggested from the name. If someone already has it, the database adds a number,
// and the next page shows the person what they got and lets them change it.
export const suggestUsername = (fullName: string) =>
  fullName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)

export default function RegisterPage() {
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [countryCode, setCountryCode] = useState('NG')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [agree, setAgree] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checkEmail, setCheckEmail] = useState(false)

  const country = COUNTRIES.find((c) => c.code === countryCode) || COUNTRIES[0]

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!fullName.trim() || !email.trim() || !password || !confirm) {
      setError('Please fill in your name, email and password.')
      return
    }
    const base = suggestUsername(fullName)
    if (base.length < 3) {
      setError('Please enter your full name (at least 3 letters).')
      return
    }

    // Phone is optional, but when it is given it must look right
    const digits = phone.replace(/\D/g, '').replace(/^0+/, '')
    if (phone.trim() && (digits.length < 7 || digits.length > 12)) {
      setError('Enter a valid phone number.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('The two passwords do not match.')
      return
    }
    if (!agree) {
      setError('Please accept the Terms of Service and Privacy Policy.')
      return
    }

    setLoading(true)

    // full_name, username and role are read by the "handle_new_user" database trigger, which creates the profile.
    // username_pending sends the person to the "Choose your username" page after they get in.
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          username: base,
          role: 'farmer',
          phone: digits ? `${country.dial}${digits}` : '',
          username_pending: true,
        },
      },
    })

    setLoading(false)

    if (signUpError) {
      setError(signUpError.message || 'Could not create your account. Please try again.')
      return
    }

    if (data.session) {
      navigate('/choose-username', { replace: true })
    } else {
      // Email confirmation is required before a session is issued.
      setCheckEmail(true)
    }
  }

  if (checkEmail) {
    return (
      <AuthPage>
        <div style={{ paddingTop: '90px', textAlign: 'center' }}>
          <div style={{ width: '88px', height: '88px', borderRadius: '50%', background: '#DCFCE7', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="mail" size={40} color={AUTH.green} />
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: AUTH.greenDark, marginTop: '24px' }}>Check your email</h1>
          <p style={{ fontSize: '15px', color: AUTH.textMuted, marginTop: '10px', lineHeight: 1.6 }}>
            We sent a confirmation link to <strong style={{ color: AUTH.text }}>{email.trim()}</strong>. Tap the link once, and you will pick your @username next.
          </p>
          <p style={{ fontSize: '12.5px', color: AUTH.textMuted, marginTop: '12px' }}>Cannot find it? Check your Spam folder.</p>
          <Link to="/login" style={{ ...authPrimaryButton(false), display: 'inline-flex', width: 'auto', padding: '0 38px', marginTop: '28px', textDecoration: 'none' }}>
            Go to Sign In
          </Link>
        </div>
      </AuthPage>
    )
  }

  return (
    <AuthPage>
      <BackButton onClick={() => navigate('/login')} />
      <BrandHeader compact />
      <PageTitle title="Create Account" subtitle="Join the global agriculture community" />

      <form onSubmit={handleSubmit}>
        <ErrorBox message={error} />

        <AuthField icon="user" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full Name" autoComplete="name" />

        <AuthField icon="mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email Address" autoComplete="email" autoCapitalize="none" />

        {/* Phone number with country code */}
        <div style={{ display: 'flex', alignItems: 'center', background: '#FFFFFF', border: `1.5px solid ${AUTH.fieldBorder}`, borderRadius: '14px', padding: '0 16px', marginBottom: '13px', height: '54px', boxShadow: '0 1px 2px rgba(15,81,50,0.04)' }}>
          <span style={{ marginRight: '12px', display: 'flex' }}><Icon name="phone" size={20} color="#3F4A42" strokeWidth={1.7} /></span>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '6px', paddingRight: '12px', marginRight: '12px', borderRight: `1px solid ${AUTH.fieldBorder}`, height: '28px' }}>
            <span style={{ fontSize: '20px', lineHeight: 1 }}>{country.flag}</span>
            <span style={{ fontSize: '15px', fontWeight: 700, color: AUTH.text }}>{country.dial}</span>
            <Icon name="chevronDown" size={16} color="#3F4A42" />
            <select
              aria-label="Country code"
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', fontSize: '16px' }}
            >
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.name} ({c.dial})</option>)}
            </select>
          </div>
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone Number"
            autoComplete="tel-national"
            style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', fontSize: '15px', color: AUTH.text, fontFamily: 'inherit', height: '100%' }}
          />
        </div>

        <PasswordField show={showPassword} onToggle={() => setShowPassword((v) => !v)} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete="new-password" />
        <PasswordField show={showConfirm} onToggle={() => setShowConfirm((v) => !v)} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm Password" autoComplete="new-password" />

        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', color: AUTH.text, cursor: 'pointer', margin: '4px 0 18px' }}>
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ width: '20px', height: '20px', accentColor: AUTH.green, flexShrink: 0 }} />
          <span>
            I agree to the <Link to="/terms" style={authLinkStyle}>Terms of Service</Link> and <Link to="/privacy" style={authLinkStyle}>Privacy Policy</Link>
          </span>
        </label>

        <button type="submit" disabled={loading} style={authPrimaryButton(loading)}>
          {loading ? 'Creating account...' : 'Create Account'}
          {!loading && <Icon name="arrowRight" size={20} color="#FFFFFF" />}
        </button>
      </form>

      <OrDivider text="or sign up with" />
      <GoogleButton label="Sign up with Google" onError={setError} />

      <p style={{ textAlign: 'center', fontSize: '14.5px', color: AUTH.text, marginTop: '30px' }}>
        Already have an account? <Link to="/login" style={authLinkStyle}>Sign In</Link>
      </p>
    </AuthPage>
  )
}
