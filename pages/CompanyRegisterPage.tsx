import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import Icon from '../Icons'
import ImageUploader from '../ImageUploader'
import { uploadDocument } from '../imageUpload'
import { validatePhone, cleanPhone } from '../phoneUtils'
import { COLORS, inputStyle, labelStyle, ErrorBanner } from '../shared'

const AG_CATEGORIES = [
  'Crop Production', 'Livestock', 'Fisheries', 'Farm Equipment', 'Agro-Chemicals', 'Seeds & Inputs',
  'Agricultural Trading', 'Agricultural Services', 'Processing', 'Agricultural Supply', 'Agricultural Technology', 'Other',
]

const REP_ROLES: { value: string; label: string }[] = [
  { value: 'founder', label: 'Founder' },
  { value: 'director', label: 'Director' },
  { value: 'manager', label: 'Manager' },
  { value: 'representative', label: 'Business Representative' },
]

type Form = {
  // Step 1
  name: string
  businessType: string
  category: string
  description: string
  country: string
  state: string
  city: string
  address: string
  // Step 2
  regCountry: string
  regAuthority: string
  regNumber: string
  regBusinessName: string
  regDocument: string[]
  // Step 3
  repName: string
  repRole: string
  repEmail: string
  repPhone: string
  // Step 4
  logo: string[]
  cover: string[]
  website: string
  phone: string
  whatsapp: string
}

const EMPTY: Form = {
  name: '', businessType: '', category: '', description: '', country: '', state: '', city: '', address: '',
  regCountry: '', regAuthority: '', regNumber: '', regBusinessName: '', regDocument: [],
  repName: '', repRole: 'founder', repEmail: '', repPhone: '',
  logo: [], cover: [], website: '', phone: '', whatsapp: '',
}

const STEPS = ['Business', 'Registration', 'Representative', 'Profile']

export default function CompanyRegisterPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [step, setStep] = useState(0)
  const [form, setForm] = useState<Form>(EMPTY)
  const [docUploading, setDocUploading] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [coverUploading, setCoverUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))

  const uploadingAny = docUploading || logoUploading || coverUploading

  const validateStep = (): string => {
    if (step === 0) {
      if (!form.name.trim()) return 'Enter the business or company name.'
      if (!form.businessType.trim()) return 'Enter the business type.'
      if (!form.category) return 'Choose an agriculture category.'
      if (!form.country.trim()) return 'Enter the country.'
      if (!form.city.trim()) return 'Enter the city.'
      return ''
    }
    if (step === 1) {
      if (!form.regCountry.trim()) return 'Enter the registration country.'
      if (!form.regAuthority.trim()) return 'Enter the registration authority, e.g. CAC.'
      if (!form.regNumber.trim()) return 'Enter the registration number.'
      return ''
    }
    if (step === 2) {
      if (!form.repName.trim()) return 'Enter the representative\'s full name.'
      if (!form.repEmail.trim() || !/^\S+@\S+\.\S+$/.test(form.repEmail.trim())) return 'Enter a valid email address.'
      const phoneErr = validatePhone(form.repPhone)
      if (!form.repPhone.trim()) return 'Enter the representative\'s phone number.'
      if (phoneErr) return phoneErr
      return ''
    }
    return ''
  }

  const goNext = () => {
    const err = validateStep()
    if (err) return setError(err)
    setError('')
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const goBack = () => {
    setError('')
    if (step === 0) {
      navigate(-1)
      return
    }
    setStep((s) => Math.max(s - 1, 0))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDocUpload = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    setError('')
    setDocUploading(true)
    try {
      set('regDocument', [await uploadDocument(file, 'documents')])
    } catch (e: any) {
      setError(e?.message || 'Could not upload the document. Try again.')
    } finally {
      setDocUploading(false)
    }
  }

  const handleSubmit = async () => {
    if (!user || uploadingAny) return
    setError('')

    let site = form.website.trim()
    if (site && !/^https?:\/\//i.test(site)) site = `https://${site}`

    setSaving(true)
    const { data, error: dbError } = await supabase.from('companies').insert({
      owner_id: user.id,
      name: form.name.trim(),
      business_type: form.businessType.trim(),
      category: form.category,
      description: form.description.trim() || null,
      country: form.country.trim(),
      state: form.state.trim() || null,
      city: form.city.trim(),
      address: form.address.trim() || null,
      location: [form.city.trim(), form.country.trim()].filter(Boolean).join(', '),
      registration_country: form.regCountry.trim(),
      registration_authority: form.regAuthority.trim(),
      registration_number: form.regNumber.trim(),
      registered_business_name: form.regBusinessName.trim() || form.name.trim(),
      registration_document_url: form.regDocument[0] || null,
      representative_name: form.repName.trim(),
      representative_role: form.repRole,
      representative_email: form.repEmail.trim(),
      representative_phone: cleanPhone(form.repPhone),
      logo_url: form.logo[0] || null,
      cover_url: form.cover[0] || null,
      website: site || null,
      phone: cleanPhone(form.phone) || null,
      whatsapp: cleanPhone(form.whatsapp) || null,
    }).select('id').single()
    setSaving(false)

    if (dbError || !data) {
      setError(dbError?.message || 'Could not submit your company. Try again.')
      return
    }
    navigate(`/companies/${data.id}`, { replace: true })
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '30px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div onClick={goBack} style={{ cursor: 'pointer', display: 'flex' }}>
          <Icon name="arrowLeft" size={22} color={COLORS.text} />
        </div>
        <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>Register a Company</p>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: '6px', padding: '16px 16px 0' }}>
        {STEPS.map((label, i) => (
          <div key={label} style={{ flex: 1 }}>
            <div style={{ height: '4px', borderRadius: '2px', background: i <= step ? COLORS.green : COLORS.border }} />
            <p style={{ fontSize: '9.5px', fontWeight: 700, color: i <= step ? COLORS.green : COLORS.textMuted, marginTop: '5px', textAlign: 'center' }}>
              {label}
            </p>
          </div>
        ))}
      </div>

      <div style={{ padding: '16px' }}>
        <ErrorBanner text={error} />

        {step === 0 && (
          <div style={{ background: COLORS.card, borderRadius: '16px', padding: '16px' }}>
            <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, marginBottom: '4px' }}>Business Information</p>
            <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '14px' }}>Tell us about your agricultural business.</p>

            <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Business / Company name" maxLength={100} style={inputStyle} />
            <input value={form.businessType} onChange={(e) => set('businessType', e.target.value)} placeholder="Business type, e.g. Limited Company, Cooperative" maxLength={80} style={inputStyle} />

            <p style={labelStyle}>Agriculture category</p>
            <select value={form.category} onChange={(e) => set('category', e.target.value)} style={inputStyle}>
              <option value="">Choose a category</option>
              {AG_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            <textarea value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Short business description (optional)" rows={3} maxLength={1000} style={{ ...inputStyle, resize: 'none' }} />

            <input value={form.country} onChange={(e) => set('country', e.target.value)} placeholder="Country" maxLength={60} style={inputStyle} />
            <input value={form.state} onChange={(e) => set('state', e.target.value)} placeholder="State / Region (optional)" maxLength={60} style={inputStyle} />
            <input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="City" maxLength={60} style={inputStyle} />
            <input value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Business address (optional)" maxLength={150} style={{ ...inputStyle, marginBottom: 0 }} />
          </div>
        )}

        {step === 1 && (
          <div style={{ background: COLORS.card, borderRadius: '16px', padding: '16px' }}>
            <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, marginBottom: '4px' }}>Business Registration &amp; Verification</p>
            <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '14px' }}>
              FarmLite supports businesses registered in any country. In Nigeria, the registration authority is CAC.
            </p>

            <input value={form.regCountry} onChange={(e) => set('regCountry', e.target.value)} placeholder="Registration country" maxLength={60} style={inputStyle} />
            <input value={form.regAuthority} onChange={(e) => set('regAuthority', e.target.value)} placeholder="Registration authority, e.g. CAC" maxLength={80} style={inputStyle} />
            <input value={form.regNumber} onChange={(e) => set('regNumber', e.target.value)} placeholder="Registration number" maxLength={80} style={inputStyle} />
            <input value={form.regBusinessName} onChange={(e) => set('regBusinessName', e.target.value)} placeholder="Registered business name (if different)" maxLength={100} style={inputStyle} />

            <p style={labelStyle}>Registration certificate / document</p>
            <DocumentPicker value={form.regDocument[0] || ''} uploading={docUploading} onUpload={handleDocUpload} onRemove={() => set('regDocument', [])} />

            <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '12px' }}>
              After you submit, your company enters <strong>Verification Pending</strong> while FarmLite reviews this information.
            </p>
          </div>
        )}

        {step === 2 && (
          <div style={{ background: COLORS.card, borderRadius: '16px', padding: '16px' }}>
            <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, marginBottom: '4px' }}>Company Representative</p>
            <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '14px' }}>
              This person becomes the authorized manager of the company page.
            </p>

            <input value={form.repName} onChange={(e) => set('repName', e.target.value)} placeholder="Full name" maxLength={80} style={inputStyle} />

            <p style={labelStyle}>Position / Role</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {REP_ROLES.map((r) => (
                <div
                  key={r.value}
                  onClick={() => set('repRole', r.value)}
                  style={{
                    padding: '8px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                    background: form.repRole === r.value ? COLORS.green : COLORS.bg,
                    color: form.repRole === r.value ? 'white' : COLORS.textMuted,
                    border: `1px solid ${form.repRole === r.value ? COLORS.green : COLORS.border}`,
                  }}>
                  {r.label}
                </div>
              ))}
            </div>

            <input value={form.repEmail} onChange={(e) => set('repEmail', e.target.value)} placeholder="Email address" inputMode="email" style={inputStyle} />
            <input value={form.repPhone} onChange={(e) => set('repPhone', e.target.value)} placeholder="Phone, e.g. +2348012345678" inputMode="tel" style={{ ...inputStyle, marginBottom: 0 }} />
          </div>
        )}

        {step === 3 && (
          <div style={{ background: COLORS.card, borderRadius: '16px', padding: '16px' }}>
            <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, marginBottom: '4px' }}>Company Profile</p>
            <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginBottom: '14px' }}>How your business will appear on FarmLite.</p>

            <p style={labelStyle}>Company logo</p>
            <div style={{ marginBottom: '12px' }}><ImageUploader value={form.logo} onChange={(v) => set('logo', v)} folder="companies" max={1} onBusyChange={setLogoUploading} /></div>

            <p style={labelStyle}>Cover photo</p>
            <div style={{ marginBottom: '12px' }}><ImageUploader value={form.cover} onChange={(v) => set('cover', v)} folder="companies" max={1} onBusyChange={setCoverUploading} /></div>

            <input value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="Website (optional)" inputMode="url" style={inputStyle} />
            <input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="Business phone" inputMode="tel" style={inputStyle} />
            <input value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} placeholder="Business WhatsApp" inputMode="tel" style={{ ...inputStyle, marginBottom: 0 }} />

            <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '14px' }}>
              You can add products and services from your company page after it is created.
            </p>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
          {step > 0 && (
            <div onClick={goBack} style={{ flex: 1, textAlign: 'center', padding: '12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '13px', fontWeight: 700, color: COLORS.textMuted, cursor: 'pointer' }}>
              Back
            </div>
          )}
          {step < STEPS.length - 1 ? (
            <div onClick={goNext} style={{ flex: 2, textAlign: 'center', padding: '12px', borderRadius: '10px', background: COLORS.green, fontSize: '13px', fontWeight: 700, color: 'white', cursor: 'pointer' }}>
              Continue
            </div>
          ) : (
            <div onClick={saving || uploadingAny ? undefined : handleSubmit} style={{ flex: 2, textAlign: 'center', padding: '12px', borderRadius: '10px', background: COLORS.green, fontSize: '13px', fontWeight: 700, color: 'white', cursor: 'pointer', opacity: saving || uploadingAny ? 0.6 : 1 }}>
              {saving ? 'Submitting...' : uploadingAny ? 'Uploading...' : 'Submit for Review'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DocumentPicker({ value, uploading, onUpload, onRemove }: { value: string; uploading: boolean; onUpload: (f: FileList | null) => void; onRemove: () => void }) {
  const isPdf = value.toLowerCase().endsWith('.pdf')
  return (
    <div>
      {value ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', borderRadius: '10px', background: COLORS.bg, border: `1px solid ${COLORS.border}` }}>
          <Icon name="fileText" size={20} color={COLORS.green} />
          <p style={{ flex: 1, fontSize: '12px', color: COLORS.text }}>{isPdf ? 'Document uploaded (PDF)' : 'Document uploaded'}</p>
          <a href={value} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.green }}>View</a>
          <span onClick={onRemove} style={{ fontSize: '11.5px', fontWeight: 700, color: '#DC2626', cursor: 'pointer' }}>Remove</span>
        </div>
      ) : (
        <label style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px', borderRadius: '10px',
          border: `1.5px dashed ${COLORS.green}`, background: '#F0FDF4', color: COLORS.green, fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
        }}>
          <Icon name={uploading ? 'refresh' : 'upload'} size={16} color={COLORS.green} />
          {uploading ? 'Uploading...' : 'Upload certificate (image or PDF)'}
          <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} disabled={uploading} onChange={(e) => onUpload(e.target.files)} />
        </label>
      )}
    </div>
  )
}
