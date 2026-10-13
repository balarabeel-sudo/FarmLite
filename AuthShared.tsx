import { useState, CSSProperties, ReactNode } from 'react'
import { supabase } from './supabaseClient'
import FarmLiteLogo from './FarmLiteLogo'
import Icon from './Icons'

// Shared look and pieces for the Sign In and Sign Up pages.

export const AUTH = {
  bg: '#F3F8F1',
  card: '#FFFFFF',
  field: '#F1F6EF',
  fieldBorder: '#DCE7DC',
  green: '#16A34A',
  greenDark: '#14532D',
  greenMid: '#166534',
  text: '#14231A',
  textMuted: '#5F7062',
  red: '#DC2626',
}

export const authInputWrap: CSSProperties = {
  display: 'flex', alignItems: 'center', position: 'relative',
  background: AUTH.field, border: `1.5px solid ${AUTH.fieldBorder}`, borderRadius: '14px',
  padding: '0 14px', marginBottom: '12px',
}

export const authInput: CSSProperties = {
  flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none',
  padding: '14px 0', fontSize: '14.5px', color: AUTH.text, fontFamily: 'inherit',
}

export const authLabel: CSSProperties = {
  display: 'block', fontSize: '12px', fontWeight: 700, color: AUTH.text, margin: '0 0 6px 2px',
}

export const authPrimaryButton = (loading: boolean): CSSProperties => ({
  width: '100%', border: 'none', background: `linear-gradient(135deg, ${AUTH.green}, ${AUTH.greenMid})`,
  color: 'white', fontWeight: 800, fontSize: '15px', padding: '15px', borderRadius: '14px',
  cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1,
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
  boxShadow: '0 8px 18px rgba(22,163,74,0.28)', fontFamily: 'inherit',
})

export function ErrorBox({ message }: { message: string }) {
  if (!message) return null
  return (
    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '12px', padding: '10px 12px', marginBottom: '14px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
      <span style={{ marginTop: '1px', flexShrink: 0 }}><Icon name="alertTriangle" size={15} color={AUTH.red} /></span>
      <p style={{ fontSize: '12.5px', color: AUTH.red, lineHeight: 1.4 }}>{message}</p>
    </div>
  )
}

// Green header with the logo. The white card of each page overlaps its bottom edge.
export function AuthHero({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{
      position: 'relative', overflow: 'hidden', color: 'white',
      background: `linear-gradient(160deg, ${AUTH.green} 0%, ${AUTH.greenMid} 55%, ${AUTH.greenDark} 100%)`,
      padding: '40px 24px 84px', borderRadius: '0 0 36px 36px',
    }}>
      <div style={{ position: 'absolute', top: '-60px', right: '-50px', width: '190px', height: '190px', borderRadius: '50%', background: 'rgba(255,255,255,0.09)' }} />
      <div style={{ position: 'absolute', top: '70px', left: '-70px', width: '150px', height: '150px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
      <div style={{ position: 'absolute', bottom: '-40px', right: '60px', width: '110px', height: '110px', borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px rgba(0,0,0,0.18)' }}>
          <FarmLiteLogo size={38} />
        </div>
        <div>
          <p style={{ fontSize: '21px', fontWeight: 800, letterSpacing: '0.2px', lineHeight: 1.1 }}>Farmxie</p>
          <p style={{ fontSize: '11.5px', color: '#BBF7D0', marginTop: '3px' }}>Connecting Farmers &nbsp;•&nbsp; Growing Together</p>
        </div>
      </div>

      <h1 style={{ position: 'relative', fontSize: '28px', fontWeight: 800, marginTop: '30px', lineHeight: 1.15 }}>{title}</h1>
      <p style={{ position: 'relative', fontSize: '13.5px', color: '#DCFCE7', marginTop: '8px', lineHeight: 1.5, maxWidth: '320px' }}>{subtitle}</p>
    </div>
  )
}

export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div style={{
      position: 'relative', background: AUTH.card, borderRadius: '24px', margin: '-48px 16px 0',
      padding: '24px 20px', boxShadow: '0 14px 36px rgba(20,83,45,0.12)',
    }}>
      {children}
    </div>
  )
}

export function AuthPage({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: AUTH.bg, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '480px', paddingBottom: '32px' }}>{children}</div>
    </div>
  )
}

export function OrDivider({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '22px 0 16px' }}>
      <div style={{ flex: 1, height: '1px', background: AUTH.fieldBorder }} />
      <span style={{ fontSize: '12px', color: AUTH.textMuted, fontWeight: 600 }}>{text}</span>
      <div style={{ flex: 1, height: '1px', background: AUTH.fieldBorder }} />
    </div>
  )
}

// Round badges for the "continue with" buttons.
function Badge({ bg, border, children }: { bg: string; border?: string; children: ReactNode }) {
  return (
    <span style={{ width: '42px', height: '42px', borderRadius: '50%', background: bg, border: border ?? 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </span>
  )
}

export function GoogleBadge() {
  return (
    <Badge bg="#FFFFFF" border="1.5px solid #E1E5E1">
      <span style={{ fontSize: '21px', fontWeight: 800, color: '#4285F4', fontFamily: 'Arial, Helvetica, sans-serif', lineHeight: 1 }}>G</span>
    </Badge>
  )
}

export function TelegramBadge() {
  return (
    <Badge bg="linear-gradient(135deg, #37AEE2, #1E96C8)">
      <span style={{ display: 'flex', transform: 'translate(-1px, 1px)' }}><Icon name="send" size={19} color="#FFFFFF" strokeWidth={1.9} /></span>
    </Badge>
  )
}

export function TravelerComBadge() {
  return (
    <Badge bg="linear-gradient(135deg, #0EA5A4, #0B6E8A)">
      <Icon name="globe" size={21} color="#FFFFFF" strokeWidth={1.8} />
    </Badge>
  )
}

// "Continue with" row. Google signs in through Supabase. TravelerCom and Telegram are
// shown for later and only display a short "coming soon" message when tapped.
export function SocialRow({ onError }: { onError: (message: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [soon, setSoon] = useState('')

  const google = async () => {
    if (busy) return
    setBusy(true)
    onError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) {
      setBusy(false)
      onError(error.message || 'Could not continue with Google. Please try again.')
    }
    // On success the browser is sent to Google, so there is nothing else to do here.
  }

  const showSoon = (name: string) => {
    setSoon(`${name} sign-in is coming soon.`)
    window.setTimeout(() => setSoon((s) => (s === `${name} sign-in is coming soon.` ? '' : s)), 2600)
  }

  const item: CSSProperties = {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px',
    border: `1.5px solid ${AUTH.fieldBorder}`, background: AUTH.card, borderRadius: '16px',
    padding: '12px 4px 10px', cursor: 'pointer', fontFamily: 'inherit', position: 'relative',
  }
  const label: CSSProperties = { fontSize: '12px', fontWeight: 700, color: AUTH.text }
  const soonTag: CSSProperties = {
    position: 'absolute', top: '-8px', right: '6px', background: '#FEF3C7', color: '#92400E',
    fontSize: '9px', fontWeight: 800, padding: '2px 6px', borderRadius: '999px',
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button type="button" onClick={google} disabled={busy} style={{ ...item, opacity: busy ? 0.6 : 1 }}>
          <GoogleBadge />
          <span style={label}>{busy ? 'Opening...' : 'Google'}</span>
        </button>
        <button type="button" onClick={() => showSoon('Telegram')} style={item}>
          <span style={soonTag}>SOON</span>
          <TelegramBadge />
          <span style={label}>Telegram</span>
        </button>
        <button type="button" onClick={() => showSoon('TravelerCom')} style={item}>
          <span style={soonTag}>SOON</span>
          <TravelerComBadge />
          <span style={label}>TravelerCom</span>
        </button>
      </div>
      {soon && (
        <p style={{ textAlign: 'center', fontSize: '12px', color: '#92400E', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px', padding: '8px 10px', marginTop: '12px' }}>{soon}</p>
      )}
    </div>
  )
}
