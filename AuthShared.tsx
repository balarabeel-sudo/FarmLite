import { useState } from 'react'
import type { CSSProperties, ReactNode, InputHTMLAttributes } from 'react'
import { supabase } from './supabaseClient'
import FarmLiteLogo from './FarmLiteLogo'
import Icon from './Icons'

// Shared look and pieces for Sign In, Sign Up, Choose Username and password pages.

export const AUTH = {
  bg: '#F3F9F2',
  card: 'var(--fx-card)',
  fieldBorder: '#D8E2D8',
  green: '#1B8035',
  greenBright: '#16A34A',
  greenDark: '#0F5132',
  text: '#16281C',
  textMuted: '#5F7062',
  placeholder: '#7C8A7E',
  red: '#DC2626',
}

// The same clean sans-serif look as the design (the phone's default font is a serif one).
const AUTH_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"

// Soft leaves in the corners, like the design.
function Leaf({ style, rotate = 0 }: { style: CSSProperties; rotate?: number }) {
  return (
    <svg viewBox="0 0 100 100" style={{ position: 'absolute', pointerEvents: 'none', ...style }} aria-hidden="true">
      <g transform={`rotate(${rotate} 50 50)`}>
        <path d="M50 96C20 74 14 40 50 6c36 34 30 68 0 90Z" fill="#CFE8CC" opacity="0.55" />
        <path d="M50 92V16" stroke="#FFFFFF" strokeWidth="2" opacity="0.7" />
      </g>
    </svg>
  )
}

export function AuthPage({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: `linear-gradient(180deg, ${AUTH.bg} 0%, var(--fx-card) 55%, #F3F9F2 100%)`, display: 'flex', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: '480px', minHeight: '100vh', overflow: 'hidden', padding: '0 24px 32px', fontFamily: AUTH_FONT }}>
        <Leaf style={{ top: '30px', left: '-34px', width: '110px', height: '110px' }} rotate={-35} />
        <Leaf style={{ top: '60px', right: '-30px', width: '100px', height: '100px' }} rotate={35} />
        <Leaf style={{ bottom: '10px', left: '-20px', width: '120px', height: '120px' }} rotate={-20} />
        <Leaf style={{ bottom: '30px', right: '-24px', width: '100px', height: '100px' }} rotate={25} />
        <div style={{ position: 'relative' }}>{children}</div>
      </div>
    </div>
  )
}

// Logo, name and tagline at the top of every auth page.
export function BrandHeader({ compact = false }: { compact?: boolean }) {
  return (
    <div style={{ textAlign: 'center', paddingTop: compact ? '26px' : '44px' }}>
      <div style={{ display: 'inline-flex' }}>
        <FarmLiteLogo size={compact ? 92 : 112} />
      </div>
      <p style={{ fontSize: compact ? '34px' : '38px', fontWeight: 800, color: AUTH.greenDark, letterSpacing: '-0.5px', lineHeight: 1, marginTop: '6px' }}>
        Farm<span style={{ color: AUTH.green }}>X</span>ie
      </p>
      <p style={{ fontSize: '12.5px', color: AUTH.greenDark, marginTop: '7px', fontWeight: 500 }}>Global Digital Agriculture Platform</p>
    </div>
  )
}

export function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ marginTop: '30px', marginBottom: '22px' }}>
      <h1 style={{ fontSize: '32px', fontWeight: 800, color: AUTH.greenDark, lineHeight: 1.1, letterSpacing: '-0.4px' }}>{title}</h1>
      <p style={{ fontSize: '15.5px', color: AUTH.textMuted, marginTop: '8px', lineHeight: 1.4 }}>{subtitle}</p>
    </div>
  )
}

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Back"
      style={{ position: 'absolute', top: '22px', left: '0', border: 'none', background: 'transparent', padding: '6px', cursor: 'pointer', display: 'flex', zIndex: 2 }}
    >
      <Icon name="arrowLeft" size={24} color={AUTH.text} strokeWidth={1.8} />
    </button>
  )
}

const fieldWrap: CSSProperties = {
  display: 'flex', alignItems: 'center', background: 'var(--fx-card)', border: `1.5px solid ${AUTH.fieldBorder}`,
  borderRadius: '14px', padding: '0 16px', marginBottom: '13px', height: '54px', boxShadow: '0 1px 2px rgba(15,81,50,0.04)',
}

const fieldInput: CSSProperties = {
  flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none',
  fontSize: '15px', color: AUTH.text, fontFamily: 'inherit', height: '100%',
}

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'style'> & { icon: string; right?: ReactNode; marginBottom?: number }

export function AuthField({ icon, right, marginBottom, ...input }: FieldProps) {
  return (
    <div style={{ ...fieldWrap, ...(marginBottom !== undefined ? { marginBottom } : {}) }}>
      <span style={{ marginRight: '14px', display: 'flex' }}><Icon name={icon} size={20} color="#3F4A42" strokeWidth={1.7} /></span>
      <input {...input} style={fieldInput} />
      {right}
    </div>
  )
}

export function PasswordField({ show, onToggle, ...input }: Omit<FieldProps, 'icon' | 'right' | 'type'> & { show: boolean; onToggle: () => void }) {
  return (
    <AuthField
      {...input}
      icon="lock"
      type={show ? 'text' : 'password'}
      right={(
        <button type="button" onClick={onToggle} aria-label={show ? 'Hide password' : 'Show password'} style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', padding: '6px', marginRight: '-6px' }}>
          <Icon name={show ? 'eye' : 'eyeOff'} size={20} color="#3F4A42" strokeWidth={1.7} />
        </button>
      )}
    />
  )
}

export const authPrimaryButton = (loading: boolean): CSSProperties => ({
  width: '100%', border: 'none', background: `linear-gradient(180deg, #218A3B, ${AUTH.green})`,
  color: 'white', fontWeight: 700, fontSize: '17px', height: '56px', borderRadius: '28px',
  cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1,
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
  boxShadow: '0 8px 18px rgba(27,128,53,0.28)', fontFamily: 'inherit',
})

export function ErrorBox({ message }: { message: string }) {
  if (!message) return null
  return (
    <div style={{ background: 'var(--fx-tint-red2)', border: '1px solid var(--fx-bd-red)', borderRadius: '12px', padding: '10px 12px', marginBottom: '14px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
      <span style={{ marginTop: '1px', flexShrink: 0 }}><Icon name="alertTriangle" size={15} color={AUTH.red} /></span>
      <p style={{ fontSize: '12.5px', color: AUTH.red, lineHeight: 1.4 }}>{message}</p>
    </div>
  )
}

export function OrDivider({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '22px 0 18px' }}>
      <div style={{ flex: 1, height: '1px', background: AUTH.fieldBorder }} />
      <span style={{ fontSize: '13px', color: AUTH.textMuted }}>{text}</span>
      <div style={{ flex: 1, height: '1px', background: AUTH.fieldBorder }} />
    </div>
  )
}

function GoogleG() {
  return (
    <svg width="24" height="24" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  )
}

// Google signs in through Supabase.
export function GoogleButton({ label, onError }: { label: string; onError: (message: string) => void }) {
  const [busy, setBusy] = useState(false)

  const go = async () => {
    if (busy) return
    setBusy(true)
    onError('')
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
    if (error) {
      setBusy(false)
      onError(error.message || 'Could not continue with Google. Please try again.')
    }
    // On success the browser is sent to Google, so there is nothing else to do here.
  }

  return (
    <button
      type="button"
      onClick={go}
      disabled={busy}
      style={{
        width: '100%', height: '54px', borderRadius: '14px', background: 'var(--fx-card)', border: `1.5px solid ${AUTH.fieldBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', cursor: busy ? 'default' : 'pointer',
        fontSize: '16px', fontWeight: 600, color: AUTH.text, fontFamily: 'inherit', opacity: busy ? 0.6 : 1,
      }}
    >
      <GoogleG />
      {busy ? 'Opening...' : label}
    </button>
  )
}

export const authLinkStyle: CSSProperties = { color: AUTH.green, fontWeight: 700, textDecoration: 'none' }

// ---------------------------------------------------------------------------------------------
// Old names kept only so the previous Sign In / Sign Up pages still build while the new pages are
// being committed one by one. Once pages/LoginPage.tsx and pages/RegisterPage.tsx are the new
// versions, everything below this line can be deleted.
// ---------------------------------------------------------------------------------------------
export const authInputWrap: CSSProperties = { ...fieldWrap, height: 'auto', padding: '0 14px', marginBottom: '12px' }
export const authInput: CSSProperties = { ...fieldInput, height: 'auto', padding: '14px 0' }
export const authLabel: CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 700, color: AUTH.text, margin: '0 0 6px 2px' }
export function AuthHero({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <BrandHeader compact />
      <PageTitle title={title} subtitle={subtitle} />
    </div>
  )
}
export function AuthCard({ children }: { children: ReactNode }) {
  return <div>{children}</div>
}
export function SocialRow({ onError }: { onError: (message: string) => void }) {
  return <GoogleButton label="Continue with Google" onError={onError} />
}
