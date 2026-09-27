import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import FarmLiteLogo from './FarmLiteLogo'

const COLORS = {
  bg: '#F8FAF6',
  green: '#16A34A',
  greenDark: '#166534',
  text: '#1A2E1A',
  textMuted: '#5B6B5B',
}

const SPLASH_DURATION_MS = 4000

// Shown once when the app first opens. Plays a short logo entrance
// animation, then sends the person to Home (if already signed in)
// or to Login (if not) — the same pattern apps like Instagram/X use.
export default function SplashScreen() {
  const navigate = useNavigate()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // trigger the entrance animation on mount
    const raf = requestAnimationFrame(() => setVisible(true))

    const timer = setTimeout(async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        navigate('/', { replace: true })
      } else {
        navigate('/login', { replace: true })
      }
    }, SPLASH_DURATION_MS)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [navigate])

  return (
    <div
      style={{
        minHeight: '100vh',
        maxWidth: '480px',
        margin: '0 auto',
        background: COLORS.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes splashLogoIn {
          0%   { opacity: 0; transform: scale(0.6); }
          60%  { opacity: 1; transform: scale(1.08); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes splashTextIn {
          0%   { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes splashDot {
          0%, 80%, 100% { opacity: 0.25; }
          40% { opacity: 1; }
        }
      `}</style>

      <div
        style={{
          opacity: visible ? 1 : 0,
          animation: visible ? 'splashLogoIn 0.7s ease-out' : undefined,
        }}
      >
        <FarmLiteLogo size={96} />
      </div>

      <h1
        style={{
          fontSize: '28px',
          fontWeight: 800,
          color: COLORS.greenDark,
          marginTop: '18px',
          opacity: visible ? 1 : 0,
          animation: visible ? 'splashTextIn 0.6s ease-out 0.3s both' : undefined,
        }}
      >
        FarmLite
      </h1>

      <p
        style={{
          fontSize: '13px',
          color: COLORS.textMuted,
          marginTop: '4px',
          opacity: visible ? 1 : 0,
          animation: visible ? 'splashTextIn 0.6s ease-out 0.5s both' : undefined,
        }}
      >
        Connecting Farmers &nbsp;•&nbsp; Growing Together
      </p>

      <div style={{ display: 'flex', gap: '6px', marginTop: '36px' }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: COLORS.green,
              display: 'inline-block',
              animation: `splashDot 1.2s ease-in-out ${i * 0.15}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
