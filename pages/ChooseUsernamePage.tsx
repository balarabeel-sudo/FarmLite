import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import Icon from '../Icons'
import { AUTH, AuthPage, BrandHeader, ErrorBox, authPrimaryButton } from '../AuthShared'

// Third step of sign up: the person sees their @username, can keep it or change it
// (like X and Facebook), and says what they are.

const ROLES: { value: string; label: string; hint: string; icon: string }[] = [
  { value: 'farmer', label: 'Farmer', hint: 'Sell produce', icon: 'tractor' },
  { value: 'buyer', label: 'Buyer', hint: 'Buy produce', icon: 'cart' },
  { value: 'agribusiness', label: 'Agribusiness', hint: 'Run a business', icon: 'building' },
]

const clean = (v: string) => v.toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 24)

function formatProblem(u: string): string | null {
  if (u.length < 3) return 'Use at least 3 characters.'
  if (!/[a-z]/.test(u)) return 'Include at least one letter.'
  if (/^[._]|[._]$/.test(u)) return 'Cannot start or end with . or _'
  return null
}

type Status = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'

export default function ChooseUsernamePage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [current, setCurrent] = useState('')
  const [wanted, setWanted] = useState('')
  const [role, setRole] = useState('farmer')
  const [profilePhone, setProfilePhone] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [problem, setProblem] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const seq = useRef(0)

  useEffect(() => {
    if (!user) return
    let alive = true
    const meta = (user.user_metadata || {}) as Record<string, any>
    setWanted(typeof meta.username === 'string' ? meta.username : '')
    ;(async () => {
      const { data } = await supabase.from('profiles').select('username, role, phone').eq('user_id', user.id).maybeSingle()
      if (!alive) return
      if (data) {
        setCurrent(data.username || '')
        setRole(data.role || 'farmer')
        setProfilePhone(data.phone || null)
      }
      setLoading(false)
    })()
    return () => { alive = false }
  }, [user?.id])

  // Is this username free? (the person's own current username counts as free)
  const isTaken = async (u: string): Promise<boolean> => {
    if (!user) return false
    const escaped = u.replace(/[\\%_]/g, (m) => `\\${m}`)
    const { data } = await supabase.from('profiles').select('user_id').ilike('username', escaped).neq('user_id', user.id).limit(1)
    return !!data && data.length > 0
  }

  const findSuggestions = async (base: string) => {
    const root = base.replace(/[^a-z0-9]/g, '').slice(0, 18) || 'farmer'
    const rnd = () => Math.floor(10 + Math.random() * 990)
    const pool = Array.from(new Set([`${root}${rnd()}`, `${root}_${rnd()}`, `${root}.farm`, `the${root}`, `${root}${rnd()}`, `${root}_ng`, `${root}${rnd()}`])).map((s) => s.slice(0, 24))
    const { data } = await supabase.from('profiles').select('username').in('username', pool)
    const used = new Set(((data || []) as { username: string }[]).map((r) => (r.username || '').toLowerCase()))
    return pool.filter((p) => !used.has(p) && !formatProblem(p)).slice(0, 3)
  }

  // Live check while typing
  useEffect(() => {
    if (!editing) return
    const u = draft
    const mine = ++seq.current
    setSuggestions([])
    setProblem('')
    if (!u) { setStatus('idle'); return }
    if (u === current) { setStatus('available'); return }
    const bad = formatProblem(u)
    if (bad) { setStatus('invalid'); setProblem(bad); return }
    setStatus('checking')
    const timer = window.setTimeout(async () => {
      const taken = await isTaken(u)
      if (mine !== seq.current) return
      if (!taken) { setStatus('available'); return }
      setStatus('taken')
      const alt = await findSuggestions(u)
      if (mine === seq.current) setSuggestions(alt)
    }, 400)
    return () => window.clearTimeout(timer)
  }, [draft, editing, current])

  const startEditing = () => { setDraft(current); setEditing(true); setError('') }

  const finish = async () => {
    if (!user || saving) return
    setError('')
    setSaving(true)

    const changes: Record<string, string> = { role }
    if (editing && draft && draft !== current) {
      const bad = formatProblem(draft)
      if (bad) { setSaving(false); setError(bad); return }
      if (status === 'taken' || (await isTaken(draft))) {
        setSaving(false)
        setStatus('taken')
        setError(`@${draft} is already taken. Pick another one.`)
        setSuggestions(await findSuggestions(draft))
        return
      }
      changes.username = draft
    }
    // The phone number typed at sign up is saved to the profile
    const metaPhone = typeof (user.user_metadata as any)?.phone === 'string' ? ((user.user_metadata as any).phone as string) : ''
    if (metaPhone && !profilePhone) changes.phone = metaPhone

    const { error: updateError } = await supabase.from('profiles').update(changes).eq('user_id', user.id)
    if (updateError) {
      setSaving(false)
      if ((updateError as any).code === '23505') {
        setStatus('taken')
        setError('That username was just taken. Please pick another one.')
        if (draft) setSuggestions(await findSuggestions(draft))
      } else {
        setError('Could not save. Please check your connection and try again.')
      }
      return
    }

    // Done: this page is not shown again
    await supabase.auth.updateUser({ data: { username_pending: false } })
    navigate('/', { replace: true })
  }

  const renamed = !!wanted && !!current && wanted.toLowerCase() !== current.toLowerCase()
  const canContinue = !saving && !loading && (!editing || status === 'available')

  const statusLine = () => {
    if (status === 'checking') return <p style={{ fontSize: '12.5px', color: AUTH.textMuted, marginTop: '8px' }}>Checking...</p>
    if (status === 'available') return <p style={{ fontSize: '12.5px', color: AUTH.green, fontWeight: 700, marginTop: '8px' }}>@{draft} is available</p>
    if (status === 'taken') return <p style={{ fontSize: '12.5px', color: AUTH.red, fontWeight: 700, marginTop: '8px' }}>@{draft} is already taken</p>
    if (status === 'invalid') return <p style={{ fontSize: '12.5px', color: AUTH.red, marginTop: '8px' }}>{problem}</p>
    return null
  }

  return (
    <AuthPage>
      <BrandHeader compact />

      <div style={{ marginTop: '26px', marginBottom: '18px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, color: AUTH.greenDark, lineHeight: 1.1 }}>Your username</h1>
        <p style={{ fontSize: '15px', color: AUTH.textMuted, marginTop: '8px', lineHeight: 1.45 }}>
          This is how people find and mention you on FarmXie.
        </p>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: AUTH.textMuted, fontSize: '14px', padding: '30px 0' }}>Loading...</p>
      ) : (
        <>
          <ErrorBox message={error} />

          <div style={{ background: 'var(--fx-card)', border: `1.5px solid ${AUTH.fieldBorder}`, borderRadius: '18px', padding: '18px 16px', boxShadow: '0 1px 2px rgba(15,81,50,0.04)' }}>
            {!editing ? (
              <>
                <p style={{ fontSize: '12.5px', color: AUTH.textMuted, fontWeight: 600 }}>Your username</p>
                <p style={{ fontSize: '26px', fontWeight: 800, color: AUTH.text, marginTop: '4px', wordBreak: 'break-all' }}>@{current}</p>
                {renamed && (
                  <p style={{ fontSize: '13px', color: 'var(--fx-amber-text)', background: 'var(--fx-tint-amber2)', border: '1px solid var(--fx-bd-amber)', borderRadius: '10px', padding: '8px 10px', marginTop: '12px', lineHeight: 1.45 }}>
                    @{wanted} was already taken by someone else, so we gave you @{current}. You can keep it or change it.
                  </p>
                )}
                <button
                  type="button"
                  onClick={startEditing}
                  style={{ marginTop: '14px', border: `1.5px solid ${AUTH.green}`, background: 'transparent', color: AUTH.green, fontWeight: 700, fontSize: '14px', padding: '10px 18px', borderRadius: '999px', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Change username
                </button>
              </>
            ) : (
              <>
                <p style={{ fontSize: '12.5px', color: AUTH.textMuted, fontWeight: 600, marginBottom: '8px' }}>Choose your username</p>
                <div style={{ display: 'flex', alignItems: 'center', border: `1.5px solid ${status === 'taken' || status === 'invalid' ? AUTH.red : status === 'available' ? AUTH.green : AUTH.fieldBorder}`, borderRadius: '14px', padding: '0 14px', height: '52px' }}>
                  <span style={{ fontSize: '18px', fontWeight: 800, color: AUTH.green, marginRight: '6px' }}>@</span>
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(clean(e.target.value))}
                    placeholder="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: '16px', fontWeight: 600, color: AUTH.text, fontFamily: 'inherit' }}
                  />
                  {status === 'available' && <Icon name="check" size={20} color={AUTH.green} strokeWidth={2.6} />}
                </div>
                {statusLine()}

                {status === 'taken' && suggestions.length > 0 && (
                  <div style={{ marginTop: '12px' }}>
                    <p style={{ fontSize: '12px', color: AUTH.textMuted, marginBottom: '8px' }}>Available for you:</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {suggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setDraft(s)}
                          style={{ border: `1.5px solid ${AUTH.fieldBorder}`, background: '#F3F9F2', color: AUTH.greenDark, fontWeight: 700, fontSize: '13.5px', padding: '8px 14px', borderRadius: '999px', cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          @{s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => { setEditing(false); setError('') }}
                  style={{ marginTop: '14px', border: 'none', background: 'transparent', color: AUTH.textMuted, fontWeight: 600, fontSize: '13px', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
                >
                  Keep @{current} instead
                </button>
              </>
            )}
          </div>

          <p style={{ fontSize: '13px', fontWeight: 700, color: AUTH.text, margin: '22px 2px 10px' }}>I am a...</p>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '26px' }}>
            {ROLES.map((r) => {
              const on = role === r.value
              return (
                <div
                  key={r.value}
                  onClick={() => setRole(r.value)}
                  style={{
                    flex: 1, textAlign: 'center', padding: '14px 4px 12px', borderRadius: '16px', cursor: 'pointer',
                    background: on ? '#ECFDF3' : '#FFFFFF', border: `1.5px solid ${on ? AUTH.green : AUTH.fieldBorder}`,
                  }}
                >
                  <span style={{ display: 'inline-flex' }}><Icon name={r.icon} size={24} color={on ? AUTH.green : AUTH.textMuted} /></span>
                  <p style={{ fontSize: '13px', fontWeight: 800, color: on ? AUTH.greenDark : AUTH.text, marginTop: '5px' }}>{r.label}</p>
                  <p style={{ fontSize: '11px', color: AUTH.textMuted, marginTop: '1px' }}>{r.hint}</p>
                </div>
              )
            })}
          </div>

          <button type="button" onClick={finish} disabled={!canContinue} style={{ ...authPrimaryButton(!canContinue), opacity: canContinue ? 1 : 0.55 }}>
            {saving ? 'Saving...' : editing ? 'Save and continue' : 'Continue'}
            {!saving && <Icon name="arrowRight" size={20} color="#FFFFFF" />}
          </button>
        </>
      )}
    </AuthPage>
  )
}
