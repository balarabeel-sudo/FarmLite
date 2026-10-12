import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import Icon from '../Icons'
import {
  NOTIFICATION_CATEGORIES, disablePush, enablePush, getMutedCategories, getPushState, saveMutedCategories,
} from '../pushShared'
import type { PushState } from '../pushShared'

const COLORS = {
  bg: '#F8FAF6',
  card: '#FFFFFF',
  border: '#E5EFE5',
  green: '#16A34A',
  text: '#1A2E1A',
  textMuted: '#5B6B5B',
  red: '#DC2626',
}

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div
      role="switch"
      aria-checked={on}
      onClick={() => !disabled && onChange(!on)}
      style={{
        width: '44px', height: '26px', borderRadius: '13px', padding: '3px', flexShrink: 0,
        background: on ? COLORS.green : '#CBD5CB', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1,
        display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start', transition: 'background 0.15s',
      }}>
      <div style={{ width: '20px', height: '20px', borderRadius: '10px', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
    </div>
  )
}

export default function NotificationSettingsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [pushState, setPushState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [muted, setMuted] = useState<string[]>([])
  const [prefsLoaded, setPrefsLoaded] = useState(false)

  useEffect(() => {
    getPushState().then(setPushState)
  }, [])

  useEffect(() => {
    if (!user) return
    getMutedCategories(user.id).then((m) => { setMuted(m); setPrefsLoaded(true) })
  }, [user])

  const turnOn = async () => {
    setBusy(true)
    setMessage(null)
    const res = await enablePush()
    setPushState(res.state)
    if (res.state === 'on') setMessage({ type: 'ok', text: 'Push notifications are on for this device.' })
    else if (res.error) setMessage({ type: 'error', text: res.error })
    setBusy(false)
  }

  const turnOff = async () => {
    setBusy(true)
    setMessage(null)
    await disablePush()
    setPushState(await getPushState())
    setMessage({ type: 'ok', text: 'Push notifications are off for this device.' })
    setBusy(false)
  }

  const toggleCategory = async (key: string, enabled: boolean) => {
    if (!user) return
    const next = enabled ? muted.filter((k) => k !== key) : [...muted, key]
    const previous = muted
    setMuted(next)
    const ok = await saveMutedCategories(user.id, next)
    if (!ok) {
      setMuted(previous)
      setMessage({ type: 'error', text: 'Could not save your choice. Please try again.' })
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '30px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: COLORS.card,
        position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}>
        <div onClick={() => navigate(-1)} style={{ cursor: 'pointer', display: 'flex' }}>
          <Icon name="arrowLeft" size={22} color={COLORS.text} />
        </div>
        <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>Notification settings</p>
      </div>

      <div style={{ padding: '16px' }}>
        {message && (
          <div style={{
            background: message.type === 'ok' ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${message.type === 'ok' ? '#BBF7D0' : '#FECACA'}`,
            color: message.type === 'ok' ? COLORS.green : COLORS.red, fontSize: '12px', fontWeight: 600,
            borderRadius: '12px', padding: '10px 12px', marginBottom: '12px',
          }}>
            {message.text}
          </div>
        )}

        <div style={{ background: COLORS.card, borderRadius: '14px', padding: '16px', marginBottom: '16px', border: `1px solid ${COLORS.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '19px', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="bell" size={17} color={COLORS.green} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '14px', fontWeight: 700, color: COLORS.text }}>Push notifications</p>
              <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '2px', lineHeight: 1.4 }}>
                {pushState === null && 'Checking this device...'}
                {pushState === 'on' && 'On for this device. You get alerts even when Farmxie is closed.'}
                {pushState === 'off' && 'Off for this device. Turn on to get alerts even when Farmxie is closed.'}
                {pushState === 'denied' && 'Blocked in your browser settings.'}
                {pushState === 'ios-install' && 'On iPhone, add Farmxie to your Home Screen first.'}
                {pushState === 'unsupported' && 'This browser does not support push notifications.'}
              </p>
            </div>
          </div>

          {pushState === 'off' && (
            <button onClick={turnOn} disabled={busy} style={buttonStyle(COLORS.green, '#fff')}>
              {busy ? 'Please wait...' : 'Turn on notifications'}
            </button>
          )}
          {pushState === 'on' && (
            <button onClick={turnOff} disabled={busy} style={buttonStyle('#F1F5F1', COLORS.text)}>
              {busy ? 'Please wait...' : 'Turn off on this device'}
            </button>
          )}
          {pushState === 'denied' && (
            <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '12px', lineHeight: 1.5 }}>
              Open your browser or phone settings for this site, allow Notifications, then come back to this page.
            </p>
          )}
          {pushState === 'ios-install' && (
            <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '12px', lineHeight: 1.5 }}>
              In Safari tap the Share button, choose Add to Home Screen, then open Farmxie from your Home Screen and come back to this page.
            </p>
          )}
        </div>

        <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.textMuted, margin: '0 4px 8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Send me push notifications for
        </p>
        <div style={{ background: COLORS.card, borderRadius: '14px', border: `1px solid ${COLORS.border}`, overflow: 'hidden' }}>
          {NOTIFICATION_CATEGORIES.map((c, i) => (
            <div key={c.key} style={{
              display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 14px',
              borderTop: i === 0 ? 'none' : `1px solid ${COLORS.border}`,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>{c.label}</p>
                <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '2px', lineHeight: 1.4 }}>{c.hint}</p>
              </div>
              <Toggle on={!muted.includes(c.key)} disabled={!prefsLoaded} onChange={(v) => toggleCategory(c.key, v)} />
            </div>
          ))}
        </div>
        <p style={{ fontSize: '11.5px', color: COLORS.textMuted, margin: '10px 4px 0', lineHeight: 1.5 }}>
          Turning a type off only stops the push alerts. Those notifications still show up inside the app.
        </p>
      </div>
    </div>
  )
}

function buttonStyle(bg: string, color: string): CSSProperties {
  return {
    width: '100%', marginTop: '14px', padding: '12px', borderRadius: '12px', border: 'none',
    background: bg, color, fontSize: '13.5px', fontWeight: 700, cursor: 'pointer',
  }
}
