import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'

// A small sheet where the person tells FarmBot about their own farm (what they grow or keep, size, place).
// FarmBot uses it to make its answers fit. It is saved in the person's own row (only they can read or change it).

const COLORS = {
  bg: '#F0FDF4',
  card: '#FFFFFF',
  border: '#DCFCE7',
  green: '#16A34A',
  greenDark: '#14532D',
  text: '#1A2E1A',
  textMuted: '#5B6B5B',
  red: '#B91C1C',
}

// The database allows up to 20 items of up to 40 characters each
function toList(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of text.split(/[,\n]/)) {
    const v = raw.replace(/\s+/g, ' ').trim().slice(0, 40)
    if (v && !seen.has(v.toLowerCase())) {
      seen.add(v.toLowerCase())
      out.push(v)
    }
  }
  return out.slice(0, 20)
}

const fieldStyle = {
  width: '100%', boxSizing: 'border-box' as const, padding: '10px 12px', borderRadius: '12px',
  border: `1px solid ${COLORS.border}`, background: COLORS.bg, fontSize: '13px', color: COLORS.text,
  outline: 'none', fontFamily: 'inherit',
}

function Label({ text, hint }: { text: string; hint?: string }) {
  return (
    <div style={{ margin: '12px 0 5px' }}>
      <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text }}>{text}</p>
      {hint && <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '1px' }}>{hint}</p>}
    </div>
  )
}

export default function FarmProfileSheet({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const [crops, setCrops] = useState('')
  const [livestock, setLivestock] = useState('')
  const [farmSize, setFarmSize] = useState('')
  const [farmLocation, setFarmLocation] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!user) return
    let alive = true
    supabase
      .from('farm_profiles')
      .select('crops, livestock, farm_size, farm_location, notes')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error: loadError }) => {
        if (!alive) return
        if (loadError) setError('Could not load your farm details. Please try again.')
        if (data) {
          setCrops((data.crops || []).join(', '))
          setLivestock((data.livestock || []).join(', '))
          setFarmSize(data.farm_size || '')
          setFarmLocation(data.farm_location || '')
          setNotes(data.notes || '')
        }
        setLoading(false)
      })
    return () => { alive = false }
  }, [user?.id])

  const save = async () => {
    if (!user || saving) return
    setSaving(true)
    setError('')
    setSaved(false)
    const { error: saveError } = await supabase.from('farm_profiles').upsert({
      user_id: user.id,
      crops: toList(crops),
      livestock: toList(livestock),
      farm_size: farmSize.trim().slice(0, 60) || null,
      farm_location: farmLocation.trim().slice(0, 120) || null,
      notes: notes.trim().slice(0, 500) || null,
    }, { onConflict: 'user_id' })
    setSaving(false)
    if (saveError) {
      setError('Could not save. Please check your connection and try again.')
      return
    }
    setSaved(true)
    window.setTimeout(onClose, 700)
  }

  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 40, display: 'flex', alignItems: 'flex-end' }}>
      <div
        role="dialog"
        aria-label="My farm details"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxHeight: '88%', overflowY: 'auto', background: COLORS.card, borderRadius: '18px 18px 0 0', padding: '16px 16px calc(16px + env(safe-area-inset-bottom, 0px))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <p style={{ flex: 1, fontSize: '16px', fontWeight: 800, color: COLORS.text }}>My farm details</p>
          <div onClick={onClose} role="button" aria-label="Close" style={{ cursor: 'pointer', display: 'flex', padding: '4px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COLORS.textMuted} strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </div>
        </div>
        <p style={{ fontSize: '12px', color: COLORS.textMuted, lineHeight: 1.45, marginTop: '4px' }}>
          Tell FarmBot about your farm so its advice fits you. Only you can see this. You can also just tell FarmBot in the chat.
        </p>

        {loading ? (
          <p style={{ fontSize: '12.5px', color: COLORS.textMuted, textAlign: 'center', padding: '24px 0' }}>Loading...</p>
        ) : (
          <>
            <Label text="Crops you grow" hint="Separate with commas, for example maize, rice, tomato" />
            <input value={crops} onChange={(e) => setCrops(e.target.value)} placeholder="maize, rice" style={fieldStyle} />

            <Label text="Animals you keep" hint="For example broilers, goats, catfish" />
            <input value={livestock} onChange={(e) => setLivestock(e.target.value)} placeholder="broilers, goats" style={fieldStyle} />

            <Label text="Farm size" hint="For example 2 hectares or 500 birds" />
            <input value={farmSize} onChange={(e) => setFarmSize(e.target.value)} maxLength={60} placeholder="2 hectares" style={fieldStyle} />

            <Label text="Where is your farm?" hint="State, town or area" />
            <input value={farmLocation} onChange={(e) => setFarmLocation(e.target.value)} maxLength={120} placeholder="Kano, Tudun Wada" style={fieldStyle} />

            <Label text="Anything else" hint="For example irrigated, organic, rainy season only" />
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={3} placeholder="Optional" style={{ ...fieldStyle, resize: 'none' }} />

            {error && <p style={{ fontSize: '12px', color: COLORS.red, marginTop: '10px' }}>{error}</p>}

            <div
              role="button"
              onClick={save}
              style={{ marginTop: '16px', background: COLORS.green, color: 'white', borderRadius: '12px', padding: '12px', textAlign: 'center', fontSize: '14px', fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
