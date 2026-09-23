import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import Icon from '../Icons'
import { ProfileHeaderSkeleton } from '../LoadingSkeleton'
import NetworkError from '../NetworkError'
import { uploadMedia } from '../imageUpload'
import { validatePhone, cleanPhone } from '../phoneUtils'
import { COLORS, inputStyle, labelStyle, ErrorBanner } from '../shared'

const ROLES: { value: string; label: string }[] = [
  { value: 'farmer', label: 'Farmer' },
  { value: 'buyer', label: 'Buyer' },
  { value: 'agribusiness', label: 'Agribusiness' },
]

type Profile = {
  full_name: string | null
  username: string | null
  profile_image: string | null
  cover_image: string | null
  bio: string | null
  location: string | null
  role: string
  farm_type: string | null
  phone: string | null
  whatsapp: string | null
  website: string | null
}

// Editing lives on its own page, separate from the public Profile and the Account hub.
export default function EditProfilePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const avatarInput = useRef<HTMLInputElement>(null)
  const coverInput = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)

  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [uploading, setUploading] = useState<'' | 'avatar' | 'cover'>('')
  const [uploadError, setUploadError] = useState('')

  const [fullName, setFullName] = useState('')
  const [bio, setBio] = useState('')
  const [location, setLocation] = useState('')
  const [role, setRole] = useState('farmer')
  const [farmType, setFarmType] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [website, setWebsite] = useState('')

  const load = async () => {
    if (!user) return
    setNetError(false)
    setLoading(true)

    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, username, profile_image, cover_image, bio, location, role, farm_type, phone, whatsapp, website')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      setNetError(true)
      setLoading(false)
      return
    }

    const p = data as any
    setProfile(p)
    setFullName(p?.full_name || '')
    setBio(p?.bio || '')
    setLocation(p?.location || '')
    setRole(p?.role || 'farmer')
    setFarmType(p?.farm_type || '')
    setPhone(p?.phone || '')
    setWhatsapp(p?.whatsapp || '')
    setWebsite(p?.website || '')
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  // Photos are saved as soon as they are uploaded, so nothing is lost if the user leaves.
  const handlePickImage = async (kind: 'avatar' | 'cover', files: FileList | null) => {
    const file = files?.[0]
    if (!file || !user) return
    setUploadError('')
    setUploading(kind)
    try {
      const url = await uploadMedia(file, kind === 'avatar' ? 'avatars' : 'covers')
      const column = kind === 'avatar' ? 'profile_image' : 'cover_image'
      const { error } = await supabase.from('profiles').update({ [column]: url }).eq('user_id', user.id)
      if (error) throw new Error('Could not save your photo. Try again.')
      setProfile((prev) => (prev ? { ...prev, [column]: url } : prev))
    } catch (e: any) {
      setUploadError(e?.message || 'Photo upload failed. Try again.')
    } finally {
      setUploading('')
    }
  }

  const handleSave = async () => {
    if (!user) return
    setFormError('')

    if (!fullName.trim()) {
      setFormError('Enter your name.')
      return
    }
    const phoneErr = validatePhone(phone) || validatePhone(whatsapp)
    if (phoneErr) {
      setFormError(phoneErr)
      return
    }
    let site = website.trim()
    if (site && !/^https?:\/\//i.test(site)) site = `https://${site}`

    setSaving(true)
    const { error } = await supabase.from('profiles').update({
      full_name: fullName.trim(),
      bio: bio.trim() || null,
      location: location.trim() || null,
      role,
      farm_type: farmType.trim() || null,
      phone: cleanPhone(phone) || null,
      whatsapp: cleanPhone(whatsapp) || null,
      website: site || null,
    }).eq('user_id', user.id)
    setSaving(false)

    if (error) {
      setFormError('Could not save your changes. Try again.')
      return
    }
    navigate('/profile')
  }

  if (netError) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <Header onBack={() => navigate('/profile')} />
        <NetworkError onRetry={load} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '30px' }}>
      <Header onBack={() => navigate('/profile')} />

      <div style={{ padding: '16px' }}>
        {loading || !profile ? (
          <ProfileHeaderSkeleton />
        ) : (
          <>
            <ErrorBanner text={uploadError} />

            {/* Cover photo */}
            <div style={{ background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.greenDark})`, borderRadius: '16px', height: '110px', position: 'relative', overflow: 'hidden' }}>
              {profile.cover_image && <img src={profile.cover_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              <div
                onClick={uploading ? undefined : () => coverInput.current?.click()}
                style={{ position: 'absolute', right: '8px', bottom: '8px', display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '11px', fontWeight: 700, padding: '6px 10px', borderRadius: '999px', cursor: 'pointer', opacity: uploading === 'cover' ? 0.6 : 1 }}>
                <Icon name="camera" size={13} color="white" />
                {uploading === 'cover' ? 'Uploading...' : profile.cover_image ? 'Change cover' : 'Add cover'}
              </div>
            </div>

            {/* Avatar */}
            <div style={{ display: 'flex', alignItems: 'flex-end', marginTop: '-32px', paddingLeft: '4px' }}>
              <div style={{ position: 'relative', width: '72px', height: '72px', flexShrink: 0 }}>
                <div style={{ width: '72px', height: '72px', borderRadius: '36px', border: `3px solid ${COLORS.bg}`, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxSizing: 'border-box' }}>
                  {profile.profile_image ? <img src={profile.profile_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="user" size={30} color={COLORS.green} />}
                </div>
                <div
                  onClick={uploading ? undefined : () => avatarInput.current?.click()}
                  style={{ position: 'absolute', right: '-2px', bottom: '0', width: '26px', height: '26px', borderRadius: '13px', background: COLORS.green, border: `2px solid ${COLORS.bg}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: uploading === 'avatar' ? 0.6 : 1 }}>
                  <Icon name={uploading === 'avatar' ? 'refresh' : 'camera'} size={13} color="white" />
                </div>
              </div>
            </div>

            <input ref={avatarInput} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { handlePickImage('avatar', e.target.files); e.target.value = '' }} />
            <input ref={coverInput} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { handlePickImage('cover', e.target.files); e.target.value = '' }} />

            <div style={{ background: COLORS.card, borderRadius: '14px', padding: '14px', marginTop: '16px' }}>
              <ErrorBanner text={formError} />

              <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" maxLength={80} style={inputStyle} />
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Bio: what you grow, raise or buy" rows={3} maxLength={300} style={{ ...inputStyle, resize: 'none', marginBottom: '4px' }} />
              <p style={{ fontSize: '10.5px', color: COLORS.textMuted, textAlign: 'right', marginBottom: '10px' }}>{bio.length}/300</p>

              <p style={labelStyle}>I am a</p>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', overflowX: 'auto' }}>
                {ROLES.map((r) => (
                  <div
                    key={r.value}
                    onClick={() => setRole(r.value)}
                    style={{
                      whiteSpace: 'nowrap', padding: '8px 14px', borderRadius: '10px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
                      background: role === r.value ? COLORS.green : COLORS.card,
                      color: role === r.value ? 'white' : COLORS.textMuted,
                      border: `1px solid ${role === r.value ? COLORS.green : COLORS.border}`,
                    }}>
                    {r.label}
                  </div>
                ))}
              </div>

              <input value={farmType} onChange={(e) => setFarmType(e.target.value)} placeholder="What you farm or trade, e.g. Maize, poultry" maxLength={80} style={inputStyle} />
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location, e.g. Kano, Nigeria" maxLength={80} style={inputStyle} />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone, e.g. +2348012345678" inputMode="tel" style={inputStyle} />
              <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="WhatsApp, e.g. +2348012345678" inputMode="tel" style={inputStyle} />
              <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="Website (optional)" inputMode="url" style={{ ...inputStyle, marginBottom: '12px' }} />

              <div style={{ display: 'flex', gap: '10px' }}>
                <div onClick={() => navigate('/profile')} style={{ flex: 1, textAlign: 'center', padding: '10px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '12.5px', fontWeight: 700, color: COLORS.textMuted, cursor: 'pointer' }}>
                  Cancel
                </div>
                <div onClick={saving || !!uploading ? undefined : handleSave} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', borderRadius: '10px', background: COLORS.green, fontSize: '12.5px', fontWeight: 700, color: 'white', cursor: 'pointer', opacity: saving || uploading ? 0.6 : 1 }}>
                  <Icon name="check" size={14} color="white" /> {saving ? 'Saving...' : 'Save'}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div onClick={onBack} style={{ cursor: 'pointer', display: 'flex' }}>
        <Icon name="arrowLeft" size={22} color={COLORS.text} />
      </div>
      <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>Edit Profile</p>
    </div>
  )
}
